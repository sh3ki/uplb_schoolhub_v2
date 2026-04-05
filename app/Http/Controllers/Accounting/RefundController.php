<?php

namespace App\Http\Controllers\Accounting;

use App\Http\Controllers\Controller;
use App\Models\OnlineTransaction;
use App\Models\RefundRequest;
use App\Models\Student;
use App\Models\StudentFee;
use App\Models\StudentPayment;
use App\Models\Department;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class RefundController extends Controller
{
    /**
     * List all refund requests for accounting.
     */
    public function index(Request $request): Response
    {
        $this->reconcileRefundedOnlineTransactions();

        $query = RefundRequest::with([
            'student:id,first_name,last_name,lrn,student_photo_url,program,year_level',
            'studentFee:id,school_year,total_amount,total_paid,balance',
            'processedBy:id,name',
        ]);

        // Filter by status (default to all)
        $status = $request->input('status', 'all');
        if ($status && $status !== 'all') {
            $query->where('status', $status);
        }

        // Filter by type
        if ($type = $request->input('type')) {
            $query->where('type', $type);
        }

        // Search
        if ($search = $request->input('search')) {
            $query->whereHas('student', function ($q) use ($search) {
                $q->where('first_name', 'like', "%{$search}%")
                  ->orWhere('last_name', 'like', "%{$search}%")
                  ->orWhere('lrn', 'like', "%{$search}%");
            });
        }

        $refunds = $query->latest()->paginate(20)->withQueryString();

        $refunds->getCollection()->transform(function ($r) {
            $referenceOrNumber = $this->extractTaggedValue((string) $r->reason, 'OR');
            $reasonDisplay = $this->stripReasonTags((string) $r->reason);

            return [
                'id'               => $r->id,
                'type'             => $r->type,
                'amount'           => (float) $r->amount,
                'reason'           => $r->reason,
                'reason_display'   => $reasonDisplay,
                'reference_or_number' => $referenceOrNumber,
                'status'           => $r->status,
                'accounting_notes' => $r->accounting_notes,
                'processed_by'     => $r->processedBy?->name,
                'processed_at'     => $r->processed_at?->format('M d, Y h:i A'),
                'created_at'       => $r->created_at->format('M d, Y h:i A'),
                'school_year'      => $r->studentFee?->school_year,
                'student' => $r->student ? [
                    'id'                => $r->student->id,
                    'full_name'         => $r->student->full_name,
                    'lrn'               => $r->student->lrn,
                    'program'           => $r->student->program,
                    'year_level'        => $r->student->year_level,
                    'student_photo_url' => $r->student->student_photo_url,
                ] : null,
            ];
        });

        // Summary stats
        $stats = [
            'pending'  => RefundRequest::where('status', 'pending')->count(),
            'approved' => RefundRequest::where('status', 'approved')->count(),
            'rejected' => RefundRequest::where('status', 'rejected')->count(),
            'total_approved_amount' => (float) RefundRequest::where('status', 'approved')->sum('amount'),
        ];

        return Inertia::render($this->viewPrefix() . '/refunds/index', [
            'refunds' => $refunds,
            'stats'   => $stats,
            'tab'     => $status,
            'filters' => $request->only(['search', 'status', 'type']),
        ]);
    }

    /**
     * Ensure refunded online transactions are mirrored in refund_requests so
     * accounting refund views/tabs remain complete even for legacy rows.
     */
    private function reconcileRefundedOnlineTransactions(): void
    {
        OnlineTransaction::query()
            ->with(['payment:id,student_fee_id,or_number', 'student:id'])
            ->where('status', 'refunded')
            ->chunkById(100, function ($transactions) {
                foreach ($transactions as $transaction) {
                    $originalOrNumber = trim((string) ($transaction->payment?->or_number ?: $transaction->transaction_id));
                    $reason = 'Online transaction refund [OR:' . $originalOrNumber . '] [OTX:' . $transaction->id . '] [TXN:' . $transaction->transaction_id . ']';

                    $exists = RefundRequest::query()
                        ->where('student_id', $transaction->student_id)
                        ->where('type', 'refund')
                        ->where(function ($q) use ($reason, $transaction) {
                            $q->where('reason', 'like', '%[OTX:' . $transaction->id . ']%')
                                ->orWhere('reason', $reason)
                                ->orWhere('reason', 'like', '%' . $transaction->transaction_id . '%');
                        })
                        ->exists();

                    if ($exists) {
                        continue;
                    }

                    RefundRequest::create([
                        'student_id' => $transaction->student_id,
                        'student_fee_id' => $transaction->payment?->student_fee_id,
                        'type' => 'refund',
                        'amount' => abs((float) $transaction->amount),
                        'reason' => $reason,
                        'status' => 'approved',
                        'processed_by' => $transaction->verified_by,
                        'processed_at' => $transaction->verified_at ?? now(),
                        'accounting_notes' => 'Auto-synced from refunded online transaction.',
                    ]);
                }
            });
    }

    /**
     * Get students for creating a refund request (search by name/LRN).
     */
    public function searchStudents(Request $request)
    {
        $search = $request->input('search', '');
        
        if (strlen($search) < 2) {
            return response()->json([]);
        }

        $students = Student::where(function ($q) use ($search) {
                $q->where('first_name', 'like', "%{$search}%")
                  ->orWhere('last_name', 'like', "%{$search}%")
                  ->orWhere('lrn', 'like', "%{$search}%");
            })
            ->with(['payments.studentFee'])
            ->limit(10)
            ->get()
            ->map(function ($s) {
                $requestedPaymentIds = RefundRequest::query()
                    ->where('student_id', $s->id)
                    ->whereIn('status', ['pending', 'approved'])
                    ->pluck('reason')
                    ->map(fn(string $reason) => (int) ($this->extractTaggedValue($reason, 'PAYMENT_ID') ?: 0))
                    ->filter()
                    ->values()
                    ->all();

                return [
                    'id' => $s->id,
                    'full_name' => $s->full_name,
                    'lrn' => $s->lrn,
                    'program' => $s->program,
                    'year_level' => $s->year_level,
                    'payments' => $s->payments
                        ->where('amount', '>', 0)
                        ->sortByDesc(fn($payment) => $payment->payment_date?->timestamp ?? $payment->created_at?->timestamp)
                        ->values()
                        ->map(fn($payment) => [
                            'id' => $payment->id,
                            'student_fee_id' => $payment->student_fee_id,
                            'or_number' => $payment->or_number,
                            'amount' => (float) $payment->amount,
                            'payment_date' => $payment->payment_date?->format('Y-m-d') ?? $payment->created_at?->format('Y-m-d'),
                            'payment_mode' => strtoupper((string) ($payment->payment_method ?: $payment->payment_mode ?: 'cash')),
                            'school_year' => $payment->studentFee?->school_year,
                            'already_requested' => in_array((int) $payment->id, $requestedPaymentIds, true),
                        ]),
                ];
            });

        return response()->json($students);
    }

    /**
     * Store new refund request(s) created by accounting, one per selected payment OR.
     */
    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'student_id' => 'required|exists:students,id',
            'payment_ids' => 'required|array|min:1',
            'payment_ids.*' => 'required|integer|exists:student_payments,id',
            'reason' => 'required|string|max:1000',
        ]);

        $payments = StudentPayment::query()
            ->with('studentFee:id,school_year')
            ->where('student_id', $validated['student_id'])
            ->whereIn('id', $validated['payment_ids'])
            ->where('amount', '>', 0)
            ->get();

        if ($payments->count() !== count($validated['payment_ids'])) {
            return back()->withErrors([
                'payment_ids' => 'One or more selected payment transactions are invalid for this student.',
            ]);
        }

        $created = 0;
        $skipped = 0;

        foreach ($payments as $payment) {
            if ($this->hasPendingOrApprovedRefundForPayment((int) $validated['student_id'], (int) $payment->id)) {
                $skipped++;
                continue;
            }

            $orNumber = trim((string) ($payment->or_number ?: ('PAYMENT-' . $payment->id)));

            RefundRequest::create([
                'student_id' => $validated['student_id'],
                'student_fee_id' => $payment->student_fee_id,
                'type' => 'refund',
                'amount' => abs((float) $payment->amount),
                'reason' => trim($validated['reason']) . " [OR:{$orNumber}] [PAYMENT_ID:{$payment->id}]",
                'status' => 'pending',
            ]);
            $created++;
        }

        if ($created === 0) {
            return back()->withErrors([
                'payment_ids' => 'Selected transaction(s) already have a pending or approved refund request.',
            ]);
        }

        $message = "{$created} refund request(s) created successfully.";
        if ($skipped > 0) {
            $message .= " {$skipped} duplicate transaction(s) were skipped.";
        }

        return back()->with('success', $message);
    }

    /**
     * Approve a refund request.
     */
    public function approve(Request $request, RefundRequest $refund): RedirectResponse
    {
        abort_if($refund->status !== 'pending', 422, 'Only pending requests can be approved.');

        $validated = $request->validate([
            'accounting_notes' => 'nullable|string|max:1000',
        ]);

        DB::transaction(function () use ($refund, $validated) {
            $processedAt = now();

            $refund->update([
                'status'           => 'approved',
                'processed_by'     => Auth::id(),
                'processed_at'     => $processedAt,
                'accounting_notes' => $validated['accounting_notes'] ?? null,
            ]);

            if ($refund->student_fee_id) {
                $fee = StudentFee::find($refund->student_fee_id);

                if ($fee) {
                    $originalOrNumber = $this->extractTaggedValue((string) $refund->reason, 'OR');
                    $resolvedRefundOrNumber = trim((string) ($originalOrNumber ?: ('RF-' . $refund->id)));

                    StudentPayment::create([
                        'student_id' => $refund->student_id,
                        'student_fee_id' => $fee->id,
                        'payment_date' => $processedAt->toDateString(),
                        'or_number' => $resolvedRefundOrNumber,
                        'amount' => -abs((float) $refund->amount),
                        // Keep enum-safe payment_for value and move descriptive text to notes.
                        'payment_for' => 'other',
                        'payment_mode' => 'CASH',
                        'payment_method' => 'cash',
                        'notes' => trim('REFUND approved' . ($originalOrNumber ? ' for OR ' . $originalOrNumber : '') . ' - ' . ($refund->accounting_notes ?: $this->stripReasonTags((string) $refund->reason))),
                        'recorded_by' => Auth::id(),
                    ]);

                    $fee->refresh();
                    $fee->updateBalance();
                }
            }
        });

        return back()->with('success', 'Refund request approved and fees adjusted.');
    }

    /**
     * Reject a refund request.
     */
    public function reject(Request $request, RefundRequest $refund): RedirectResponse
    {
        abort_if($refund->status !== 'pending', 422, 'Only pending requests can be rejected.');

        $validated = $request->validate([
            'accounting_notes' => 'nullable|string|max:1000',
        ]);

        $refund->update([
            'status'           => 'rejected',
            'processed_by'     => Auth::id(),
            'processed_at'     => now(),
            'accounting_notes' => $validated['accounting_notes'] ?? null,
        ]);

        return back()->with('success', 'Refund request rejected.');
    }

    private function hasPendingOrApprovedRefundForPayment(int $studentId, int $paymentId): bool
    {
        return RefundRequest::query()
            ->where('student_id', $studentId)
            ->whereIn('status', ['pending', 'approved'])
            ->where('reason', 'like', '%[PAYMENT_ID:' . $paymentId . ']%')
            ->exists();
    }

    private function extractTaggedValue(string $text, string $tag): ?string
    {
        $pattern = '/\[' . preg_quote($tag, '/') . ':([^\]]+)\]/i';
        if (preg_match($pattern, $text, $matches) === 1) {
            return trim((string) ($matches[1] ?? ''));
        }

        return null;
    }

    private function stripReasonTags(string $text): string
    {
        return trim((string) preg_replace('/\s*\[(OR|PAYMENT_ID|OTX|TXN):[^\]]+\]\s*/i', ' ', $text));
    }
}
