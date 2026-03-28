<?php

namespace App\Http\Controllers\Accounting;

use App\Http\Controllers\Controller;
use App\Models\OnlineTransaction;
use App\Models\Student;
use App\Models\StudentFee;
use App\Models\StudentPayment;
use App\Models\TransferRequest;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class OnlineTransactionController extends Controller
{
    /**
     * Display a listing of online transactions.
     */
    public function index(Request $request): Response
    {
        $query = OnlineTransaction::with(['student', 'payment', 'verifiedBy']);

        // Search
        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('transaction_id', 'like', "%{$search}%")
                  ->orWhere('reference_number', 'like', "%{$search}%")
                  ->orWhereHas('student', function ($sq) use ($search) {
                      $sq->where('first_name', 'like', "%{$search}%")
                        ->orWhere('last_name', 'like', "%{$search}%")
                        ->orWhere('lrn', 'like', "%{$search}%");
                  });
            });
        }

        // Filter by status
        if ($status = $request->input('status')) {
            if (in_array($status, ['verified', 'completed'])) {
                $query->whereIn('status', ['verified', 'completed']);
            } else {
                $query->where('status', $status);
            }
        }

        // Filter by payment method
        if ($paymentMethod = $request->input('payment_method')) {
            $query->where('payment_method', $paymentMethod);
        }

        // Filter by date range
        if ($from = $request->input('from')) {
            $query->whereDate('transaction_date', '>=', $from);
        }
        if ($to = $request->input('to')) {
            $query->whereDate('transaction_date', '<=', $to);
        }

        $transactions = $query->latest('transaction_date')->paginate(20)->withQueryString();

        // Transform for frontend
        $transactions->through(function ($transaction) {
            return [
                'id' => $transaction->id,
                'student_id' => $transaction->student_id,
                'transaction_reference' => $transaction->transaction_id,
                'payment_provider' => $transaction->payment_method === 'bank_transfer' ? 'bank' : $transaction->payment_method,
                'amount' => $transaction->amount,
                'fee' => '0.00',
                'net_amount' => $transaction->amount,
                'status' => $transaction->status,
                'provider_reference' => $transaction->reference_number,
                'provider_status' => null,
                'payment_details' => null,
                'payment_proof_url' => $transaction->payment_proof_url,
                'verified_at' => $transaction->verified_at,
                'failed_at' => null,
                'refunded_at' => null,
                'failure_reason' => null,
                'remarks' => $transaction->remarks,
                'or_number' => $transaction->payment?->or_number,
                'payment_context' => $transaction->payment_context ?? 'tuition',
                'created_at' => $transaction->created_at,
                'student' => $transaction->student ? [
                    'id' => $transaction->student->id,
                    'full_name' => $transaction->student->full_name,
                    'lrn' => $transaction->student->lrn,
                    'email' => $transaction->student->email ?? null,
                ] : null,
                'verified_by' => $transaction->verifiedBy ? ['name' => $transaction->verifiedBy->name] : null,
            ];
        });

        // Stats
        $statsQuery = OnlineTransaction::query();

        $stats = [
            'pending' => (clone $statsQuery)->pending()->count(),
            'verified' => (clone $statsQuery)->completed()->count(),
            'total_pending_amount' => (clone $statsQuery)->pending()->sum('amount'),
            'total_verified_today' => (clone $statsQuery)->completed()->whereDate('verified_at', today())->sum('amount'),
        ];
        
        // Providers
        $providers = [
            'gcash' => 'GCash',
            'bank' => 'Bank Transfer',
            'card' => 'Credit/Debit Card',
            'other' => 'Other',
        ];

        return Inertia::render($this->viewPrefix() . '/online-transactions/index', [
            'transactions' => $transactions,
            'providers' => $providers,
            'stats' => $stats,
            'filters' => $request->only(['search', 'status', 'payment_method', 'from', 'to']),
        ]);
    }

    /**
     * Verify a transaction and create payment record.
     */
    public function verify(Request $request, OnlineTransaction $transaction): RedirectResponse
    {
        if (!$transaction->isPending()) {
            return redirect()->back()->with('error', 'Transaction is not pending.');
        }

        $validated = $request->validate([
            'or_number' => 'nullable|string|max:100',
        ]);

        if ($this->isTransferFeeTransaction($transaction)) {
            $transferRequest = $this->resolveTransferRequestFromTransaction($transaction);
            if (!$transferRequest) {
                return redirect()->back()->with('error', 'Transfer request reference was not found for this transaction.');
            }

            if ((int) $transferRequest->student_id !== (int) $transaction->student_id) {
                return redirect()->back()->with('error', 'Transfer request does not match transaction student.');
            }

            if ($transferRequest->accounting_status !== 'approved') {
                return redirect()->back()->with('error', 'Transfer request is not in approved super-accounting state.');
            }

            $alreadySettled = (float) OnlineTransaction::query()
                ->where('transfer_request_id', $transferRequest->id)
                ->whereIn('status', ['completed', 'verified'])
                ->where('id', '!=', $transaction->id)
                ->sum('amount');

            $requiredAmount = max(0, (float) $transferRequest->transfer_fee_amount);
            $settledAfterVerification = $alreadySettled + (float) $transaction->amount;

            if ($settledAfterVerification < $requiredAmount) {
                $remaining = $requiredAmount - $settledAfterVerification;
                return redirect()->back()->with('error', 'Transfer out payment cannot be verified yet. Remaining required amount: ' . number_format($remaining, 2));
            }

            $orNumber = $validated['or_number'] ?? ('TRF-OT-' . $transaction->transaction_id);
            $transferRequest->markTransferFeePaid(
                (int) Auth::id(),
                $orNumber,
                (float) $transferRequest->transfer_fee_amount
            );

            $transaction->update([
                'transfer_request_id' => $transferRequest->id,
                'status' => 'completed',
                'verified_at' => now(),
                'verified_by' => Auth::id(),
                'remarks' => trim((string) (($transaction->remarks ?? '') . ' [VerifiedAs: transfer_out_fee]')),
            ]);

            return redirect()->back()->with('success', 'Transfer out online payment verified and transfer request marked paid.');
        }

        // Create payment record for the student's billing school year.
        $student = Student::find($transaction->student_id);
        $currentSchoolYear = $student?->school_year
            ?: (\App\Models\AppSetting::current()->school_year
                ?? now()->year . '-' . (now()->year + 1));

        $currentSchoolYear = $this->resolveTransactionSchoolYear($transaction, $student, (string) $currentSchoolYear);

        $studentFee = StudentFee::where('student_id', $transaction->student_id)
            ->whereRaw('TRIM(school_year) = ?', [trim((string) $currentSchoolYear)])
            ->first();

        if (!$studentFee) {
            // Create a placeholder StudentFee in the billing year so payment linkage stays consistent.
            $studentFee = StudentFee::create([
                'student_id'   => $transaction->student_id,
                'school_year'  => trim((string) $currentSchoolYear),
                'total_amount' => $transaction->amount,
                'total_paid'   => 0,
                'grant_discount' => 0,
                'balance'      => $transaction->amount,
            ]);
        }

        $orNumber = $validated['or_number'] ?? ('OT-' . $transaction->transaction_id);
        $rawMethod = strtolower((string) ($transaction->payment_method ?? 'cash'));
        $paymentMode = match ($rawMethod) {
            'gcash' => 'GCASH',
            'bank', 'bank_transfer' => 'BANK',
            default => 'CASH',
        };
        // Map to valid payment_method enum values (cash, gcash, bank, other)
        $paymentMethod = $rawMethod;
        if ($paymentMethod === 'bank_transfer') {
            $paymentMethod = 'bank';
        }
        if (!in_array($paymentMethod, ['cash', 'gcash', 'bank', 'other'])) {
            $paymentMethod = 'other';
        }

        $payment = StudentPayment::create([
            'student_id' => $transaction->student_id,
            'student_fee_id' => $studentFee->id,
            'payment_date' => $transaction->transaction_date,
            'or_number' => $orNumber,
            'amount' => $transaction->amount,
            'payment_for' => 'tuition',
            'payment_mode' => $paymentMode,
            'payment_method' => $paymentMethod,
            'reference_number' => $transaction->reference_number,
            'bank_name' => $paymentMode === 'BANK' ? $transaction->bank_name : null,
            'notes' => 'Online transaction: ' . $transaction->transaction_id . ' (' . trim((string) $currentSchoolYear) . ')',
            'recorded_by' => Auth::id(),
        ]);

        // Update student fee balance
        $studentFee->updateBalance();

        // Update transaction
        $transaction->update([
            'student_payment_id' => $payment->id,
            'status' => 'completed',
            'verified_at' => now(),
            'verified_by' => Auth::id(),
        ]);

        return redirect()->back()->with('success', 'Transaction verified and payment recorded.');
    }

    private function resolveTransactionSchoolYear(OnlineTransaction $transaction, ?Student $student, string $fallbackSchoolYear): string
    {
        $remarks = (string) ($transaction->remarks ?? '');
        if (preg_match('/\[SchoolYear:\s*([^\]]+)\]/i', $remarks, $matches)) {
            $candidate = trim((string) ($matches[1] ?? ''));
            if ($candidate !== '') {
                return $candidate;
            }
        }

        $studentYear = trim((string) ($student?->school_year ?? ''));
        if ($studentYear !== '') {
            return $studentYear;
        }

        return trim((string) $fallbackSchoolYear);
    }

    /**
     * Mark a transaction as failed.
     */
    public function markFailed(Request $request, OnlineTransaction $transaction): RedirectResponse
    {
        if (!$transaction->isPending()) {
            return redirect()->back()->with('error', 'Only pending transactions can be marked as failed.');
        }

        $validated = $request->validate([
            'remarks' => 'nullable|string',
        ]);

        $transaction->markFailed($validated['remarks'] ?? null);

        return redirect()->back()->with('success', 'Transaction marked as failed.');
    }

    /**
     * Refund a transaction.
     */
    public function refund(Request $request, OnlineTransaction $transaction): RedirectResponse
    {
        $validated = $request->validate([
            'remarks' => 'nullable|string',
        ]);

        if (!in_array($transaction->status, ['completed', 'verified'], true)) {
            return redirect()->back()->with('error', 'Only completed or verified transactions can be refunded.');
        }

        DB::transaction(function () use ($transaction, $validated) {
            $linkedPayment = $transaction->student_payment_id
                ? StudentPayment::find($transaction->student_payment_id)
                : null;

            if ($linkedPayment) {
                $reversalAmount = -abs((float) $linkedPayment->amount);

                StudentPayment::create([
                    'student_id' => $linkedPayment->student_id,
                    'student_fee_id' => $linkedPayment->student_fee_id,
                    'payment_date' => now()->toDateString(),
                    'or_number' => ($linkedPayment->or_number ?: 'OT-' . $transaction->transaction_id) . '-RFND',
                    'amount' => $reversalAmount,
                    'payment_for' => $linkedPayment->payment_for ?: 'other',
                    'payment_mode' => $linkedPayment->payment_mode ?: 'CASH',
                    'payment_method' => $linkedPayment->payment_method,
                    'reference_number' => $linkedPayment->reference_number,
                    'bank_name' => $linkedPayment->bank_name,
                    'notes' => 'Refund reversal for online transaction ' . $transaction->transaction_id,
                    'recorded_by' => Auth::id(),
                ]);

                $fee = StudentFee::find($linkedPayment->student_fee_id);
                if ($fee) {
                    $fee->updateBalance();
                }
            }

            $transaction->refund($validated['remarks'] ?? null);

            if ($this->isTransferFeeTransaction($transaction)) {
                $transferRequest = $this->resolveTransferRequestFromTransaction($transaction);
                if ($transferRequest) {
                    $remainingSettled = (float) OnlineTransaction::query()
                        ->where('transfer_request_id', $transferRequest->id)
                        ->whereIn('status', ['completed', 'verified'])
                        ->sum('amount');

                    if ($remainingSettled < (float) $transferRequest->transfer_fee_amount) {
                        $transferRequest->update([
                            'transfer_fee_paid' => false,
                            'transfer_fee_or_number' => null,
                            'processed_by' => Auth::id(),
                            'processed_at' => now(),
                        ]);
                    }
                }
            }
        });

        return redirect()->back()->with('success', 'Transaction refunded.');
    }

    /**
     * Delete a transaction.
     */
    public function destroy(OnlineTransaction $transaction): RedirectResponse
    {
        $transaction->delete();

        return redirect()->back()->with('success', 'Transaction deleted successfully.');
    }

    private function isTransferFeeTransaction(OnlineTransaction $transaction): bool
    {
        if (($transaction->payment_context ?? null) === 'transfer_out_fee') {
            return true;
        }

        $remarks = (string) ($transaction->remarks ?? '');
        return stripos($remarks, '[PaymentType: transfer_out_fee]') !== false;
    }

    private function resolveTransferRequestFromTransaction(OnlineTransaction $transaction): ?TransferRequest
    {
        if ($transaction->transfer_request_id) {
            return TransferRequest::find($transaction->transfer_request_id);
        }

        $remarks = (string) ($transaction->remarks ?? '');
        if (preg_match('/\[TransferRequest:\s*(\d+)\]/i', $remarks, $matches)) {
            return TransferRequest::find((int) ($matches[1] ?? 0));
        }

        return null;
    }
}
