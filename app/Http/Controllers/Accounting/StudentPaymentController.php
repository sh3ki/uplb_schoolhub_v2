<?php

namespace App\Http\Controllers\Accounting;

use App\Http\Controllers\Controller;
use App\Models\BalanceAdjustment;
use App\Models\Department;
use App\Models\DocumentRequest;
use App\Models\EnrollmentClearance;
use App\Models\Grant;
use App\Models\GrantRecipient;
use App\Models\PromissoryNote;
use App\Models\Student;
use App\Models\StudentActionLog;
use App\Models\StudentFee;
use App\Models\OnlineTransaction;
use App\Models\StudentPayment;
use App\Models\AppSetting;
use Illuminate\Database\QueryException;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class StudentPaymentController extends Controller
{
    /**
     * Display Payment Processing dashboard.
     * Shows list of students with payment details and tabs for each student.
     */
    public function index(Request $request): Response
    {
        $selectedStudentId = $request->input('student_id');
        $activeSchoolYear = AppSetting::current()?->school_year ?? (date('Y') . '-' . (date('Y') + 1));

        // Auto-apply overdue status when due date is reached.
        StudentFee::syncOverdueByDueDate($activeSchoolYear);

        // Get students from student-accounts (registrar-cleared, in accounting queue or beyond)
        $query = Student::with(['department', 'enrollmentClearance'])
            ->withoutTransferredOut()
            ->withoutDropped()
            ->whereHas('enrollmentClearance', function ($q) {
                $q->where('registrar_clearance', true);
            })
            ->whereNotIn('enrollment_status', ['not-enrolled', 'pending-registrar']);

        // Search
        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('first_name', 'like', "%{$search}%")
                  ->orWhere('last_name', 'like', "%{$search}%")
                  ->orWhere('lrn', 'like', "%{$search}%");
            });
        }

        // Filter by enrollment status
        if ($status = $request->input('enrollment_status')) {
            $query->where('enrollment_status', $status);
        }

        $students = $query->latest()->paginate(20)->withQueryString();

        // Transform students for list — aggregate ALL school years to match process page logic
        $students->through(function ($student) use ($activeSchoolYear) {
            $targetSchoolYear = $student->school_year ?: $activeSchoolYear;
            // Use registrar-assigned student year (fallback to active app year) for consistent billing.
            $currentFee = $this->calculateFeesForSchoolYear($student, $targetSchoolYear);
            $totalFees = (float) ($currentFee['total_amount'] ?? 0);
            $discounts = (float) ($currentFee['grant_discount'] ?? 0);
            $totalPaid = (float) ($currentFee['total_paid'] ?? 0);
            $balance   = (float) ($currentFee['balance'] ?? max(0, $totalFees - $discounts - $totalPaid));

            // Determine status
            $status = 'pending';

            // Check for approved promissory notes
            $hasApprovedPromissory = PromissoryNote::where('student_id', $student->id)
                ->where('status', 'approved')
                ->exists();

            if ($totalFees > 0 && $balance <= 0) {
                $status = 'fully_paid';
            } elseif ($hasApprovedPromissory) {
                $status = 'approved';
            } elseif (($currentFee['is_overdue'] ?? false) && $totalPaid <= 0) {
                $status = 'overdue';
            }

            return [
                'id' => $student->id,
                'full_name' => $student->full_name,
                'first_name' => $student->first_name,
                'last_name' => $student->last_name,
                'lrn' => $student->lrn,
                'student_photo_url' => $student->student_photo_url,
                'program' => $student->program,
                'year_level' => $student->year_level,
                'section' => $student->section,
                'department' => $student->department?->name,
                'enrollment_status' => $student->enrollment_status,
                'enrollment_progress' => $student->enrollmentClearance,
                'total_fees' => $totalFees,
                'discounts' => $discounts,
                'total_paid' => $totalPaid,
                'balance' => $balance,
                'status' => $status,
            ];
        });

        $selectedStudent = null;
        $paymentData = null;

        // If a student is selected, load their full payment details
        if ($selectedStudentId) {
            $selectedStudent = Student::with(['department', 'enrollmentClearance'])
                ->withoutTransferredOut()
                ->find($selectedStudentId);
            
            if ($selectedStudent) {
                // Get all student fees (current and previous years)
                $studentFees = StudentFee::where('student_id', $selectedStudentId)
                    ->with('payments')
                    ->orderBy('school_year', 'desc')
                    ->get();

                // Get promissory notes
                $promissoryNotes = PromissoryNote::where('student_id', $selectedStudentId)
                    ->with(['approvedBy'])
                    ->orderBy('date_submitted', 'desc')
                    ->get();

                // Get payment transactions
                $transactions = StudentPayment::where('student_id', $selectedStudentId)
                    ->with(['recordedBy', 'studentFee'])
                    ->orderBy('payment_date', 'desc')
                    ->orderBy('created_at', 'desc')
                    ->get();

                // Calculate current and previous balances
                $currentYear = $selectedStudent->school_year
                    ?? \App\Models\AppSetting::current()?->school_year
                    ?? date('Y') . '-' . (date('Y') + 1);
                $currentFee = $studentFees->firstWhere('school_year', $currentYear);
                $previousFees = $studentFees->where('school_year', '!=', $currentYear);

                // Recalculate current year dynamically for accuracy (also syncs student_fees record)
                $freshFeeData = $this->calculateFeesForSchoolYear($selectedStudent, $currentYear);

                $paymentData = [
                    'student' => [
                        'id' => $selectedStudent->id,
                        'full_name' => $selectedStudent->full_name,
                        'lrn' => $selectedStudent->lrn,
                        'program' => $selectedStudent->program,
                        'year_level' => $selectedStudent->year_level,
                        'section' => $selectedStudent->section,
                        'department' => $selectedStudent->department?->name,
                        'classification' => $selectedStudent->department?->classification,
                        'enrollment_status' => $selectedStudent->enrollment_status,
                        'student_photo_url' => $selectedStudent->student_photo_url,
                    ],
                    'current_fee' => $freshFeeData ? [
                        'id' => $freshFeeData['id'],
                        'school_year' => $currentYear,
                        'total_amount' => $freshFeeData['total_amount'],
                        'grant_discount' => $freshFeeData['grant_discount'],
                        'total_paid' => $freshFeeData['total_paid'],
                        'balance' => $freshFeeData['balance'],
                        'is_overdue' => $freshFeeData['is_overdue'],
                        'due_date' => $freshFeeData['due_date'],
                        'categories' => $freshFeeData['categories'] ?? [],
                    ] : null,
                    'previous_balance' => $previousFees->sum('balance'),
                    'total_balance' => ($freshFeeData['balance'] ?? 0) + $previousFees->sum('balance'),
                    'school_year_fees' => $studentFees->map(function ($fee) {
                        return [
                            'id' => $fee->id,
                            'school_year' => $fee->school_year,
                            'registration_fee' => $fee->registration_fee,
                            'tuition_fee' => $fee->tuition_fee,
                            'misc_fee' => $fee->misc_fee,
                            'books_fee' => $fee->books_fee,
                            'other_fees' => $fee->other_fees,
                            'total_amount' => $fee->total_amount,
                            'grant_discount' => $fee->grant_discount,
                            'total_paid' => $fee->total_paid,
                            'balance' => $fee->balance,
                            'payments' => $fee->payments->map(function ($payment) {
                                return [
                                    'id' => $payment->id,
                                    'payment_date' => $payment->payment_date,
                                    'or_number' => $payment->or_number,
                                    'amount' => $payment->amount,
                                    'payment_for' => $payment->payment_for,
                                    'notes' => $payment->notes,
                                ];
                            }),
                        ];
                    }),
                    'promissory_notes' => $promissoryNotes->map(function ($note) {
                        return [
                            'id' => $note->id,
                            'date_submitted' => $note->date_submitted,
                            'due_date' => $note->due_date,
                            'amount' => $note->amount,
                            'reason' => $note->reason,
                            'notes' => $note->notes,
                            'status' => $note->status,
                            'approved_by' => $note->approvedBy?->name,
                            'approved_at' => $note->approved_at,
                            'document_url' => $note->document_url,
                        ];
                    }),
                    'transactions' => $transactions->map(function ($transaction) {
                        $normalizedMode = strtoupper((string) ($transaction->payment_mode ?? $transaction->payment_method ?? 'CASH'));
                        if ($normalizedMode === 'BANK_TRANSFER') {
                            $normalizedMode = 'BANK';
                        }

                        $displayOrNumber = $this->resolveRefundDisplayOrNumber(
                            $transaction->or_number,
                            (float) $transaction->amount,
                            (string) ($transaction->notes ?? '')
                        );

                        return [
                            'id' => $transaction->id,
                            'date_time' => $transaction->payment_date . ' ' . $transaction->created_at->format('H:i A'),
                            'payment_date' => $transaction->payment_date,
                            'or_number' => $displayOrNumber,
                            'mode' => $normalizedMode,
                            'reference' => $transaction->reference_number ?? 'N/A',
                            'amount' => $transaction->amount,
                            'school_year' => $transaction->studentFee?->school_year,
                            'applied_to' => $transaction->payment_for,
                            'cashier' => $transaction->recordedBy?->name,
                            'notes' => $transaction->notes,
                        ];
                    }),
                ];
            }
        }

        // Calculate aggregate financial statistics for all students
        $studentRows = collect($students->items());
        $totalTuitionFees = (float) $studentRows->sum('total_fees');
        $totalGrantDiscounts = (float) $studentRows->sum('discounts');
        $totalPaidCollected = (float) $studentRows->sum('total_paid');
        $totalBalanceToPay = (float) $studentRows->sum('balance');

        return Inertia::render($this->viewPrefix() . '/payments/index', [
            'students' => $students,
            'selectedStudent' => $paymentData,
            'filters' => $request->only(['search', 'enrollment_status', 'student_id']),
            'statistics' => [
                'original_tuition' => $totalTuitionFees,
                'grant_deduction' => $totalGrantDiscounts,
                'total_tuition_fees' => $totalTuitionFees - $totalGrantDiscounts,
                'total_paid' => $totalPaidCollected,
                'previous_balance' => 0,
                'total_balance_to_pay' => $totalBalanceToPay,
            ],
        ]);
    }

    /**
     * Export payments data.
     */
    public function export(Request $request)
    {
        $type = $request->input('type', 'excel');
        
        // For now, return a simple response
        // Later implement with Laravel Excel or similar
        return response()->json([
            'message' => 'Export functionality - implement with Laravel Excel package',
            'type' => $type,
        ]);
    }

    /**
     * Store a newly created payment.
     */
    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'student_id' => 'required|exists:students,id',
            'student_fee_id' => 'required|exists:student_fees,id',
            'payment_date' => 'required|date',
            'or_number' => 'nullable|string|max:255',
            'amount' => 'required|numeric|min:0.01',
            'payment_mode' => 'nullable|in:CASH,GCASH,BANK',
            'reference_number' => 'nullable|string|max:255',
            'bank_name' => 'nullable|string|max:255',
            'payment_for' => 'nullable|in:registration,tuition,misc,books,other',
            'notes' => 'nullable|string',
        ]);

        $validated['recorded_by'] = $request->user()->id;

        $studentFee = StudentFee::findOrFail($validated['student_fee_id']);
        if ((int) $studentFee->student_id !== (int) $validated['student_id']) {
            return redirect()->back()->with('error', 'Selected fee record does not belong to the selected student.');
        }

        StudentPayment::create($validated);

        // Update the student fee balance
        $studentFee->updateBalance();

        return redirect()->back()->with('success', 'Payment recorded successfully.');
    }

    /**
     * Update the specified payment.
     */
    public function update(Request $request, StudentPayment $payment): RedirectResponse
    {
        $validated = $request->validate([
            'payment_date' => 'required|date',
            'or_number' => 'nullable|string|max:255',
            'amount' => 'required|numeric|min:0.01',
            'payment_for' => 'nullable|in:registration,tuition,misc,books,other',
            'notes' => 'nullable|string',
        ]);

        $payment->update($validated);

        return redirect()->back()->with('success', 'Payment updated successfully.');
    }

    /**
     * Remove the specified payment.
     */
    public function destroy(StudentPayment $payment): RedirectResponse
    {
        $payment->delete();

        return redirect()->back()->with('success', 'Payment deleted successfully.');
    }

    /**
     * Show payment form for a specific student.
     */
    public function create(Request $request): Response
    {
        $studentId = $request->input('student_id');
        $student = null;
        $fees = collect();

        if ($studentId) {
            $student = \App\Models\Student::with('fees')
                ->withoutTransferredOut()
                ->findOrFail($studentId);
            $fees = $student->fees;
        }

        return Inertia::render($this->viewPrefix() . '/payments/create', [
            'student' => $student,
            'fees' => $fees,
        ]);
    }

    /**
     * Show payment processing page for a specific student.
     * Fees are calculated DYNAMICALLY from fee_items table.
     */
    public function process(Request $request, Student $student): Response
    {
        $isCurrentlyTransferredOut = !$student->is_active
            && $student->enrollment_status === 'dropped'
            && $student->transferRequests()
                ->whereNotNull('finalized_at')
                ->exists();

        if ($isCurrentlyTransferredOut) {
            abort(404);
        }

        // Load student with department for classification matching
        $student->load(['department', 'enrollmentClearance']);

        $requestedSchoolYear = $request->input('school_year');
        if ($requestedSchoolYear === 'all' || blank($requestedSchoolYear)) {
            $requestedSchoolYear = null;
        }

        $defaultSchoolYear = $student->school_year
            ?: (\App\Models\AppSetting::current()?->school_year
                ?: date('Y') . '-' . (date('Y') + 1));

        $activeSchoolYear = trim((string) ($requestedSchoolYear ?: $defaultSchoolYear));

        // Keep this student's active school-year status in sync with due date rules.
        StudentFee::syncOverdueByDueDate($activeSchoolYear);

        $fees = collect();

        if ($requestedSchoolYear) {
            $yearsToLoad = collect([$activeSchoolYear]);
        } else {
            $yearsToLoad = collect($this->getApplicableSchoolYears($student));

            if ($yearsToLoad->isEmpty()) {
                $yearsToLoad = collect([$activeSchoolYear]);
            }
        }

        $yearsToLoad
            ->filter()
            ->unique()
            ->sortDesc()
            ->values()
            ->each(function (string $year) use ($student, &$fees) {
                StudentFee::syncOverdueByDueDate($year);
                $feeData = $this->calculateFeesForSchoolYear($student, $year);
                if ($feeData) {
                    $fees->push($feeData);
                }
            });

        if ($fees->isEmpty() && !$requestedSchoolYear) {
            $preferredFeeYear = StudentFee::where('student_id', $student->id)
                ->where(function ($query) {
                    $query->where('total_amount', '>', 0)
                        ->orWhere('balance', '>', 0)
                        ->orWhere('total_paid', '>', 0);
                })
                ->orderByDesc('school_year')
                ->value('school_year');

            if ($preferredFeeYear && $preferredFeeYear !== $activeSchoolYear) {
                $activeSchoolYear = $preferredFeeYear;
                StudentFee::syncOverdueByDueDate($activeSchoolYear);
                $feeData = $this->calculateFeesForSchoolYear($student, $activeSchoolYear);
                if ($feeData) {
                    $fees->push($feeData);
                }
            }
        }

        // Normalize and keep only one canonical row per school year.
        $fees = $fees
            ->map(function ($fee) {
                $fee['school_year'] = trim((string) ($fee['school_year'] ?? ''));
                return $fee;
            })
            ->filter(fn ($fee) => $fee['school_year'] !== '')
            ->groupBy('school_year')
            ->map(function ($rows) {
                return $rows
                    ->sortByDesc(function ($row) {
                        $processedAt = (string) ($row['processed_at'] ?? '');
                        return strtotime($processedAt) ?: 0;
                    })
                    ->values()
                    ->first();
            })
            ->sortByDesc('school_year', SORT_NATURAL)
            ->values();

        // Get payments for the active billing year only.
            // Active-year fee payments for summary computation.
            $activeYearPayments = (float) StudentPayment::where('student_id', $student->id)
                ->whereHas('studentFee', function ($query) use ($activeSchoolYear) {
                    $query->where('school_year', $activeSchoolYear);
                })
                ->sum('amount');

            // Include verified/completed student-portal payments that are not yet linked to a StudentPayment row.
            $activeYearPayments += $this->getUnlinkedOnlineTransactionAmount($student, $activeSchoolYear);

            // Transaction history should include all student fee payments and paid document requests.
            $feeTransactions = StudentPayment::where('student_id', $student->id)
                ->with(['recordedBy', 'studentFee'])
                ->orderBy('payment_date', 'desc')
                ->get()
                ->map(function ($payment) {
                    $normalizedMode = strtoupper((string) ($payment->payment_mode ?? $payment->payment_method ?? 'CASH'));
                    if ($normalizedMode === 'BANK_TRANSFER') {
                        $normalizedMode = 'BANK';
                    }

                    $displayOrNumber = $this->resolveRefundDisplayOrNumber(
                        $payment->or_number,
                        (float) $payment->amount,
                        (string) ($payment->notes ?? '')
                    );

                    return [
                        'id' => $payment->id,
                        'payment_date' => $payment->payment_date,
                        'or_number' => $displayOrNumber,
                        'amount' => (float) $payment->amount,
                        'payment_for' => $payment->payment_for,
                        'payment_mode' => $normalizedMode,
                        'bank_name' => $payment->bank_name,
                        'notes' => $payment->notes,
                        'recorded_by' => $payment->recordedBy?->name,
                        'school_year' => $payment->studentFee?->school_year,
                        'created_at' => $payment->created_at->format('h:i A'),
                        'sort_at' => $payment->created_at->timestamp,
                        'type' => 'on-site',
                        'transaction_type' => 'fee',
                    ];
                });

            $documentTransactions = DocumentRequest::where('student_id', $student->id)
                ->where('is_paid', true)
                ->where('accounting_status', 'approved')
                ->get()
                ->map(function ($request) {
                    $mode = strtoupper((string) ($request->payment_type ?: 'CASH'));
                    if ($mode === 'BANK_TRANSFER') {
                        $mode = 'BANK';
                    }
                    $dateTime = $request->accounting_approved_at
                        ?: $request->updated_at
                        ?: $request->created_at;

                    return [
                        'id' => 'document-' . $request->id,
                        'payment_date' => ($dateTime ?: now())->format('Y-m-d'),
                        'or_number' => $request->or_number,
                        'amount' => (float) $request->fee,
                        'payment_for' => $request->document_type_label ?: 'document',
                        'payment_mode' => $mode,
                        'bank_name' => $mode === 'BANK' ? $request->bank_name : null,
                        'notes' => 'Document request payment',
                        'recorded_by' => $request->accountingApprovedBy?->name ?? 'N/A',
                        'school_year' => null,
                        'created_at' => ($dateTime ?: now())->format('h:i A'),
                        'sort_at' => ($dateTime ?: now())->timestamp,
                        'transaction_type' => 'document',
                    ];
                });

            $payments = $feeTransactions
                ->concat($documentTransactions)
                ->sortByDesc('sort_at')
                ->values();

        // Include online transactions in the payment history.
        $onlineTransactions = OnlineTransaction::where('student_id', $student->id)
            ->whereIn('status', ['completed', 'verified', 'refunded'])
            ->whereNull('student_payment_id')
            ->with(['verifiedBy', 'payment.recordedBy'])
            ->orderBy('transaction_date', 'desc')
            ->get()
            ->map(function ($tx) {
                $rawMethod = strtolower((string) ($tx->payment_method ?? 'online'));
                if ($rawMethod === 'bank_transfer') $rawMethod = 'bank';
                $paymentMode = strtoupper($rawMethod);
                $sortDateTime = $tx->transaction_date ?: $tx->created_at;
                $amount = (float) $tx->amount;
                if ($tx->status === 'refunded') {
                    $amount = -abs($amount);
                }
                return [
                    'id' => $tx->id + 1000000, // offset to avoid ID collision with StudentPayment
                    'payment_date' => $tx->transaction_date?->format('Y-m-d') ?? $tx->created_at->format('Y-m-d'),
                    'or_number' => $tx->transaction_id,
                    'amount' => $amount,
                    'payment_for' => 'Online Payment (' . ucfirst($tx->status) . ')',
                    'payment_mode' => $paymentMode,
                    'bank_name' => $tx->bank_name,
                    'notes' => $tx->remarks,
                    'recorded_by' => $tx->payment?->recordedBy?->name ?? $tx->verifiedBy?->name ?? 'Online',
                    'school_year' => null,
                    'created_at' => $sortDateTime->format('h:i A'),
                    'sort_at' => $sortDateTime->timestamp,
                    'type' => 'online',
                    'transaction_type' => $tx->status === 'refunded' ? 'refund' : 'fee',
                ];
            });

        $existingRefundOrNumbers = collect($feeTransactions)
            ->filter(function ($row) {
                $amount = (float) ($row['amount'] ?? 0);
                $notes = strtolower((string) ($row['notes'] ?? ''));

                return $amount < 0 || str_contains($notes, 'refund');
            })
            ->pluck('or_number')
            ->filter()
            ->map(fn ($or) => $this->normalizeReferenceNumber($or))
            ->filter()
            ->values()
            ->all();

        $existingOnlineRefundReferences = collect($onlineTransactions)
            ->filter(fn ($row) => (($row['transaction_type'] ?? '') === 'refund'))
            ->pluck('or_number')
            ->filter()
            ->map(fn ($or) => $this->normalizeReferenceNumber($or))
            ->filter()
            ->values()
            ->all();

        $refundTransactions = \App\Models\RefundRequest::where('student_id', $student->id)
            ->where('status', 'approved')
            ->with(['processedBy', 'studentFee'])
            ->orderByDesc('processed_at')
            ->get()
            ->map(function ($refund) {
                $processedAt = $refund->processed_at ?: $refund->updated_at ?: $refund->created_at;
                $rawReason = (string) ($refund->reason ?? '');

                $originalOrNumber = $this->extractTaggedValue($rawReason, 'OR');
                $transactionReference = $this->extractTaggedValue($rawReason, 'TXN');
                $paymentReferenceId = $this->extractTaggedValue($rawReason, 'PAYMENT_ID');

                $displayOrNumber = $originalOrNumber
                    ?: ($transactionReference ?: ('RF-' . $refund->id));

                $refundNotes = $refund->accounting_notes ?: $this->stripReasonTags($rawReason);

                return [
                    'id' => 2000000 + $refund->id,
                    'payment_date' => ($processedAt ?: now())->format('Y-m-d'),
                    'or_number' => $displayOrNumber,
                    'amount' => -abs((float) $refund->amount),
                    'payment_for' => strtoupper($refund->type) . ' APPROVED',
                    'payment_mode' => 'REFUND',
                    'bank_name' => null,
                    'notes' => $refundNotes,
                    'recorded_by' => $refund->processedBy?->name ?? 'Accounting',
                    'school_year' => $refund->studentFee?->school_year,
                    'created_at' => ($processedAt ?: now())->format('h:i A'),
                    'sort_at' => ($processedAt ?: now())->timestamp,
                    'type' => 'on-site',
                    'transaction_type' => 'refund',
                    'txn_reference' => $transactionReference,
                    'payment_reference_id' => $paymentReferenceId,
                ];
            })
            ->filter(function ($refundTx) use ($existingRefundOrNumbers, $existingOnlineRefundReferences) {
                $orNumber = $this->normalizeReferenceNumber($refundTx['or_number'] ?? null);
                $txnReference = $this->normalizeReferenceNumber($refundTx['txn_reference'] ?? null);

                // Avoid duplicate refund rows when equivalent negative StudentPayment or refunded online rows already exist.
                if ($orNumber !== null && in_array($orNumber, $existingRefundOrNumbers, true)) {
                    return false;
                }

                if ($txnReference !== null && in_array($txnReference, $existingOnlineRefundReferences, true)) {
                    return false;
                }

                return true;
            })
            ->values();

        // Merge on-site and online payments, sorted by date descending.
        $payments = $payments
            ->concat($onlineTransactions)
            ->concat($refundTransactions)
            ->sortByDesc('sort_at')
            ->map(function ($row) {
                unset($row['txn_reference'], $row['payment_reference_id']);
                unset($row['sort_at']);
                return $row;
            })
            ->values();

        // Get promissory notes for the active billing year only.
        $promissoryNotes = \App\Models\PromissoryNote::where('student_id', $student->id)
            ->whereHas('studentFee', function ($query) use ($activeSchoolYear) {
                $query->where('school_year', $activeSchoolYear);
            })
            ->with(['studentFee', 'reviewer'])
            ->orderBy('submitted_date', 'desc')
            ->get()
            ->map(function ($note) {
                return [
                    'id' => $note->id,
                    'student_fee_id' => $note->student_fee_id,
                    'submitted_date' => $note->submitted_date->format('Y-m-d'),
                    'due_date' => $note->due_date->format('Y-m-d'),
                    'amount' => $note->amount !== null ? (float) $note->amount : null,
                    'reason' => $note->reason,
                    'status' => $note->status,
                    'school_year' => $note->studentFee?->school_year,
                    'reviewed_by' => $note->reviewer?->name,
                    'reviewed_at' => $note->reviewed_at?->format('Y-m-d H:i'),
                    'review_notes' => $note->review_notes,
                ];
            });

        // Calculate summary stats using active school year (current focus in process page).
        $activeFeeRow = $fees->first(function ($fee) use ($activeSchoolYear) {
            return trim((string) ($fee['school_year'] ?? '')) === trim((string) $activeSchoolYear);
        });

        if (!$activeFeeRow) {
            $activeFeeRow = $fees->first();
        }

        $totalFees = (float) ($activeFeeRow['total_amount'] ?? 0);
        $totalDiscount = (float) ($activeFeeRow['grant_discount'] ?? 0);
        $totalPaid = (float) ($activeFeeRow['total_paid'] ?? 0);
        
        // Calculate previous balance (from school years before the student's latest enrolled year)
        $currentFeesBalance = (float) ($activeFeeRow['balance'] ?? 0);

        $previousBalance = (float) StudentFee::where('student_id', $student->id)
            ->whereRaw('TRIM(school_year) != ?', [trim((string) $activeSchoolYear)])
            ->sum('balance');
        
        $summary = [
            'total_fees' => $totalFees,
            'total_discount' => $totalDiscount,
            'total_paid' => $totalPaid,
            'total_balance' => (float) ($activeFeeRow['balance'] ?? 0),
            'previous_balance' => $previousBalance,
            'current_fees_balance' => $currentFeesBalance,
        ];

        // Get grants/scholarships for the active billing year.
        $grants = $this->getGrantRecipientsForFeeYear($student, $activeSchoolYear)
            ->map(function ($recipient) {
                return [
                    'id' => $recipient->id,
                    'name' => $recipient->grant->name,
                    'discount_amount' => (float) $recipient->discount_amount,
                    'school_year' => $recipient->school_year,
                    'status' => $recipient->status,
                ];
            });

        // Get balance adjustments for this student
        $balanceAdjustments = BalanceAdjustment::where('student_id', $student->id)
            ->with('adjuster:id,name')
            ->orderByDesc('created_at')
            ->get()
            ->map(function ($adj) {
                return [
                    'id' => $adj->id,
                    'amount' => (float) $adj->amount,
                    'reason' => $adj->reason,
                    'school_year' => $adj->school_year,
                    'notes' => $adj->notes,
                    'adjusted_by' => $adj->adjuster?->name,
                    'created_at' => $adj->created_at->format('M d, Y h:i A'),
                ];
            });

        $paymentFeeOptions = StudentFee::where('student_id', $student->id)
            ->orderByDesc('school_year')
            ->orderByDesc('processed_at')
            ->orderByDesc('id')
            ->get()
            ->map(function ($fee) {
                return [
                    'id' => $fee->id,
                    'school_year' => trim((string) $fee->school_year),
                    'total_amount' => (float) $fee->total_amount,
                    'balance' => (float) $fee->balance,
                ];
            })
            ->filter(fn ($fee) => $fee['school_year'] !== '')
            ->groupBy('school_year')
            ->map(fn ($rows) => $rows->first())
            ->values();

        $feeEditRows = StudentActionLog::where('student_id', $student->id)
            ->whereIn('action_type', ['fee_edit', 'fee_add'])
            ->whereNotNull('changes')
            ->with('performer:id,name')
            ->orderByDesc('created_at')
            ->get()
            ->map(function ($log) {
                $changes = is_array($log->changes) ? $log->changes : [];
                $new = is_array($changes['new'] ?? null) ? $changes['new'] : null;

                $schoolYear = (string) ($new['school_year'] ?? ($changes['school_year'] ?? ''));
                $reason = (string) ($new['reason'] ?? ($changes['reason'] ?? ''));
                $notes = (string) ($new['notes'] ?? ($changes['notes'] ?? ($log->notes ?? '')));
                $processedBy = (string) ($new['processed_by'] ?? ($changes['processed_by'] ?? ($log->performer?->name ?? '-')));
                $processedAt = (string) ($new['processed_at'] ?? ($changes['processed_at'] ?? $log->created_at?->format('Y-m-d H:i:s')));

                if (!$new && $schoolYear === '') {
                    return null;
                }

                $totalAmount = (float) ($new['total_amount']
                    ?? $changes['total_amount']
                    ?? $changes['new_total_amount']
                    ?? 0);

                $grantDiscount = (float) ($new['grant_discount']
                    ?? $changes['grant_discount']
                    ?? 0);

                $totalPaid = (float) ($new['total_paid']
                    ?? $changes['total_paid']
                    ?? 0);

                $derivedBalance = max(0.0, $totalAmount - $grantDiscount - $totalPaid);

                $balance = (float) ($new['balance']
                    ?? $changes['balance']
                    ?? $changes['new_balance']
                    ?? $derivedBalance);

                $status = (string) ($new['status']
                    ?? $changes['status']
                    ?? ($balance <= 0 && $totalAmount > 0 ? 'paid' : ($totalPaid > 0 ? 'partial' : 'unpaid')));

                return [
                    'id' => 'fee-edit-' . $log->id,
                    'school_year' => $schoolYear,
                    'total_amount' => $totalAmount,
                    'grant_discount' => $grantDiscount,
                    'total_paid' => $totalPaid,
                    'balance' => $balance,
                    'status' => $status,
                    'processed_by' => $processedBy,
                    'processed_at' => $processedAt,
                    'reason' => $reason,
                    'notes' => $notes,
                    'is_history' => true,
                ];
            })
            ->filter()
            ->values();

        $latestFeeContextByYear = $feeEditRows
            ->filter(fn ($row) => trim((string) ($row['school_year'] ?? '')) !== '')
            ->groupBy(fn ($row) => trim((string) $row['school_year']))
            ->map(function ($rows) {
                return $rows
                    ->sortByDesc(function ($row) {
                        return strtotime((string) ($row['processed_at'] ?? '')) ?: 0;
                    })
                    ->first();
            });

        $feesWithReasonContext = $fees->map(function ($fee) use ($latestFeeContextByYear) {
            $schoolYear = trim((string) ($fee['school_year'] ?? ''));
            $context = $latestFeeContextByYear->get($schoolYear);

            $processedBy = trim((string) ($fee['processed_by'] ?? ''));
            if ($processedBy === '') {
                $processedBy = trim((string) ($context['processed_by'] ?? '-'));
            }

            $processedAt = trim((string) ($fee['processed_at'] ?? ''));
            if ($processedAt === '') {
                $processedAt = trim((string) ($context['processed_at'] ?? ''));
            }

            $reason = trim((string) ($fee['reason'] ?? ''));
            if ($reason === '') {
                $reason = trim((string) ($context['reason'] ?? ''));
            }

            $notes = trim((string) ($fee['notes'] ?? ''));
            if ($notes === '') {
                $notes = trim((string) ($context['notes'] ?? ''));
            }

            $fee['processed_by'] = $processedBy !== '' ? $processedBy : '-';
            $fee['processed_at'] = $processedAt;
            $fee['reason'] = $reason;
            $fee['notes'] = $notes;

            return $fee;
        });

        // Get cashiers (accounting staff)
        $cashiers = \App\Models\User::where('role', 'accounting')
            ->orderBy('name')
            ->get(['id', 'name']);

        // Get current authenticated user for cashier field
        $currentUser = $request->user();

        return Inertia::render($this->viewPrefix() . '/payments/process', [
            'student' => [
                'id' => $student->id,
                'full_name' => $student->full_name,
                'lrn' => $student->lrn,
                'email' => $student->email,
                'program' => $student->program,
                'year_level' => $student->year_level,
                'section' => $student->section,
                'department' => $student->department?->name,
                'classification' => $student->department?->classification,
                'student_photo_url' => $student->student_photo_url,
                'enrollment_status' => $student->enrollment_status,
            ],
            'fees' => $feesWithReasonContext->values(),
            'payments' => $payments,
            'promissoryNotes' => $promissoryNotes,
            'grants' => $grants,
            'summary' => $summary,
            'currentSchoolYear' => trim((string) $activeSchoolYear),
            'cashiers' => $cashiers,
            'balanceAdjustments' => $balanceAdjustments,
            'paymentFeeOptions' => $paymentFeeOptions,
            'feeEditRows' => $feeEditRows,
            'enrollmentClearance' => $student->enrollmentClearance ? [
                'id' => $student->enrollmentClearance->id,
                'accounting_clearance' => (bool) $student->enrollmentClearance->accounting_clearance,
                'accounting_cleared_at' => $student->enrollmentClearance->accounting_cleared_at?->format('Y-m-d H:i'),
                'accounting_notes' => $student->enrollmentClearance->accounting_notes,
            ] : null,
            'currentUser' => [
                'id' => $currentUser->id,
                'name' => $currentUser->name,
            ],
        ]);
    }

    /**
     * Get all school years that have applicable fee items for this student.
     */
    private function getApplicableSchoolYears(Student $student): array
    {
        // Anchor to registrar-assigned year (fallback to app year).
        $enrolledYear = $student->school_year ?? \App\Models\AppSetting::current()?->school_year;

        $feeItemYears = \App\Models\FeeItem::where('is_active', true)
            ->whereNotNull('school_year')
            ->where(function ($query) use ($student, $enrolledYear) {
                // 'all' scope only if no explicit per-group assignments override it
                $query->where(function ($inner) {
                        $inner->where('assignment_scope', 'all')
                              ->whereDoesntHave('assignments');
                    })
                    // 'specific' scope with at least one direct filter field
                    ->orWhere(function ($q) use ($student) {
                        $q->where('assignment_scope', 'specific')
                          ->where(function ($inner) {
                              $inner->whereNotNull('classification')
                                    ->orWhereNotNull('department_id')
                                    ->orWhereNotNull('program_id')
                                    ->orWhereNotNull('year_level_id')
                                    ->orWhereNotNull('section_id');
                          });
                        $this->applyStudentFilters($q, $student);
                    })
                    // Or items explicitly assigned via the Assignments tab
                    ->orWhereHas('assignments', function ($q) use ($student, $enrolledYear) {
                        $this->applyAssignmentFilters($q, $student, $enrolledYear);
                    });
            })
            ->distinct()
            ->pluck('school_year')
            ->map(fn ($year) => trim((string) $year))
            ->filter();

        // Always include years that already have StudentFee records
        // (preserves existing payment history even if fee items no longer apply)
        $existingYears = StudentFee::where('student_id', $student->id)
            ->pluck('school_year')
            ->map(fn ($year) => trim((string) $year))
            ->filter();

        return $feeItemYears->merge($existingYears)
            ->when($enrolledYear, fn($years) => $years->push($enrolledYear))
            ->unique()
            ->sort()
            ->values()
            ->toArray();
    }

    /**
     * Calculate fees dynamically for a specific school year.
     */
    private function calculateFeesForSchoolYear(Student $student, string $schoolYear): ?array
    {
        $normalizedSchoolYear = trim((string) $schoolYear);

        $existingStudentFee = StudentFee::where('student_id', $student->id)
            ->whereRaw('TRIM(school_year) = ?', [$normalizedSchoolYear])
            ->orderByDesc('processed_at')
            ->orderByDesc('id')
            ->first();

        // Preserve posted or manually edited ledgers.
        if ($existingStudentFee && ($existingStudentFee->payments()->exists() || $existingStudentFee->processed_by !== null)) {
            return $this->buildFeeDataFromStudentFee($student, $existingStudentFee);
        }

        $templateYear = $this->resolveFeeTemplateYear($student, $normalizedSchoolYear);
        if (!$templateYear) {
            if ($existingStudentFee) {
                return $this->buildFeeDataFromStudentFee($student, $existingStudentFee);
            }
            return null;
        }

        // If this student/year has explicit assignment matches, do not also include global all-scope items.
        $hasExplicitAssignmentMatch = \App\Models\FeeItem::where('is_active', true)
            ->where('school_year', $templateYear)
            ->whereHas('assignments', function ($q) use ($student, $schoolYear) {
                $this->applyAssignmentFilters($q, $student, $schoolYear);
                $q->where(function ($yearQuery) use ($schoolYear) {
                    $yearQuery->whereNull('school_year')
                        ->orWhere('school_year', $schoolYear);
                });
            })
            ->exists();

        // Get applicable fee items (exclude Drop category - those are only charged via drop requests).
        // Important: assignment-based items are matched using assignment.school_year,
        // not only fee_items.school_year, to prevent missing assigned tuition rows.
        $feeItems = \App\Models\FeeItem::with('category')
            ->where('is_active', true)
            ->whereDoesntHave('category', function ($q) {
                $q->where('name', 'like', '%Drop%');
            })
            ->where('school_year', $templateYear)
            ->where(function ($query) use ($student, $schoolYear, $hasExplicitAssignmentMatch) {
                if ($hasExplicitAssignmentMatch) {
                    // Strict mode: explicit assignments override all/specific templates.
                    $query->whereHas('assignments', function ($assignmentQuery) use ($student, $schoolYear) {
                        $this->applyAssignmentFilters($assignmentQuery, $student, $schoolYear);
                        $assignmentQuery->where(function ($yearQuery) use ($schoolYear) {
                            $yearQuery->whereNull('school_year')
                                ->orWhere('school_year', $schoolYear);
                        });
                    });

                    return;
                }

                $query->where(function ($inner) {
                    $inner->where('assignment_scope', 'all')
                        ->whereDoesntHave('assignments');
                })->orWhere(function ($specificScope) use ($student) {
                    $specificScope->where('assignment_scope', 'specific')
                        ->where(function ($hasDirectFilters) {
                            $hasDirectFilters->whereNotNull('classification')
                                ->orWhereNotNull('department_id')
                                ->orWhereNotNull('program_id')
                                ->orWhereNotNull('year_level_id')
                                ->orWhereNotNull('section_id');
                        });
                    $this->applyStudentFilters($specificScope, $student);
                });
            })
            ->get();

        if ($feeItems->isEmpty()) {
            if ($existingStudentFee) {
                return $this->buildFeeDataFromStudentFee($student, $existingStudentFee);
            }
            return null;
        }

        // Pre-fetch enrolled units for per-unit tuition calculation
        $enrolledUnits = \App\Models\StudentSubject::where('student_id', $student->id)
            ->where('school_year', $schoolYear)
            ->whereIn('status', ['enrolled'])
            ->join('subjects', 'subjects.id', '=', 'student_subjects.subject_id')
            ->sum('subjects.units');

        // Calculate total from fee items.
        // For per-unit items with zero enrolled units, fall back to selling_price to avoid dropping assigned fees to zero.
        $totalAmount = $feeItems->sum(function ($item) use ($enrolledUnits) {
            if ($item->is_per_unit) {
                if ((float) $enrolledUnits > 0) {
                    return (float) $item->unit_price * (float) $enrolledUnits;
                }
                return (float) $item->selling_price;
            }
            return (float) $item->selling_price;
        });

        // Get grant discount — always recalculate from Grant model so stale discount_amount is never used.
        // For the current school year apply ALL active grants regardless of their school_year label
        // (the form default can cause a year mismatch). For historical years use exact matching.
        $grantRecipients = $this->getGrantRecipientsForFeeYear($student, $schoolYear);
        $grantDiscount = 0.0;
        foreach ($grantRecipients as $recipient) {
            /** @var \App\Models\GrantRecipient $recipient */
            if ($recipient->grant) {
                $calculated = $recipient->grant->calculateDiscount((float) $totalAmount);
                if ((float) $recipient->discount_amount !== $calculated) {
                    $recipient->discount_amount = $calculated;
                    $recipient->save();
                }
                $grantDiscount += $calculated;
            }
        }

        $categoryTotals = $this->deriveStoredCategoryTotals($feeItems, (float) $enrolledUnits);

        // Get or create the student_fees record for tracking payments
        $studentFee = StudentFee::where('student_id', $student->id)
            ->whereRaw('TRIM(school_year) = ?', [$normalizedSchoolYear])
            ->first();

        $isOverdue = $studentFee ? $studentFee->is_overdue : false;
        $dueDate = $studentFee?->due_date;
        $studentFeeId = $studentFee?->id;

        // Total paid = sum of actual payment records (always fresh)
        $totalPaid = $studentFee ? (float) $studentFee->payments()->sum('amount') : 0.0;

        if (!$studentFee) {
            $studentFee = StudentFee::create([
                'student_id'     => $student->id,
                'school_year'    => $normalizedSchoolYear,
                'registration_fee' => $categoryTotals['registration_fee'],
                'tuition_fee' => $categoryTotals['tuition_fee'],
                'misc_fee' => $categoryTotals['misc_fee'],
                'books_fee' => $categoryTotals['books_fee'],
                'other_fees' => $categoryTotals['other_fees'],
                'total_amount'   => $totalAmount,
                'grant_discount' => $grantDiscount,
                'total_paid'     => 0,
                'balance'        => max(0, $totalAmount - $grantDiscount),
            ]);
            $studentFeeId = $studentFee->id;
        } else {
            // Sync stored record: check total_amount, grant_discount, and balance for correctness
            $freshTotal    = (float) $totalAmount;
            $freshDiscount = (float) $grantDiscount;
            $freshBalance  = max(0, $freshTotal - $freshDiscount - $totalPaid);
            if ((float) $studentFee->total_amount   !== $freshTotal
                || (float) $studentFee->grant_discount !== $freshDiscount
                || (float) $studentFee->balance        !== $freshBalance
                || (float) $studentFee->registration_fee !== (float) $categoryTotals['registration_fee']
                || (float) $studentFee->tuition_fee !== (float) $categoryTotals['tuition_fee']
                || (float) $studentFee->misc_fee !== (float) $categoryTotals['misc_fee']
                || (float) $studentFee->books_fee !== (float) $categoryTotals['books_fee']
                || (float) $studentFee->other_fees !== (float) $categoryTotals['other_fees']) {
                $studentFee->registration_fee = $categoryTotals['registration_fee'];
                $studentFee->tuition_fee = $categoryTotals['tuition_fee'];
                $studentFee->misc_fee = $categoryTotals['misc_fee'];
                $studentFee->books_fee = $categoryTotals['books_fee'];
                $studentFee->other_fees = $categoryTotals['other_fees'];
                $studentFee->total_amount    = $freshTotal;
                $studentFee->total_paid      = $totalPaid;
                $studentFee->grant_discount  = $freshDiscount;
                $studentFee->balance         = $freshBalance;
                $studentFee->save();
            }
        }

        // Calculate balance
        $balance = max(0, $totalAmount - $grantDiscount - $totalPaid);

        // Group items by category
        $itemsByCategory = $feeItems->groupBy('fee_category_id')->map(function ($items, $categoryId) use ($enrolledUnits) {
            $category = $items->first()->category;
            return [
                'category_id'   => $categoryId,
                'category_name' => $category->name ?? 'Other',
                'items'         => $items->map(function ($item) use ($enrolledUnits) {
                    $amount = (float) $item->selling_price;
                    if ($item->is_per_unit) {
                        $amount = (float) $enrolledUnits > 0
                            ? (float) $item->unit_price * (float) $enrolledUnits
                            : (float) $item->selling_price;
                    }
                    return [
                        'id'           => $item->id,
                        'name'         => $item->name,
                        'amount'       => $amount,
                        'is_per_unit'  => (bool) $item->is_per_unit,
                        'unit_price'   => (float) $item->unit_price,
                        'enrolled_units'=> (float) $enrolledUnits,
                    ];
                })->values()->toArray(),
            ];
        })->values()->toArray();

        return [
            'id' => $studentFeeId,
            'school_year' => $normalizedSchoolYear,
            'total_amount' => (float) $totalAmount,
            'grant_discount' => (float) $grantDiscount,
            'total_paid' => (float) $totalPaid,
            'balance' => (float) $balance,
            'status' => $balance <= 0 ? 'paid' : ($isOverdue ? 'overdue' : 'unpaid'),
            'is_overdue' => $isOverdue,
            'due_date' => $dueDate,
            'categories' => $itemsByCategory,
            'processed_by' => $studentFee?->processedBy?->name,
            'processed_at' => ($studentFee?->processed_at ?: $studentFee?->updated_at)?->format('Y-m-d H:i:s'),
            'carried_forward_balance' => (float) ($studentFee->carried_forward_balance ?? 0),
            'carried_forward_from' => $studentFee->carried_forward_from ?? null,
        ];
    }

    private function resolveFeeTemplateYear(Student $student, string $targetYear): ?string
    {
        $hasTargetYearAssignments = \App\Models\FeeItem::where('is_active', true)
            ->whereHas('assignments', function ($q) use ($student, $targetYear) {
                $this->applyAssignmentFilters($q, $student, $targetYear);
            })
            ->exists();

        $candidateYears = \App\Models\FeeItem::where('is_active', true)
            ->whereNotNull('school_year')
            ->where(function ($query) use ($student, $targetYear) {
                $query->where(function ($inner) {
                        $inner->where('assignment_scope', 'all')
                              ->whereDoesntHave('assignments');
                    })
                    ->orWhere(function ($q) use ($student) {
                        $q->where('assignment_scope', 'specific')
                          ->where(function ($inner) {
                              $inner->whereNotNull('classification')
                                    ->orWhereNotNull('department_id')
                                    ->orWhereNotNull('program_id')
                                    ->orWhereNotNull('year_level_id')
                                    ->orWhereNotNull('section_id');
                          });
                        $this->applyStudentFilters($q, $student);
                    })
                    ->orWhereHas('assignments', function ($q) use ($student, $targetYear) {
                        $this->applyAssignmentFilters($q, $student, $targetYear);
                    });
            })
            ->distinct()
            ->pluck('school_year')
            ->filter()
            ->values();

        if ($hasTargetYearAssignments) {
            return $targetYear;
        }

        if ($candidateYears->isEmpty()) {
            return null;
        }

        if ($candidateYears->contains($targetYear)) {
            return $targetYear;
        }

        $fallback = $candidateYears
            ->filter(fn($year) => strcmp((string) $year, $targetYear) <= 0)
            ->sortDesc()
            ->first();

        return $fallback ?: $candidateYears->sortDesc()->first();
    }

    /**
     * Build fee response from an existing student_fees record when no fee item template is currently matched.
     */
    private function buildFeeDataFromStudentFee(Student $student, StudentFee $studentFee): array
    {
        $totalAmount = (float) $studentFee->total_amount;
        $hasPostedPayments = $studentFee->payments()->exists();
        $totalPaid = $hasPostedPayments
            ? (float) $studentFee->payments()->sum('amount') + $this->getUnlinkedOnlineTransactionAmount($student, (string) $studentFee->school_year)
            : (float) $studentFee->total_paid;

        $grantDiscount = (float) $studentFee->grant_discount;

        // For ledgers with posted payments, do not retroactively recalculate discounts.
        // This avoids historical drift when assignment/grant definitions are edited later.
        if ($totalPaid <= 0) {
            $grantRecipients = $this->getGrantRecipientsForFeeYear($student, (string) $studentFee->school_year);
            if ($grantRecipients->isNotEmpty()) {
                $freshDiscount = 0.0;
                foreach ($grantRecipients as $recipient) {
                    if ($recipient->grant) {
                        $calculated = $recipient->grant->calculateDiscount($totalAmount);
                        if ((float) $recipient->discount_amount !== $calculated) {
                            $recipient->discount_amount = $calculated;
                            $recipient->save();
                        }
                        $freshDiscount += $calculated;
                    }
                }
                $grantDiscount = $freshDiscount;
            }
        }

        $balance = max(0, $totalAmount - $grantDiscount - $totalPaid);

        if ((float) $studentFee->grant_discount !== (float) $grantDiscount
            || (float) $studentFee->total_paid !== (float) $totalPaid
            || (float) $studentFee->balance !== (float) $balance) {
            $studentFee->grant_discount = $grantDiscount;
            $studentFee->total_paid = $totalPaid;
            $studentFee->balance = $balance;
            $studentFee->save();
        }

        return [
            'id' => $studentFee->id,
            'school_year' => (string) $studentFee->school_year,
            'total_amount' => $totalAmount,
            'grant_discount' => (float) $grantDiscount,
            'total_paid' => $totalPaid,
            'balance' => $balance,
            'status' => $balance <= 0 ? 'paid' : ($studentFee->is_overdue ? 'overdue' : 'unpaid'),
            'is_overdue' => (bool) $studentFee->is_overdue,
            'due_date' => $studentFee->due_date,
            'categories' => $this->buildFeeCategoriesForStudentYear($student, (string) $studentFee->school_year),
            'processed_by' => $studentFee->processedBy?->name,
            'processed_at' => ($studentFee->processed_at ?: $studentFee->updated_at)?->format('Y-m-d H:i:s'),
            'carried_forward_balance' => (float) ($studentFee->carried_forward_balance ?? 0),
            'carried_forward_from' => $studentFee->carried_forward_from ?? null,
        ];
    }

    /**
     * Build fee categories for display in Fee Breakdown tab.
     */
    private function buildFeeCategoriesForStudentYear(Student $student, string $schoolYear): array
    {
        $templateYear = $this->resolveFeeTemplateYear($student, $schoolYear);
        if (!$templateYear) {
            $fallbackItems = $this->getFallbackFeeItemsForStudentYear($student, $schoolYear);
            if ($fallbackItems->isNotEmpty()) {
                return $this->mapFeeItemsByCategoryForDisplay($fallbackItems, $student, $schoolYear);
            }

            return $this->buildFeeCategoriesFromStoredLedger($student, $schoolYear);
        }

        $hasExplicitAssignmentMatch = \App\Models\FeeItem::where('is_active', true)
            ->where('school_year', $templateYear)
            ->whereHas('assignments', function ($q) use ($student, $schoolYear) {
                $this->applyAssignmentFilters($q, $student, $schoolYear);
                $q->where(function ($yearQuery) use ($schoolYear) {
                    $yearQuery->whereNull('school_year')
                        ->orWhere('school_year', $schoolYear);
                });
            })
            ->exists();

        $feeItems = \App\Models\FeeItem::with('category')
            ->where('is_active', true)
            ->whereDoesntHave('category', function ($q) {
                $q->where('name', 'like', '%Drop%');
            })
            ->where('school_year', $templateYear)
            ->where(function ($query) use ($student, $schoolYear, $hasExplicitAssignmentMatch) {
                if ($hasExplicitAssignmentMatch) {
                    $query->whereHas('assignments', function ($assignmentQuery) use ($student, $schoolYear) {
                        $this->applyAssignmentFilters($assignmentQuery, $student, $schoolYear);
                        $assignmentQuery->where(function ($yearQuery) use ($schoolYear) {
                            $yearQuery->whereNull('school_year')
                                ->orWhere('school_year', $schoolYear);
                        });
                    });

                    return;
                }

                $query->where(function ($inner) {
                    $inner->where('assignment_scope', 'all')
                        ->whereDoesntHave('assignments');
                })->orWhere(function ($specificScope) use ($student) {
                    $specificScope->where('assignment_scope', 'specific')
                        ->where(function ($hasDirectFilters) {
                            $hasDirectFilters->whereNotNull('classification')
                                ->orWhereNotNull('department_id')
                                ->orWhereNotNull('program_id')
                                ->orWhereNotNull('year_level_id')
                                ->orWhereNotNull('section_id');
                        });
                    $this->applyStudentFilters($specificScope, $student);
                });
            })
            ->get();

        if ($feeItems->isEmpty()) {
            $fallbackItems = $this->getFallbackFeeItemsForStudentYear($student, $schoolYear);
            if ($fallbackItems->isNotEmpty()) {
                return $this->mapFeeItemsByCategoryForDisplay($fallbackItems, $student, $schoolYear);
            }

            return $this->buildFeeCategoriesFromStoredLedger($student, $schoolYear);
        }

        return $this->mapFeeItemsByCategoryForDisplay($feeItems, $student, $schoolYear);
    }

    /**
     * Fallback fee-item resolver for legacy ledgers where template-year matching misses active assignments.
     */
    private function getFallbackFeeItemsForStudentYear(Student $student, string $schoolYear)
    {
        return \App\Models\FeeItem::with('category')
            ->where('is_active', true)
            ->whereDoesntHave('category', function ($q) {
                $q->where('name', 'like', '%Drop%');
            })
            ->where(function ($query) use ($student, $schoolYear) {
                $query->where(function ($allScope) use ($schoolYear) {
                    $allScope->where('assignment_scope', 'all')
                        ->whereDoesntHave('assignments')
                        ->where(function ($yearQuery) use ($schoolYear) {
                            $yearQuery->whereNull('school_year')
                                ->orWhere('school_year', $schoolYear);
                        });
                })->orWhere(function ($specificScope) use ($student, $schoolYear) {
                    $specificScope->where('assignment_scope', 'specific')
                        ->where(function ($hasDirectFilters) {
                            $hasDirectFilters->whereNotNull('classification')
                                ->orWhereNotNull('department_id')
                                ->orWhereNotNull('program_id')
                                ->orWhereNotNull('year_level_id')
                                ->orWhereNotNull('section_id');
                        })
                        ->where(function ($yearQuery) use ($schoolYear) {
                            $yearQuery->whereNull('school_year')
                                ->orWhere('school_year', $schoolYear);
                        });

                    $this->applyStudentFilters($specificScope, $student);
                })->orWhereHas('assignments', function ($assignmentQuery) use ($student, $schoolYear) {
                    $this->applyAssignmentFilters($assignmentQuery, $student, $schoolYear);
                });
            })
            ->get();
    }

    /**
     * Group fee items by category and compute per-item rendered amount.
     */
    private function mapFeeItemsByCategoryForDisplay($feeItems, Student $student, string $schoolYear): array
    {

        $enrolledUnits = \App\Models\StudentSubject::where('student_id', $student->id)
            ->where('school_year', $schoolYear)
            ->whereIn('status', ['enrolled'])
            ->join('subjects', 'subjects.id', '=', 'student_subjects.subject_id')
            ->sum('subjects.units');

        return $feeItems->groupBy('fee_category_id')->map(function ($items, $categoryId) use ($enrolledUnits) {
            $category = $items->first()->category;

            return [
                'category_id' => $categoryId,
                'category_name' => $category->name ?? 'Other',
                'items' => $items->map(function ($item) use ($enrolledUnits) {
                    $amount = (float) $item->selling_price;
                    if ($item->is_per_unit) {
                        $amount = (float) $enrolledUnits > 0
                            ? (float) $item->unit_price * (float) $enrolledUnits
                            : (float) $item->selling_price;
                    }

                    return [
                        'id' => $item->id,
                        'name' => $item->name,
                        'amount' => $amount,
                        'is_per_unit' => (bool) $item->is_per_unit,
                        'unit_price' => (float) $item->unit_price,
                        'enrolled_units' => (float) $enrolledUnits,
                    ];
                })->values()->toArray(),
            ];
        })->values()->toArray();
    }

    /**
     * Fallback category builder for legacy/student_fees-only ledgers.
     */
    private function buildFeeCategoriesFromStoredLedger(Student $student, string $schoolYear): array
    {
        $studentFee = StudentFee::where('student_id', $student->id)
            ->where('school_year', $schoolYear)
            ->first();

        if (!$studentFee) {
            return [];
        }

        $rows = [
            ['key' => 'registration_fee', 'name' => 'Registration Fee', 'amount' => (float) $studentFee->registration_fee],
            ['key' => 'tuition_fee', 'name' => 'Tuition Fee', 'amount' => (float) $studentFee->tuition_fee],
            ['key' => 'misc_fee', 'name' => 'Miscellaneous Fee', 'amount' => (float) $studentFee->misc_fee],
            ['key' => 'books_fee', 'name' => 'Books Fee', 'amount' => (float) $studentFee->books_fee],
            ['key' => 'other_fees', 'name' => 'Other Fees', 'amount' => (float) $studentFee->other_fees],
        ];

        $items = collect($rows)
            ->filter(fn($row) => $row['amount'] > 0)
            ->values()
            ->all();

        if (empty($items) && (float) $studentFee->total_amount > 0) {
            $items[] = [
                'key' => 'total_amount',
                'name' => 'Total Assessed Fees',
                'amount' => (float) $studentFee->total_amount,
            ];
        }

        if (empty($items)) {
            return [];
        }

        return [[
            'category_id' => 'stored-ledger',
            'category_name' => 'Stored Fee Ledger',
            'items' => array_map(function ($row) {
                return [
                    'id' => $row['key'],
                    'name' => $row['name'],
                    'amount' => $row['amount'],
                    'is_per_unit' => false,
                    'unit_price' => 0,
                    'enrolled_units' => 0,
                ];
            }, $items),
        ]];
    }

    /**
     * Sum verified/completed online payments that are not yet linked to StudentPayment.
     */
    private function getUnlinkedOnlineTransactionAmount(Student $student, string $schoolYear): float
    {
        $billingYear = $student->school_year
            ?: (AppSetting::current()?->school_year ?? $schoolYear);

        if ($schoolYear !== $billingYear) {
            return 0.0;
        }

        return (float) OnlineTransaction::where('student_id', $student->id)
            ->whereNull('student_payment_id')
            ->whereIn('status', ['completed', 'verified'])
            ->sum('amount');
    }

    /**
     * Derive student_fees category columns from applicable fee items.
     */
    private function deriveStoredCategoryTotals($feeItems, float $enrolledUnits): array
    {
        $totals = [
            'registration_fee' => 0.0,
            'tuition_fee' => 0.0,
            'misc_fee' => 0.0,
            'books_fee' => 0.0,
            'other_fees' => 0.0,
        ];

        foreach ($feeItems as $item) {
            $amount = (float) $item->selling_price;
            if ($item->is_per_unit) {
                $amount = $enrolledUnits > 0
                    ? (float) $item->unit_price * $enrolledUnits
                    : (float) $item->selling_price;
            }

            $categoryName = strtolower((string) optional($item->category)->name);
            $itemName = strtolower((string) $item->name);
            $haystack = trim($categoryName . ' ' . $itemName);

            if (str_contains($haystack, 'registr')) {
                $totals['registration_fee'] += $amount;
            } elseif (str_contains($haystack, 'tuition')) {
                $totals['tuition_fee'] += $amount;
            } elseif (str_contains($haystack, 'misc')) {
                $totals['misc_fee'] += $amount;
            } elseif (str_contains($haystack, 'book')) {
                $totals['books_fee'] += $amount;
            } else {
                $totals['other_fees'] += $amount;
            }
        }

        return $totals;
    }

    /**
     * Record a school year balance rollover (carry forward) for a student.
     * Marks the current school year's StudentFee with how much was carried in from previous years.
     */
    public function carryForwardBalance(Request $request, Student $student): \Illuminate\Http\RedirectResponse
    {
        $currentSchoolYear = \App\Models\AppSetting::current()->school_year ?? date('Y') . '-' . (date('Y') + 1);

        // Sum outstanding balances from previous school years
        $previousFees = StudentFee::where('student_id', $student->id)
            ->where('school_year', '!=', $currentSchoolYear)
            ->where('balance', '>', 0)
            ->get();

        if ($previousFees->isEmpty()) {
            return redirect()->back()->with('error', 'No previous balance to carry forward.');
        }

        $totalPreviousBalance = $previousFees->sum('balance');
        $previousYears = $previousFees->pluck('school_year')->implode(', ');

        // Get or create the current year's StudentFee
        $currentFee = StudentFee::firstOrCreate(
            ['student_id' => $student->id, 'school_year' => $currentSchoolYear],
            ['total_amount' => 0, 'total_paid' => 0, 'balance' => 0, 'grant_discount' => 0]
        );

        $currentFee->carried_forward_balance = $totalPreviousBalance;
        $currentFee->carried_forward_from    = $previousYears;
        $currentFee->save();

        return redirect()->back()->with('success', "Carried forward ₱" . number_format($totalPreviousBalance, 2) . " from {$previousYears}.");
    }

    /**
     * Apply student-specific filters to fee_item_assignments query.
     */
    private function applyAssignmentFilters($query, Student $student, ?string $schoolYear = null): void
    {
        $query->where('is_active', true);

        // Do not hard-restrict by assignment school year here.
        // Many existing records were assigned under a different label/year,
        // and strict filtering drops valid assigned fee items to zero.

        // Students must always have department_id set at creation time
        if (!$student->department_id) {
            $query->whereRaw('1 = 0');
            return;
        }

        if ($student->department) {
            $query->where(function ($sq) use ($student) {
                $sq->whereNull('classification')
                    ->orWhere('classification', $student->department->classification);
            });
        }

        $query->where(function ($sq) use ($student) {
            $sq->whereNull('department_id')
                ->orWhere('department_id', $student->department_id);
        });

        $resolvedYearLevelId = $this->resolveStudentYearLevelId($student);
        $yearLevelCandidates = $this->buildYearLevelCandidates((string) ($student->year_level ?? ''));

        if ($resolvedYearLevelId) {
            $query->where(function ($sq) use ($resolvedYearLevelId) {
                $sq->whereNull('year_level_id')
                    ->orWhere('year_level_id', $resolvedYearLevelId);
            });
        } elseif (!empty($yearLevelCandidates)) {
            $normalizedCandidates = array_values(array_unique(array_filter(array_map(
                fn(string $value) => preg_replace('/[^a-z0-9]/', '', strtolower($value)),
                $yearLevelCandidates
            ))));

            $query->where(function ($sq) use ($yearLevelCandidates, $normalizedCandidates) {
                $sq->whereNull('year_level_id')
                    ->orWhereHas('yearLevel', function ($ylQuery) use ($yearLevelCandidates, $normalizedCandidates) {
                        $ylQuery->where(function ($nameQuery) use ($yearLevelCandidates, $normalizedCandidates) {
                            foreach ($yearLevelCandidates as $candidate) {
                                $nameQuery->orWhereRaw('LOWER(TRIM(name)) = ?', [strtolower($candidate)]);
                            }

                            foreach ($normalizedCandidates as $normalized) {
                                if ($normalized === '') {
                                    continue;
                                }
                                $nameQuery->orWhereRaw("REPLACE(REPLACE(REPLACE(LOWER(TRIM(name)), ' ', ''), '-', ''), '.', '') LIKE ?", ['%' . $normalized . '%']);
                            }
                        });
                    });
            });
        } else {
            $query->whereNull('year_level_id');
        }
    }

    /**
     * Apply student-specific filters to fee item query.
     */
    private function applyStudentFilters($query, Student $student): void
    {
        // Match classification if set
        if ($student->department) {
            $query->where(function ($sq) use ($student) {
                $sq->whereNull('classification')
                    ->orWhere('classification', $student->department->classification);
            });
        }

        // Match department if set
        $query->where(function ($sq) use ($student) {
            $sq->whereNull('department_id')
                ->orWhere('department_id', $student->department_id);
        });

        // Note: program_id not filtered — Student model has no program_id FK;
        // department_id provides sufficient program-level scoping for College.

        // Match year level if set
        $resolvedYearLevelId = $this->resolveStudentYearLevelId($student);
        $yearLevelCandidates = $this->buildYearLevelCandidates((string) ($student->year_level ?? ''));
        $query->where(function ($sq) use ($student, $resolvedYearLevelId, $yearLevelCandidates) {
            $sq->whereNull('year_level_id');

            if ($resolvedYearLevelId) {
                $sq->orWhere('year_level_id', $resolvedYearLevelId);
            } elseif (!empty($yearLevelCandidates)) {
                foreach ($yearLevelCandidates as $candidate) {
                    $sq->orWhereRaw('LOWER(TRIM(year_level)) = ?', [strtolower($candidate)]);
                }
            }
        });

        // Match section if set
        $query->where(function ($sq) use ($student) {
            $sq->whereNull('section_id')
                ->orWhere('section_id', $student->section_id);
        });
    }

    /**
     * Calculate student balance dynamically for a specific school year.
     */
    private function calculateStudentBalance(Student $student, string $schoolYear): float
    {
        $hasExplicitAssignmentMatch = \App\Models\FeeItem::where('is_active', true)
            ->where('school_year', $schoolYear)
            ->whereHas('assignments', function ($q) use ($student, $schoolYear) {
                $this->applyAssignmentFilters($q, $student, $schoolYear);
                $q->where(function ($yearQuery) use ($schoolYear) {
                    $yearQuery->whereNull('school_year')
                        ->orWhere('school_year', $schoolYear);
                });
            })
            ->exists();

        // Calculate total from applicable fee items (exclude Drop category - those are only charged via drop requests)
        $totalAmount = \App\Models\FeeItem::where('school_year', $schoolYear)
            ->where('is_active', true)
            ->whereDoesntHave('category', function ($q) {
                $q->where('name', 'like', '%Drop%');
            })
            ->where(function ($query) use ($student, $schoolYear, $hasExplicitAssignmentMatch) {
                if ($hasExplicitAssignmentMatch) {
                    $query->whereHas('assignments', function ($q) use ($student, $schoolYear) {
                        $this->applyAssignmentFilters($q, $student, $schoolYear);
                        $q->where(function ($yearQuery) use ($schoolYear) {
                            $yearQuery->whereNull('school_year')
                                ->orWhere('school_year', $schoolYear);
                        });
                    });

                    return;
                }

                $query->where(function ($inner) {
                    $inner->where('assignment_scope', 'all')
                        ->whereDoesntHave('assignments');
                })->orWhere(function ($q) use ($student) {
                    $q->where('assignment_scope', 'specific')
                        ->where(function ($inner) {
                            $inner->whereNotNull('classification')
                                ->orWhereNotNull('department_id')
                                ->orWhereNotNull('program_id')
                                ->orWhereNotNull('year_level_id')
                                ->orWhereNotNull('section_id');
                        });
                    $this->applyStudentFilters($q, $student);
                })->orWhereHas('assignments', function ($q) use ($student, $schoolYear) {
                    $this->applyAssignmentFilters($q, $student, $schoolYear);
                });
            })
            ->sum('selling_price');

        // Get grant discount from Grant model (always fresh, not stale discount_amount).
        // For the current school year apply ALL active grants (fixes year-label mismatch).
        $grantRecipients = $this->getGrantRecipientsForFeeYear($student, $schoolYear);
        $grantDiscount = 0.0;
        foreach ($grantRecipients as $recipient) {
            if ($recipient->grant) {
                $grantDiscount += $recipient->grant->calculateDiscount((float) $totalAmount);
            }
        }

        // Get total paid from actual payment records (always fresh)
        $studentFee = StudentFee::where('student_id', $student->id)
            ->where('school_year', $schoolYear)
            ->first();
        $totalPaid = $studentFee ? (float) $studentFee->payments()->sum('amount') : 0.0;

        return max(0, $totalAmount - $grantDiscount - $totalPaid);
    }

    /**
     * Resolve student year level id from either FK or year level text.
     */
    private function resolveStudentYearLevelId(Student $student): ?int
    {
        if ($student->year_level_id) {
            return (int) $student->year_level_id;
        }

        $rawYearLevel = trim((string) ($student->year_level ?? ''));
        if ($rawYearLevel === '' || !$student->department_id) {
            return null;
        }

        $candidates = $this->buildYearLevelCandidates($rawYearLevel);
        if (empty($candidates)) {
            return null;
        }

        $normalizedCandidates = array_values(array_unique(array_filter(array_map(
            fn(string $value) => preg_replace('/[^a-z0-9]/', '', strtolower($value)),
            $candidates
        ))));

        $exact = \App\Models\YearLevel::where('department_id', $student->department_id)
            ->where(function ($query) use ($candidates) {
                foreach ($candidates as $candidate) {
                    $query->orWhereRaw('LOWER(TRIM(name)) = ?', [strtolower($candidate)]);
                }
            })
            ->value('id');

        if ($exact) {
            return (int) $exact;
        }

        $yearLevel = \App\Models\YearLevel::where('department_id', $student->department_id)
            ->get(['id', 'name'])
            ->first(function ($level) use ($normalizedCandidates) {
                $candidate = preg_replace('/[^a-z0-9]/', '', strtolower((string) $level->name));
                if ($candidate === '' || empty($normalizedCandidates)) {
                    return false;
                }

                foreach ($normalizedCandidates as $normalizedCandidate) {
                    if ($normalizedCandidate === '') {
                        continue;
                    }

                    if ($candidate === $normalizedCandidate
                        || str_contains($candidate, $normalizedCandidate)
                        || str_contains($normalizedCandidate, $candidate)) {
                        return true;
                    }
                }

                return false;
            });

        return $yearLevel ? (int) $yearLevel->id : null;
    }

    /**
     * Build candidate year-level strings from student data (e.g. "2nd Year - TBA" -> "2nd Year").
     */
    private function buildYearLevelCandidates(string $rawYearLevel): array
    {
        $rawYearLevel = trim($rawYearLevel);
        if ($rawYearLevel === '') {
            return [];
        }

        $primary = trim((string) preg_replace('/\s*-\s*.*/', '', $rawYearLevel));

        return array_values(array_unique(array_filter([
            $rawYearLevel,
            $primary,
        ], fn($value) => trim((string) $value) !== '')));
    }

    /**
     * Get grant recipients for a fee year with a safe fallback to active grants on the student's primary year.
     */
    private function getGrantRecipientsForFeeYear(Student $student, string $schoolYear)
    {
        $baseQuery = GrantRecipient::where('student_id', $student->id)
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

    private function extractTaggedValue(string $text, string $tag): ?string
    {
        $pattern = '/\[' . preg_quote($tag, '/') . ':([^\]]+)\]/i';

        if (preg_match($pattern, $text, $matches) === 1) {
            $value = trim((string) ($matches[1] ?? ''));
            return $value !== '' ? $value : null;
        }

        return null;
    }

    private function stripReasonTags(string $text): string
    {
        return trim((string) preg_replace('/\s*\[(OR|PAYMENT_ID|OTX|TXN):[^\]]+\]\s*/i', ' ', $text));
    }

    private function normalizeReferenceNumber(?string $value): ?string
    {
        $normalized = strtoupper(trim((string) $value));
        return $normalized !== '' ? $normalized : null;
    }

    private function resolveRefundDisplayOrNumber(?string $orNumber, float $amount, string $notes = ''): ?string
    {
        $resolvedOrNumber = trim((string) $orNumber);
        $rawNotes = trim($notes);
        $normalizedNotes = strtolower($rawNotes);

        $isRefundRow = $amount < 0
            || str_contains($normalizedNotes, 'refund')
            || str_contains(strtoupper($resolvedOrNumber), '-RFND');

        if (!$isRefundRow) {
            return $resolvedOrNumber !== '' ? $resolvedOrNumber : null;
        }

        if (preg_match('/\[OR:([^\]]+)\]/i', $rawNotes, $matches) === 1) {
            $taggedOr = trim((string) ($matches[1] ?? ''));
            if ($taggedOr !== '') {
                return $taggedOr;
            }
        }

        if (preg_match('/\bfor\s+OR\s+([A-Za-z0-9\-\/_.]+)/i', $rawNotes, $matches) === 1) {
            $parsedOr = trim((string) ($matches[1] ?? ''));
            if ($parsedOr !== '') {
                return $parsedOr;
            }
        }

        if ($resolvedOrNumber !== '' && str_ends_with(strtoupper($resolvedOrNumber), '-RFND')) {
            return preg_replace('/-RFND$/i', '', $resolvedOrNumber) ?: $resolvedOrNumber;
        }

        return $resolvedOrNumber !== '' ? $resolvedOrNumber : null;
    }

    /**
    /**
     * Manually create a new student_fees record for a specific school year.
     * Only available for super-accounting roles. Always logged.
     */
    public function addSchoolYear(Request $request, Student $student): RedirectResponse
    {
        $validated = $request->validate([
            'school_year' => 'required|string|max:20',
            'total_amount' => 'required|numeric|min:0',
            'reason' => 'required|string|max:500',
            'notes' => 'nullable|string|max:1000',
        ]);

        $validated['school_year'] = trim((string) $validated['school_year']);

        // Prevent duplicate school year records for this student
        $existing = StudentFee::where('student_id', $student->id)
            ->where('school_year', $validated['school_year'])
            ->first();

        if ($existing) {
            return redirect()->back()->with('error', "A fee record for school year {$validated['school_year']} already exists.");
        }

        $fee = StudentFee::create([
            'student_id'    => $student->id,
            'school_year'   => $validated['school_year'],
            'registration_fee' => 0,
            'tuition_fee' => 0,
            'misc_fee' => 0,
            'books_fee' => 0,
            'other_fees' => (float) $validated['total_amount'],
            'total_amount'  => (float) $validated['total_amount'],
            'total_paid'    => 0,
            'balance'       => (float) $validated['total_amount'],
            'grant_discount' => 0,
            'payment_status' => 'unpaid',
            'processed_by' => $request->user()->id,
            'processed_at' => now(),
        ]);

        StudentActionLog::log(
            studentId: $student->id,
            action: "School year fee record added for {$validated['school_year']} — {$validated['reason']}",
            actionType: 'fee_add',
            details: "Created StudentFee #{$fee->id} for {$validated['school_year']}: ₱" . number_format($validated['total_amount'], 2),
            notes: $validated['notes'] ?? null,
            changes: [
                'school_year'  => $validated['school_year'],
                'total_amount' => (float) $validated['total_amount'],
                'processed_by' => $request->user()->name,
                'processed_at' => now()->format('Y-m-d H:i:s'),
                'reason'       => $validated['reason'],
                'notes'        => $validated['notes'] ?? null,
            ],
            performedBy: $request->user()->id,
        );

        return redirect()->back()->with('success', "Fee record for {$validated['school_year']} created.");
    }

    /**
     * Add balance to a student's fee record.
     * Only available for super-accounting role. Always logged.
     */
    public function addBalance(Request $request, Student $student): RedirectResponse
    {
        $validated = $request->validate([
            'student_fee_id' => 'required|exists:student_fees,id',
            'amount' => 'required|numeric|min:0.01',
            'reason' => 'required|string|max:500',
            'notes' => 'nullable|string|max:1000',
        ]);

        $studentFee = StudentFee::findOrFail($validated['student_fee_id']);

        // Ensure the fee belongs to this student
        if ((int) $studentFee->student_id !== (int) $student->id) {
            return redirect()->back()->with('error', 'Fee record does not belong to this student.');
        }

        // Add the balance to the fee record
        $studentFee->total_amount = (float) $studentFee->total_amount + (float) $validated['amount'];
        $studentFee->balance = max(0, (float) $studentFee->total_amount - (float) $studentFee->grant_discount - (float) $studentFee->total_paid);
        $studentFee->save();

        // Log the balance adjustment
        BalanceAdjustment::create([
            'student_id' => $student->id,
            'student_fee_id' => $studentFee->id,
            'adjusted_by' => $request->user()->id,
            'amount' => $validated['amount'],
            'reason' => $validated['reason'],
            'school_year' => $studentFee->school_year,
            'notes' => $validated['notes'] ?? null,
        ]);

        // Also log to student action logs
        StudentActionLog::log(
            studentId: $student->id,
            action: "Balance added: ₱" . number_format($validated['amount'], 2) . " — {$validated['reason']}",
            actionType: 'balance_adjustment',
            details: "Added ₱" . number_format($validated['amount'], 2) . " to {$studentFee->school_year} fees",
            notes: $validated['notes'] ?? null,
            changes: [
                'amount' => $validated['amount'],
                'reason' => $validated['reason'],
                'school_year' => $studentFee->school_year,
                'new_total_amount' => (float) $studentFee->total_amount,
                'new_balance' => (float) $studentFee->balance,
            ],
            performedBy: $request->user()->id,
        );

        return redirect()->back()->with('success', "Balance of ₱" . number_format($validated['amount'], 2) . " added successfully.");
    }

    /**
     * Edit a StudentFee record's discount and/or due date.
     * Only available for accounting roles. Always logged.
     */
    public function editFee(Request $request, Student $student, StudentFee $fee): RedirectResponse
    {
        // Ensure the fee belongs to this student
        if ((int) $fee->student_id !== (int) $student->id) {
            return redirect()->back()->with('error', 'Fee record does not belong to this student.');
        }

        $routeName = $request->route()?->getName() ?? '';
        $isSuperAccountingRoute = str_starts_with($routeName, 'super-accounting.');

        if ($isSuperAccountingRoute) {
            $validated = $request->validate([
                'school_year' => [
                    'required',
                    'string',
                    'max:20',
                    Rule::unique('student_fees', 'school_year')
                        ->where(fn ($query) => $query->where('student_id', $student->id))
                        ->ignore($fee->id),
                ],
                'total_amount' => 'required|numeric|min:0',
                'grant_discount' => 'required|numeric|min:0',
                'status' => 'required|in:unpaid,partial,paid,overdue',
                'reason' => 'required|string|max:500',
            ]);

            $validated['school_year'] = trim((string) $validated['school_year']);

            $oldData = [
                'school_year' => $fee->school_year,
                'total_amount' => (float) $fee->total_amount,
                'grant_discount' => (float) $fee->grant_discount,
                'total_paid' => (float) $fee->total_paid,
                'balance' => (float) $fee->balance,
                'status' => (string) ($fee->payment_status ?? 'unpaid'),
            ];

            $fee->school_year = $validated['school_year'];
            $fee->total_amount = number_format((float) $validated['total_amount'], 2, '.', '');
            $fee->grant_discount = number_format((float) $validated['grant_discount'], 2, '.', '');

            $freshTotalPaid = (float) $fee->payments()->sum('amount')
                + $this->getUnlinkedOnlineTransactionAmount($student, $validated['school_year']);
            $freshBalance = max(0, (float) $fee->total_amount - (float) $fee->grant_discount - $freshTotalPaid);

            $resolvedStatus = $validated['status'];
            if ($freshBalance <= 0) {
                $resolvedStatus = 'paid';
            } elseif ($resolvedStatus === 'overdue') {
                $resolvedStatus = 'overdue';
            } elseif ($resolvedStatus === 'partial') {
                $resolvedStatus = $freshTotalPaid > 0 ? 'partial' : 'unpaid';
            } else {
                $resolvedStatus = 'unpaid';
            }

            $fee->total_paid = number_format($freshTotalPaid, 2, '.', '');
            $fee->balance = number_format($freshBalance, 2, '.', '');
            $fee->payment_status = $resolvedStatus;
            $fee->is_overdue = $resolvedStatus === 'overdue';
            $fee->processed_by = $request->user()->id;
            $fee->processed_at = now();

            try {
                $fee->save();
            } catch (QueryException $e) {
                if ((int) ($e->errorInfo[1] ?? 0) === 1062) {
                    return redirect()->back()->withErrors([
                        'school_year' => "A fee record for school year {$validated['school_year']} already exists for this student.",
                    ])->withInput();
                }

                throw $e;
            }

            StudentActionLog::log(
                studentId: $student->id,
                action: "Fee record edited for {$fee->school_year} — {$validated['reason']}",
                actionType: 'fee_edit',
                details: "Updated {$fee->school_year} fee details in School Year tab.",
                notes: null,
                changes: [
                    'old' => $oldData,
                    'new' => [
                        'school_year' => $fee->school_year,
                        'total_amount' => (float) $fee->total_amount,
                        'grant_discount' => (float) $fee->grant_discount,
                        'total_paid' => (float) $fee->total_paid,
                        'balance' => (float) $fee->balance,
                        'status' => (string) $resolvedStatus,
                        'processed_by' => $request->user()->name,
                        'processed_at' => $fee->processed_at?->toDateTimeString(),
                    ],
                    'reason' => $validated['reason'],
                ],
                performedBy: $request->user()->id,
            );

            return redirect()->back()->with('success', "Fee record for {$fee->school_year} updated.");
        }

        $validated = $request->validate([
            'grant_discount' => 'nullable|numeric|min:0',
            'due_date'       => 'nullable|date',
            'reason'         => 'required|string|max:500',
        ]);

        $oldDiscount = (float) $fee->grant_discount;
        $oldDueDate  = $fee->due_date;

        if (isset($validated['grant_discount'])) {
            $fee->setAttribute('grant_discount', (float) $validated['grant_discount']);
        }
        if (array_key_exists('due_date', $validated)) {
            $fee->due_date = $validated['due_date'];
        }

        // Recalculate balance
        $fee->setAttribute('balance', max(0, (float) $fee->total_amount - (float) $fee->grant_discount - (float) $fee->total_paid));
        $fee->save();

        // Log the change
        StudentActionLog::log(
            studentId: $student->id,
            action: "Fee record edited for {$fee->school_year} — {$validated['reason']}",
            actionType: 'fee_edit',
            details: "Updated {$fee->school_year}: discount {$oldDiscount} → {$fee->grant_discount}; due date {$oldDueDate} → {$fee->due_date}",
            notes: null,
            changes: [
                'school_year'      => $fee->school_year,
                'old_discount'     => $oldDiscount,
                'new_discount'     => (float) $fee->grant_discount,
                'old_due_date'     => $oldDueDate,
                'new_due_date'     => $fee->due_date,
                'reason'           => $validated['reason'],
                'new_balance'      => (float) $fee->balance,
            ],
            performedBy: $request->user()->id,
        );

        return redirect()->back()->with('success', "Fee record for {$fee->school_year} updated.");
    }

    /**
     * Delete a StudentFee record (removes tracking record; fees recalculate next visit).
     * Only available for accounting roles. Always logged.
     */
    public function deleteFee(Request $request, Student $student, StudentFee $fee): RedirectResponse
    {
        // Ensure the fee belongs to this student
        if ((int) $fee->student_id !== (int) $student->id) {
            return redirect()->back()->with('error', 'Fee record does not belong to this student.');
        }

        // Prevent deletion if payments have been made
        if ((float) $fee->total_paid > 0) {
            return redirect()->back()->with('error', "Cannot delete fee record for {$fee->school_year} — payments of ₱" . number_format((float) $fee->total_paid, 2) . " already recorded.");
        }

        $schoolYear = $fee->school_year;

        StudentActionLog::log(
            studentId: $student->id,
            action: "Fee record deleted for {$schoolYear}",
            actionType: 'fee_delete',
            details: "Deleted StudentFee #{$fee->id} for {$schoolYear}",
            notes: null,
            changes: ['school_year' => $schoolYear, 'fee_id' => $fee->id],
            performedBy: $request->user()->id,
        );

        $fee->delete();

        return redirect()->back()->with('success', "Fee record for {$schoolYear} deleted.");
    }
}
