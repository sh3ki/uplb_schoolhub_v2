<?php

namespace App\Http\Controllers\Student;

use App\Http\Controllers\Controller;
use App\Models\FeeItem;
use App\Models\FeeItemAssignment;
use App\Models\OnlineTransaction;
use App\Models\Student;
use App\Models\StudentFee;
use App\Models\StudentPayment;
use App\Models\TransferRequest;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class OnlinePaymentController extends Controller
{
    /**
     * Display the online payment page.
     */
    public function index(Request $request): Response
    {
        $user = Auth::user();
        $student = $user->student;
        
        if (!$student) {
            abort(404, 'Student record not found.');
        }

        // Get fee items based on student's classification/department/year_level
        $activeSchoolYear = \App\Models\AppSetting::current()?->school_year ?? (date('Y') . '-' . (date('Y') + 1));
        $targetSchoolYear = trim((string) ($student->school_year ?: $activeSchoolYear));

        $feeRecords = StudentFee::where('student_id', $student->id)
            ->orderByDesc('school_year')
            ->orderByDesc('id')
            ->get()
            ->map(function ($fee) {
                return [
                    'id' => $fee->id,
                    'school_year' => trim((string) $fee->school_year),
                    'total_amount' => (float) $fee->total_amount,
                    'total_paid' => (float) $fee->total_paid,
                    'grant_discount' => (float) $fee->grant_discount,
                    'balance' => (float) $fee->balance,
                ];
            })
            ->filter(fn ($fee) => $fee['school_year'] !== '')
            ->groupBy('school_year')
            ->map(fn ($rows) => $rows->first())
            ->values();

        $schoolYears = $feeRecords
            ->pluck('school_year')
            ->filter()
            ->unique()
            ->sortDesc()
            ->values();

        if ($schoolYears->isEmpty()) {
            $schoolYears = collect([$targetSchoolYear]);
        }

        $requestedSchoolYear = trim((string) $request->input('school_year', ''));
        $selectedSchoolYear = $requestedSchoolYear !== '' && $schoolYears->contains($requestedSchoolYear)
            ? $requestedSchoolYear
            : (string) $schoolYears->first();

        $feeItems = $this->getStudentFeeItems($student, $selectedSchoolYear);

        // Get student's fee summary
        $summary = $this->getFeeSummary($student, $selectedSchoolYear);

        // Get recent online payments (paginated, latest first)
        $recentPayments = OnlineTransaction::where('student_id', $student->id)
            ->orderByDesc('created_at')
            ->paginate(5)
            ->withQueryString();

        $recentPayments->through(function ($transaction) {
                return [
                    'id' => $transaction->id,
                    'reference_number' => $transaction->reference_number,
                    'amount' => (float) $transaction->amount,
                    'payment_method' => $transaction->payment_method,
                    'status' => $transaction->status,
                    'submitted_at' => $transaction->created_at->format('Y-m-d H:i:s'),
                    'verified_at' => $transaction->verified_at?->format('Y-m-d H:i:s'),
                    'notes' => $transaction->notes,
                    'payment_proof_url' => $transaction->payment_proof_url,
                    'payment_proof_path' => $transaction->payment_proof,
                ];
            });

        // Payment methods
        $paymentMethods = [
            ['value' => 'gcash', 'label' => 'GCash'],
            ['value' => 'bank_transfer', 'label' => 'Bank Transfer'],
        ];

        $latestTransferRequest = TransferRequest::where('student_id', $student->id)
            ->whereNull('deleted_at')
            ->latest('id')
            ->first();

        $transferFeePaidAmount = 0.0;
        if ($latestTransferRequest) {
            $transferFeePaidAmount = (float) OnlineTransaction::query()
                ->where('transfer_request_id', $latestTransferRequest->id)
                ->whereIn('status', ['completed', 'verified'])
                ->sum('amount');
        }

        $transferFeeAmount = (float) ($latestTransferRequest?->transfer_fee_amount ?? 0);
        $transferFeeBalance = max(0, $transferFeeAmount - $transferFeePaidAmount);

        $transferFee = $latestTransferRequest ? [
            'status' => $latestTransferRequest->status,
            'registrar_status' => $latestTransferRequest->registrar_status,
            'accounting_status' => $latestTransferRequest->accounting_status,
            'amount' => $transferFeeAmount,
            'paid_amount' => $transferFeePaidAmount,
            'balance' => $transferFeeBalance,
            'paid' => (bool) $latestTransferRequest->transfer_fee_paid,
            'or_number' => $latestTransferRequest->transfer_fee_or_number,
            'finalized_at' => $latestTransferRequest->finalized_at?->format('Y-m-d H:i:s'),
        ] : null;

        return Inertia::render('student/online-payments/index', [
            'feeItems' => $feeItems,
            'summary' => $summary,
            'feeRecords' => $feeRecords->values(),
            'schoolYears' => $schoolYears->values(),
            'selectedSchoolYear' => $selectedSchoolYear,
            'recentPayments' => $recentPayments,
            'paymentMethods' => $paymentMethods,
            'enrollmentStatus' => $student->enrollment_status,
            'isDropped' => (bool) ($student->enrollment_status === 'dropped' && !$student->is_active),
            'transferFee' => $transferFee,
        ]);
    }

    /**
     * Submit an online payment.
     */
    public function store(Request $request): RedirectResponse
    {
        $user = Auth::user();
        $student = $user->student;
        
        if (!$student) {
            return back()->withErrors(['error' => 'Student record not found.']);
        }

        $validated = $request->validate([
            'amount' => 'required|numeric|min:1',
            'school_year' => 'required|string|max:20',
            'payment_method' => 'required|string|in:gcash,bank_transfer',
            'reference_number' => 'required|string|max:255',
            'receipt_image' => 'required|file|mimes:jpg,jpeg,png,pdf|max:5120', // 5MB max
            'notes' => 'nullable|string|max:500',
            'bank_name' => 'nullable|required_if:payment_method,bank_transfer|string|max:255',
            'is_transfer_payment' => 'nullable|boolean',
        ]);

        $isTransferPayment = (bool) ($validated['is_transfer_payment'] ?? false);

        $activeTransferRequest = TransferRequest::query()
            ->where('student_id', $student->id)
            ->whereNull('deleted_at')
            ->where('registrar_status', 'approved')
            ->where('accounting_status', 'approved')
            ->latest('id')
            ->first();

        if ($isTransferPayment) {
            if (!$activeTransferRequest) {
                throw ValidationException::withMessages([
                    'amount' => 'No active transfer out payment request was found.',
                ]);
            }

            $alreadyPaid = (float) OnlineTransaction::query()
                ->where('transfer_request_id', $activeTransferRequest->id)
                ->whereIn('status', ['completed', 'verified'])
                ->sum('amount');

            $remainingBalance = max(0, (float) $activeTransferRequest->transfer_fee_amount - $alreadyPaid);
            if ($remainingBalance <= 0) {
                throw ValidationException::withMessages([
                    'amount' => 'Transfer out fee is already fully settled.',
                ]);
            }

            if ((float) $validated['amount'] < $remainingBalance) {
                throw ValidationException::withMessages([
                    'amount' => 'Amount must be exact or greater than remaining transfer out balance of ' . number_format($remainingBalance, 2) . '.',
                ]);
            }
        }

        // Store the receipt image
        $receiptPath = null;
        if ($request->hasFile('receipt_image')) {
            $receiptPath = $request->file('receipt_image')->store('online-payments/receipts', 'public');
        }

        // Generate unique transaction ID
        $transactionId = 'OT-' . now()->format('Ymd') . '-' . strtoupper(substr(uniqid(), -6));

        $selectedSchoolYear = trim((string) $validated['school_year']);
        if (!$isTransferPayment) {
            $hasFeeYear = StudentFee::where('student_id', $student->id)
                ->whereRaw('TRIM(school_year) = ?', [$selectedSchoolYear])
                ->exists();

            if (!$hasFeeYear) {
                return back()->withErrors([
                    'school_year' => 'Selected school year is not available for this student.',
                ]);
            }
        }

        $remarksPayload = '[SchoolYear: ' . $selectedSchoolYear . ']';
        if ($isTransferPayment && $activeTransferRequest) {
            $remarksPayload .= ' [PaymentType: transfer_out_fee] [TransferRequest: ' . $activeTransferRequest->id . ']';
        }
        if (!empty($validated['notes'])) {
            $remarksPayload .= ' ' . trim((string) $validated['notes']);
        }

        // Create online transaction
        OnlineTransaction::create([
            'student_id' => $student->id,
            'transfer_request_id' => ($isTransferPayment && $activeTransferRequest) ? $activeTransferRequest->id : null,
            'transaction_id' => $transactionId,
            'amount' => $validated['amount'],
            'payment_method' => $validated['payment_method'],
            'payment_context' => $isTransferPayment ? 'transfer_out_fee' : 'tuition',
            'reference_number' => $validated['reference_number'],
            'bank_name' => $validated['bank_name'] ?? null,
            'payment_proof' => $receiptPath,
            'transaction_date' => now(),
            'status' => 'pending',
            'remarks' => $remarksPayload,
        ]);

        return redirect()->back()->with('success', 'Payment submitted successfully. Please wait for verification.');
    }

    /**
     * Get fee items assigned to this student based on their classification/department/year_level.
     */
    private function getStudentFeeItems(Student $student, string $schoolYear): array
    {

        // Get fee items from assignments
        $assignedFeeItemIds = FeeItemAssignment::where('school_year', $schoolYear)
            ->where('is_active', true)
            ->where(function ($query) use ($student) {
                // Match classification
                if ($student->classification) {
                    $query->where('classification', $student->classification);
                }
                // Match department
                if ($student->department_id) {
                    $query->where('department_id', $student->department_id);
                }
                // Match year level
                if ($student->year_level_id) {
                    $query->where('year_level_id', $student->year_level_id);
                }
            })
            ->pluck('fee_item_id')
            ->toArray();

        // Also get fee items with 'all' scope
        $allScopeFeeItems = FeeItem::where('school_year', $schoolYear)
            ->where('is_active', true)
            ->where('assignment_scope', 'all')
            ->pluck('id')
            ->toArray();

        $feeItemIds = array_unique(array_merge($assignedFeeItemIds, $allScopeFeeItems));

        return FeeItem::with('category')
            ->whereIn('id', $feeItemIds)
            ->where('is_active', true)
            ->get()
            ->map(function ($item) {
                return [
                    'id' => $item->id,
                    'name' => $item->name,
                    'amount' => (float) $item->selling_price,
                    'category' => $item->category?->name ?? 'General',
                ];
            })
            ->toArray();
    }

    /**
     * Get fee summary for the student from StudentFee records (authoritative source).
     */
    private function getFeeSummary(Student $student, string $targetSchoolYear): array
    {
        $fees = StudentFee::with('payments')
            ->where('student_id', $student->id)
            ->where('school_year', $targetSchoolYear)
            ->get();

        $totalFees = (float) $fees->sum('total_amount');
        $totalDiscount = (float) $fees->sum('grant_discount');
        $totalPaid = (float) $fees->flatMap->payments->sum('amount');

        // Fallback: if the year has no student_fees row yet, compute totals from assigned fee items
        // so students don't see zeros while accounting computes the same cycle.
        if ($fees->isEmpty()) {
            $feeItems = $this->getStudentFeeItems($student, $targetSchoolYear);
            $totalFees = (float) collect($feeItems)->sum('amount');

            $grantRecipients = $this->getGrantRecipientsForFeeYear($student, $targetSchoolYear);
            $totalDiscount = 0.0;
            foreach ($grantRecipients as $recipient) {
                if ($recipient->grant) {
                    $totalDiscount += $recipient->grant->calculateDiscount($totalFees);
                }
            }

            $totalPaid = (float) StudentPayment::query()
                ->where('student_id', $student->id)
                ->whereHas('studentFee', function ($q) use ($targetSchoolYear) {
                    $q->where('school_year', $targetSchoolYear);
                })
                ->sum('amount');
        }

        $balance = max(0, $totalFees - $totalDiscount - $totalPaid);

        return [
            'total_fees'     => $totalFees,
            'total_discount' => $totalDiscount,
            'total_paid'     => $totalPaid,
            'balance'        => $balance,
        ];
    }

    /**
     * Get grant recipients for a fee year with a safe fallback to active grants on the student's primary year.
     */
    private function getGrantRecipientsForFeeYear(Student $student, string $schoolYear)
    {
        $baseQuery = \App\Models\GrantRecipient::where('student_id', $student->id)
            ->where('status', 'active');

        $exact = (clone $baseQuery)
            ->where('school_year', $schoolYear)
            ->orderByDesc('id')
            ->with('grant')
            ->get();

        if ($exact->isNotEmpty()) {
            return $exact->unique('grant_id')->values();
        }

        $primaryYear = $student->school_year
            ?? \App\Models\AppSetting::current()?->school_year
            ?? $schoolYear;

        if ($schoolYear === $primaryYear) {
            return $baseQuery
                ->orderByDesc('id')
                ->with('grant')
                ->get()
                ->unique('grant_id')
                ->values();
        }

        return collect();
    }
}
