<?php

namespace App\Http\Controllers\Student;

use App\Http\Controllers\Controller;
use App\Models\AppSetting;
use App\Models\Department;
use App\Models\FeeItem;
use App\Models\GrantRecipient;
use App\Models\Program;
use App\Models\StudentActionLog;
use App\Models\StudentFee;
use App\Models\StudentPayment;
use App\Models\YearLevel;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

class SelfEnrollmentController extends Controller
{
    /**
     * Show enrollment details (for enrolled students) or self-enrollment form (for others).
     */
    public function index(): Response|RedirectResponse
    {
        $user    = Auth::user();
        $student = $user->student;

        if (! $student) {
            return redirect()->route('student.dashboard')
                ->with('error', 'No student record linked to your account.');
        }

        $settings          = AppSetting::current();
        $currentSchoolYear = $settings->school_year ?? date('Y') . '-' . (date('Y') + 1);
        $targetSchoolYear  = $student->school_year ?: $currentSchoolYear;
        $classification    = $student->resolveDepartmentClassification() ?? 'K-12';

        // ── ENROLLED: show read-only enrollment details ────────────────────────
        if ($student->enrollment_status === 'enrolled') {
            $student->load(['requirements.requirement.category', 'enrollmentClearance', 'departmentModel']);

            // Fees across all school years so newly added fee records are visible.
            $rawFees = StudentFee::where('student_id', $student->id)
                ->orderBy('school_year', 'desc')
                ->get();
            foreach ($rawFees as $feeToSync) {
                // Never apply a grant discount to a fee record with no fees — prevents double-counting.
                if ((float) $feeToSync->total_amount <= 0) {
                    if ((float) $feeToSync->grant_discount !== 0.0 || (float) $feeToSync->balance !== 0.0) {
                        $feeToSync->grant_discount = 0;
                        $feeToSync->balance        = 0;
                        $feeToSync->save();
                    }
                    continue;
                }
                $recipients = $this->getGrantRecipientsForFeeYear($student, (string) $feeToSync->school_year, $targetSchoolYear);
                $freshGrant = 0.0;
                foreach ($recipients as $r) {
                    if ($r->grant) {
                        $freshGrant += $r->grant->calculateDiscount((float) $feeToSync->total_amount);
                    }
                }
                $expectedBalance = max(0, (float) $feeToSync->total_amount - $freshGrant - (float) $feeToSync->total_paid);
                if ((float) $feeToSync->grant_discount !== $freshGrant || (float) $feeToSync->balance !== $expectedBalance) {
                    $feeToSync->grant_discount = $freshGrant;
                    $feeToSync->balance = $expectedBalance;
                    $feeToSync->save();
                }
            }
            $fees = $rawFees->map(function (StudentFee $fee) use ($student) {
                $freshPaid = (float) $fee->total_paid;
                $freshBalance = (float) $fee->balance;

                return [
                    'id'                => $fee->id,
                    'school_year'       => $fee->school_year,
                    'total_amount'      => (float) $fee->total_amount,
                    'total_paid'        => $freshPaid,
                    'balance'           => $freshBalance,
                    'grant_discount'    => (float) $fee->grant_discount,
                    'payment_status'    => $this->resolvePaymentStatus((float) $fee->total_amount, $freshPaid, $freshBalance),
                    'is_overdue'        => (bool) $fee->is_overdue,
                    'due_date'          => $fee->due_date?->format('M d, Y'),
                    'registration_fee'  => (float) $fee->registration_fee,
                    'tuition_fee'       => (float) $fee->tuition_fee,
                    'misc_fee'          => (float) $fee->misc_fee,
                    'books_fee'         => (float) $fee->books_fee,
                    'other_fees'        => (float) $fee->other_fees,
                    'categories'        => $this->buildFeeCategoriesForStudentYear($student, (string) $fee->school_year),
                ];
            });

            // Payment history for the billing school year.
            $payments = StudentPayment::where('student_id', $student->id)
                ->whereHas('studentFee', function ($query) use ($targetSchoolYear) {
                    $query->whereRaw('TRIM(school_year) = ?', [trim((string) $targetSchoolYear)]);
                })
                ->with('studentFee:id,school_year')
                ->orderBy('created_at', 'desc')
                ->orderBy('payment_date', 'desc')
                ->get()
                ->map(function ($p) {
                    $displayOrNumber = $this->resolveRefundDisplayOrNumber(
                        $p->or_number,
                        (float) $p->amount,
                        (string) ($p->notes ?? '')
                    );

                    return [
                        'id'           => $p->id,
                        'payment_date' => trim(($p->payment_date?->format('M d, Y') ?? '') . ' ' . ($p->created_at?->format('h:i A') ?? '')),
                        'or_number'    => $displayOrNumber,
                        'amount'       => (float) $p->amount,
                        'payment_mode' => $this->normalizePaymentMode($p->payment_mode, $p->payment_method),
                        'payment_for'  => $p->payment_for,
                        'notes'        => $p->notes,
                        'school_year'  => $p->studentFee?->school_year,
                        'sort_at'      => $p->created_at?->timestamp ?? now()->timestamp,
                    ];
                });

            $existingRefundOrNumbers = collect($payments)
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

            $refundRows = \App\Models\RefundRequest::where('student_id', $student->id)
                ->where('status', 'approved')
                ->whereHas('studentFee', function ($query) use ($targetSchoolYear) {
                    $query->whereRaw('TRIM(school_year) = ?', [trim((string) $targetSchoolYear)]);
                })
                ->with(['studentFee:id,school_year'])
                ->orderByDesc('processed_at')
                ->get()
                ->map(function ($refund) {
                    $processedAt = $refund->processed_at ?: $refund->updated_at ?: $refund->created_at;
                    $rawReason = (string) ($refund->reason ?? '');
                    $originalOrNumber = $this->extractTaggedValue($rawReason, 'OR');
                    $transactionReference = $this->extractTaggedValue($rawReason, 'TXN');

                    $displayOrNumber = $originalOrNumber
                        ?: ($transactionReference ?: ('RF-' . $refund->id));

                    return [
                        'id'           => 100000 + $refund->id,
                        'payment_date' => ($processedAt ?: now())->format('M d, Y h:i A'),
                        'or_number'    => $displayOrNumber,
                        'amount'       => -abs((float) $refund->amount),
                        'payment_mode' => 'REFUND',
                        'payment_for'  => strtoupper((string) $refund->type) . ' approved',
                        'notes'        => $refund->accounting_notes ?: $this->stripReasonTags($rawReason),
                        'school_year'  => $refund->studentFee?->school_year,
                        'sort_at'      => ($processedAt ?: now())->timestamp,
                        'txn_reference' => $transactionReference,
                    ];
                })
                ->filter(function ($refundRow) use ($existingRefundOrNumbers) {
                    $orNumber = $this->normalizeReferenceNumber($refundRow['or_number'] ?? null);
                    $txnReference = $this->normalizeReferenceNumber($refundRow['txn_reference'] ?? null);

                    if ($orNumber !== null && in_array($orNumber, $existingRefundOrNumbers, true)) {
                        return false;
                    }

                    if ($txnReference !== null && in_array($txnReference, $existingRefundOrNumbers, true)) {
                        return false;
                    }

                    return true;
                })
                ->values();

            $payments = $payments
                ->concat($refundRows)
                ->sortByDesc('sort_at')
                ->map(function ($row) {
                    unset($row['txn_reference']);
                    unset($row['sort_at']);
                    return $row;
                })
                ->values();

            // Promissory notes for the billing school year.
            $promissoryNotes = \App\Models\PromissoryNote::where('student_id', $student->id)
                ->whereHas('studentFee', function ($query) use ($targetSchoolYear) {
                    $query->whereRaw('TRIM(school_year) = ?', [trim((string) $targetSchoolYear)]);
                })
                ->with('studentFee:id,school_year')
                ->orderBy('submitted_date', 'desc')
                ->get()
                ->map(fn ($n) => [
                    'id'             => $n->id,
                    'submitted_date' => $n->submitted_date->format('M d, Y'),
                    'due_date'       => $n->due_date->format('M d, Y'),
                    'amount'         => $n->amount !== null ? (float) $n->amount : null,
                    'reason'         => $n->reason,
                    'status'         => $n->status,
                    'school_year'    => $n->studentFee?->school_year,
                    'review_notes'   => $n->review_notes,
                ]);

            $staffNotes = StudentActionLog::with('performer:id,name')
                ->where('student_id', $student->id)
                ->where('action_type', 'note')
                ->orderByDesc('created_at')
                ->get()
                ->map(fn ($log) => [
                    'id' => $log->id,
                    'message' => $log->details ?: $log->notes ?: $log->action,
                    'author' => $log->performer?->name,
                    'created_at' => $log->created_at?->format('M d, Y h:i A'),
                ]);

            // Summary — use the student's active billing year so this matches accounting/payment processing.
            $currentYearFees = $fees->filter(fn ($f) => $f['school_year'] === $targetSchoolYear);
            $totalFees     = $currentYearFees->sum('total_amount');
            $totalDiscount = $currentYearFees->sum('grant_discount');
            $totalPaid     = $currentYearFees->sum('total_paid');
            $totalBalance  = $currentYearFees->sum('balance');

            // Requirements
            $requirements = $student->requirements->map(fn ($req) => [
                'id'           => $req->id,
                'name'         => $req->requirement->name,
                'description'  => $req->requirement->description ?? null,
                'category'     => $req->requirement->category?->name ?? null,
                'status'       => $req->status,
                'notes'        => $req->notes,
                'submitted_at' => $req->submitted_at?->format('M d, Y'),
                'approved_at'  => $req->approved_at?->format('M d, Y'),
            ]);

            // Enrollment clearance
            $clearance = $student->enrollmentClearance ? [
                'requirements_complete'            => (bool) $student->enrollmentClearance->requirements_complete,
                'requirements_complete_percentage' => (int) $student->enrollmentClearance->requirements_complete_percentage,
                'registrar_clearance'              => (bool) $student->enrollmentClearance->registrar_clearance,
                'registrar_cleared_at'             => $student->enrollmentClearance->registrar_cleared_at?->format('M d, Y'),
                'registrar_notes'                  => $student->enrollmentClearance->registrar_notes,
                'accounting_clearance'             => (bool) $student->enrollmentClearance->accounting_clearance,
                'accounting_cleared_at'            => $student->enrollmentClearance->accounting_cleared_at?->format('M d, Y'),
                'accounting_notes'                 => $student->enrollmentClearance->accounting_notes,
                'official_enrollment'              => (bool) $student->enrollmentClearance->official_enrollment,
                'officially_enrolled_at'           => $student->enrollmentClearance->officially_enrolled_at?->format('M d, Y'),
            ] : null;

            return Inertia::render('student/enrollment/index', [
                'isEnrolled'           => true,
                'currentSchoolYear'    => $targetSchoolYear,
                'classification'       => $classification,
                'collegeEnrollmentOpen' => $settings->isEnrollmentOpen('College'),
                'student' => [
                    'id'                => $student->id,
                    'first_name'        => $student->first_name,
                    'last_name'         => $student->last_name,
                    'lrn'               => $student->lrn,
                    'email'             => $user->email,
                    'program'           => $student->program,
                    'year_level'        => $student->year_level,
                    'section'           => $student->section,
                    'school_year'       => $student->school_year,
                    'enrollment_status' => $student->enrollment_status,
                    'student_photo_url' => $student->student_photo_url,
                    'student_type'      => $student->student_type,
                    'department'        => $student->departmentModel?->name,
                    'classification'    => $classification,
                    'remarks'           => $student->remarks,
                ],
                'fees'          => $fees->values(),
                'payments'      => $payments->values(),
                'promissoryNotes' => $promissoryNotes->values(),
                'staffNotes' => $staffNotes->values(),
                'requirements'  => $requirements->values(),
                'clearance'     => $clearance,
                'summary' => [
                    'total_fees'     => $totalFees,
                    'total_discount' => $totalDiscount,
                    'total_paid'     => $totalPaid,
                    'total_balance'  => $totalBalance,
                ],
            ]);
        }

        // ── NOT ENROLLED: show re-enrollment form ──────────────────────────────
        $hasPendingRequest = $student->enrollment_status === 'pending-registrar';
        $enrollmentOpen    = $settings->isEnrollmentOpen($classification);
        $notEnrolledTargetYear = $student->school_year ?: $currentSchoolYear;

        $rawNotEnrolledFees = StudentFee::where('student_id', $student->id)
            ->orderBy('school_year', 'desc')
            ->get();

        $notEnrolledFees = $rawNotEnrolledFees->map(function (StudentFee $fee) use ($student) {
            $freshPaid = (float) $fee->total_paid;
            $freshBalance = (float) $fee->balance;

            return [
                'id'                => $fee->id,
                'school_year'       => $fee->school_year,
                'total_amount'      => (float) $fee->total_amount,
                'total_paid'        => $freshPaid,
                'balance'           => $freshBalance,
                'grant_discount'    => (float) $fee->grant_discount,
                'payment_status'    => $this->resolvePaymentStatus((float) $fee->total_amount, $freshPaid, $freshBalance),
                'is_overdue'        => (bool) $fee->is_overdue,
                'due_date'          => $fee->due_date?->format('M d, Y'),
                'registration_fee'  => (float) $fee->registration_fee,
                'tuition_fee'       => (float) $fee->tuition_fee,
                'misc_fee'          => (float) $fee->misc_fee,
                'books_fee'         => (float) $fee->books_fee,
                'other_fees'        => (float) $fee->other_fees,
                'categories'        => $this->buildFeeCategoriesForStudentYear($student, (string) $fee->school_year),
            ];
        });

        $notEnrolledCurrentYearFees = $notEnrolledFees->filter(fn ($f) => $f['school_year'] === $notEnrolledTargetYear);
        $notEnrolledSummary = [
            'total_fees' => (float) $notEnrolledCurrentYearFees->sum('total_amount'),
            'total_discount' => (float) $notEnrolledCurrentYearFees->sum('grant_discount'),
            'total_paid' => (float) $notEnrolledCurrentYearFees->sum('total_paid'),
            'total_balance' => (float) $notEnrolledCurrentYearFees->sum('balance'),
        ];

        $departments = Department::orderBy('name')->get(['id', 'name', 'code', 'classification']);
        $programs    = Program::orderBy('name')->get(['id', 'name', 'department_id']);
        $yearLevels  = YearLevel::orderBy('level_number')->get(['id', 'name', 'department_id']);

        return Inertia::render('student/enrollment/index', [
            'isEnrolled'            => false,
            'currentSchoolYear'     => $currentSchoolYear,
            'classification'        => $classification,
            'collegeEnrollmentOpen' => $settings->isEnrollmentOpen('College'),
            'student' => [
                'id'                => $student->id,
                'first_name'        => $student->first_name,
                'last_name'         => $student->last_name,
                'lrn'               => $student->lrn,
                'email'             => $user->email,
                'program'           => $student->program,
                'year_level'        => $student->year_level,
                'section'           => $student->section,
                'department_id'     => $student->department_id,
                'enrollment_status' => $student->enrollment_status,
                'school_year'       => $student->school_year,
                'student_photo_url' => $student->student_photo_url,
            ],
            'fees' => $notEnrolledFees->values(),
            'summary' => $notEnrolledSummary,
            'hasPendingRequest' => $hasPendingRequest,
            'enrollmentOpen'    => $enrollmentOpen,
            'enrollmentPeriod'  => [
                'start' => $classification === 'College'
                    ? $settings->college_enrollment_start?->format('M d, Y')
                    : $settings->k12_enrollment_start?->format('M d, Y'),
                'end'   => $classification === 'College'
                    ? $settings->college_enrollment_end?->format('M d, Y')
                    : $settings->k12_enrollment_end?->format('M d, Y'),
            ],
            'departments' => $departments,
            'programs'    => $programs,
            'yearLevels'  => $yearLevels,
        ]);
    }

    /**
     * Submit enrollment request for the new school year.
     */
    public function store(Request $request): RedirectResponse
    {
        $user    = Auth::user();
        $student = $user->student;

        if (! $student) {
            return back()->with('error', 'No student record linked to your account.');
        }

        $settings          = AppSetting::current();
        $currentSchoolYear = $settings->school_year ?? date('Y') . '-' . (date('Y') + 1);

        // Check if enrollment is open for student's classification
        $classification = $student->resolveDepartmentClassification() ?? 'K-12';
        
        if (!$settings->isEnrollmentOpen($classification)) {
            return back()->with('error', "Enrollment for {$classification} is currently closed.");
        }

        // Don't allow if already enrolled for this school year
        if ($student->enrollment_status === 'enrolled' && $student->school_year === $currentSchoolYear) {
            return back()->with('error', 'You are already enrolled for the current school year.');
        }

        // Don't allow duplicate pending request
        if ($student->enrollment_status === 'pending-registrar') {
            return back()->with('error', 'You already have a pending enrollment request. Please wait for the Registrar to process it.');
        }

        $validated = $request->validate([
            'year_level'    => 'required|string|max:100',
            'program'       => 'nullable|string|max:255',
            'department_id' => 'nullable|exists:departments,id',
            'notes'         => 'nullable|string|max:1000',
        ]);

        $oldStatus     = $student->enrollment_status;
        $oldYearLevel  = $student->year_level;
        $oldSchoolYear = $student->school_year;

        // Update student record
        $student->update([
            'enrollment_status' => 'pending-registrar',
            'school_year'       => $currentSchoolYear,
            'year_level'        => $validated['year_level'],
            'program'           => $validated['program'] ?? $student->program,
            'department_id'     => $validated['department_id'] ?? $student->department_id,
        ]);

        // Log the action
        StudentActionLog::create([
            'student_id'   => $student->id,
            'performed_by' => $user->id,
            'action'       => 'Self-Enrollment Request Submitted',
            'action_type'  => 'enrollment',
            'details'      => "Student submitted re-enrollment request for {$currentSchoolYear}. Year Level: {$validated['year_level']}.",
            'notes'        => $validated['notes'] ?? null,
            'changes'      => [
                'enrollment_status' => ['from' => $oldStatus, 'to' => 'pending-registrar'],
                'school_year'       => ['from' => $oldSchoolYear, 'to' => $currentSchoolYear],
                'year_level'        => ['from' => $oldYearLevel, 'to' => $validated['year_level']],
            ],
        ]);

        return redirect()->route('student.dashboard')
            ->with('success', 'Enrollment request submitted successfully! The Registrar will review your application.');
    }

    private function resolvePaymentStatus(float $totalAmount, float $totalPaid, float $balance): string
    {
        if ($totalAmount > 0 && $balance <= 0) {
            return 'paid';
        }
        if ($totalPaid > 0 && $balance > 0) {
            return 'partial';
        }
        return 'unpaid';
    }

    private function normalizePaymentMode(?string $paymentMode, ?string $paymentMethod): string
    {
        $raw = strtoupper((string) ($paymentMode ?: $paymentMethod ?: 'CASH'));
        return match ($raw) {
            'GCASH' => 'GCASH',
            'BANK', 'BANK_TRANSFER' => 'BANK',
            default => 'CASH',
        };
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
     * Get grant recipients for a fee year with fallback to active grants on student's billing year.
     */
    private function getGrantRecipientsForFeeYear($student, string $schoolYear, string $primaryYear)
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

    /**
     * Build itemized fee categories for student enrollment pages.
     */
    private function buildFeeCategoriesForStudentYear($student, string $schoolYear): array
    {
        $normalizedSchoolYear = trim((string) $schoolYear);

        $feeItems = FeeItem::with('category')
            ->where('is_active', true)
            ->whereDoesntHave('category', function ($q) {
                $q->where('name', 'like', '%Drop%');
            })
            ->where(function ($query) use ($normalizedSchoolYear, $student) {
                $query->where(function ($allScope) use ($normalizedSchoolYear) {
                    $allScope->where('assignment_scope', 'all')
                        ->where(function ($yearQuery) use ($normalizedSchoolYear) {
                            $yearQuery->whereNull('school_year')
                                ->orWhereRaw('TRIM(school_year) = ?', [$normalizedSchoolYear]);
                        })
                        ->whereDoesntHave('assignments');
                })->orWhere(function ($specificScope) use ($student, $normalizedSchoolYear) {
                    $specificScope->where('assignment_scope', 'specific')
                        ->where(function ($yearQuery) use ($normalizedSchoolYear) {
                            $yearQuery->whereNull('school_year')
                                ->orWhereRaw('TRIM(school_year) = ?', [$normalizedSchoolYear]);
                        });

                    $this->applyStudentFeeItemFilters($specificScope, $student);
                })->orWhereHas('assignments', function ($assignmentQuery) use ($student, $normalizedSchoolYear) {
                    $this->applyAssignmentFeeItemFilters($assignmentQuery, $student, $normalizedSchoolYear);
                });
            })
            ->get();

        if ($feeItems->isEmpty()) {
            return [];
        }

        $enrolledUnits = \App\Models\StudentSubject::where('student_id', $student->id)
            ->whereRaw('TRIM(school_year) = ?', [$normalizedSchoolYear])
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
                    ];
                })->values()->all(),
            ];
        })->values()->all();
    }

    private function applyStudentFeeItemFilters($query, $student): void
    {
        $classification = $student->resolveDepartmentClassification();
        if ($classification) {
            $query->where(function ($q) use ($classification) {
                $q->whereNull('classification')
                    ->orWhere('classification', $classification);
            });
        }

        $query->where(function ($q) use ($student) {
            $q->whereNull('department_id')
                ->orWhere('department_id', $student->department_id);
        });

        $query->where(function ($q) use ($student) {
            $q->whereNull('year_level_id')
                ->orWhere('year_level_id', $student->year_level_id);
        });

        $query->where(function ($q) use ($student) {
            $q->whereNull('section_id')
                ->orWhere('section_id', $student->section_id);
        });
    }

    private function applyAssignmentFeeItemFilters($query, $student, string $schoolYear): void
    {
        $classification = $student->resolveDepartmentClassification();

        $query->where('is_active', true)
            ->where(function ($yearQuery) use ($schoolYear) {
                $yearQuery->whereNull('school_year')
                    ->orWhereRaw('TRIM(school_year) = ?', [$schoolYear]);
            })
            ->where(function ($q) use ($classification) {
                $q->whereNull('classification')
                    ->orWhere('classification', $classification);
            })
            ->where(function ($q) use ($student) {
                $q->whereNull('department_id')
                    ->orWhere('department_id', $student->department_id);
            })
            ->where(function ($q) use ($student) {
                $q->whereNull('year_level_id')
                    ->orWhere('year_level_id', $student->year_level_id);
            })
            ->where(function ($q) use ($student) {
                $q->whereNull('section_id')
                    ->orWhere('section_id', $student->section_id);
            });
    }
}
