<?php

namespace App\Http\Controllers\Accounting;

use App\Http\Controllers\Controller;
use App\Models\AppSetting;
use App\Models\Department;
use App\Models\DocumentFeeItem;
use App\Models\DocumentRequest;
use App\Models\FeeCategory;
use App\Models\FeeItem;
use App\Models\GrantRecipient;
use App\Models\OnlineTransaction;
use App\Models\Student;
use App\Models\StudentActionLog;
use App\Models\StudentFee;
use App\Models\StudentPayment;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Illuminate\Support\Facades\DB;

class ReportsController extends Controller
{
    /**
     * Display reports dashboard.
     */
    public function index(Request $request): Response
    {
        // Get current active school year from settings
        $settings = AppSetting::first();
        $currentSchoolYear = $settings?->school_year;
        
        // Get filters
        $from = $request->input('from');
        $to = $request->input('to');
        $schoolYear = $request->input('school_year');
        $status = $request->input('status');
        $departmentId = $request->input('department_id');
        $classification = $request->input('classification');
        $excludeTransferredOut = str_starts_with((string) ($request->route()?->getName() ?? ''), 'super-accounting.');
        
        // "All" means cross-year. Only restrict when user explicitly picks a school year.
        if ($schoolYear === 'all' || $schoolYear === '') {
            $schoolYear = null;
        }

        // Ensure report statuses reflect due-date overdue transitions.
        StudentFee::syncOverdueByDueDate($schoolYear);

        // Build scoped student IDs for demographic filters
        $scopedStudentIds = Student::query()
            ->when($excludeTransferredOut, fn($q) => $q->withoutTransferredOut())
            ->withoutDropped()
            ->when($departmentId, fn($q) => $q->where('department_id', $departmentId))
            ->when($classification, fn($q) => $q->whereHas('department', fn($dq) => $dq->where('classification', $classification)))
            ->pluck('id');

        // Collection Summary (fees + documents + drops), grouped by transaction date
        $paymentQuery = StudentPayment::query();
        
        if ($from) {
            $paymentQuery->whereDate('payment_date', '>=', $from);
        }
        if ($to) {
            $paymentQuery->whereDate('payment_date', '<=', $to);
        }
        if ($schoolYear) {
            $paymentQuery->whereHas('studentFee', fn($q) => $q->where('school_year', $schoolYear));
        }
        if ($excludeTransferredOut || $departmentId || $classification) {
            $paymentQuery->whereIn('student_id', $scopedStudentIds);
        }

        $documentQuery = DocumentRequest::query()
            ->where('is_paid', true)
            ->where('accounting_status', 'approved');

        if ($from) {
            $documentQuery->whereDate('accounting_approved_at', '>=', $from);
        }
        if ($to) {
            $documentQuery->whereDate('accounting_approved_at', '<=', $to);
        }
        if ($schoolYear) {
            $documentQuery->whereHas('student', fn($q) => $q->where('school_year', $schoolYear));
        }
        if ($excludeTransferredOut || $departmentId || $classification) {
            $documentQuery->whereIn('student_id', $scopedStudentIds);
        }

        $dropQuery = \App\Models\DropRequest::query()
            ->where('is_paid', true)
            ->where('accounting_status', 'approved');

        $transferQuery = OnlineTransaction::query()
            ->whereNotNull('transfer_request_id')
            ->whereIn('status', ['completed', 'verified']);

        if ($from) {
            $transferQuery->whereDate('verified_at', '>=', $from);
        }
        if ($to) {
            $transferQuery->whereDate('verified_at', '<=', $to);
        }
        if ($schoolYear) {
            $transferQuery->whereHas('transferRequest', fn($q) => $q->whereRaw('TRIM(school_year) = ?', [trim((string) $schoolYear)]));
        }
        if ($departmentId || $classification) {
            $transferQuery->whereIn('student_id', $scopedStudentIds);
        }

        if ($from) {
            $dropQuery->whereDate('accounting_approved_at', '>=', $from);
        }
        if ($to) {
            $dropQuery->whereDate('accounting_approved_at', '<=', $to);
        }
        if ($schoolYear) {
            $dropQuery->whereHas('student', fn($q) => $q->where('school_year', $schoolYear));
        }
        if ($excludeTransferredOut || $departmentId || $classification) {
            $dropQuery->whereIn('student_id', $scopedStudentIds);
        }

        $summaryByDate = collect();
        $addSummary = function (?string $date, float $amount) use (&$summaryByDate): void {
            if (!$date) {
                return;
            }

            $current = $summaryByDate->get($date, [
                'date' => $date,
                'count' => 0,
                'total_amount' => 0.0,
            ]);

            $current['count'] += 1;
            $current['total_amount'] += $amount;
            $summaryByDate->put($date, $current);
        };

        foreach ((clone $paymentQuery)->get(['payment_date', 'amount']) as $payment) {
            $addSummary($payment->payment_date?->toDateString(), (float) $payment->amount);
        }

        foreach ((clone $documentQuery)->get(['accounting_approved_at', 'fee']) as $document) {
            $addSummary($document->accounting_approved_at?->toDateString(), (float) $document->fee);
        }

        foreach ((clone $dropQuery)->get(['accounting_approved_at', 'fee_amount']) as $drop) {
            $addSummary($drop->accounting_approved_at?->toDateString(), (float) $drop->fee_amount);
        }

        foreach ((clone $transferQuery)->get(['verified_at', 'amount']) as $transfer) {
            $addSummary($transfer->verified_at?->toDateString(), (float) $transfer->amount);
        }

        $paymentSummary = $summaryByDate
            ->sortKeysDesc()
            ->values();

        $applyStudentFilter = function ($query) use ($schoolYear, $departmentId, $classification, $scopedStudentIds) {
            if ($schoolYear) {
                $query->where('school_year', $schoolYear);
            }

            if ($departmentId || $classification) {
                $query->whereIn('student_id', $scopedStudentIds);
            }

            return $query;
        };

        $applyPaymentFilter = function ($query) use ($from, $to, $schoolYear, $departmentId, $classification, $scopedStudentIds) {
            if ($from) {
                $query->whereDate('payment_date', '>=', $from);
            }

            if ($to) {
                $query->whereDate('payment_date', '<=', $to);
            }

            if ($schoolYear) {
                $query->whereHas('studentFee', fn($q) => $q->where('school_year', $schoolYear));
            }

            if ($departmentId || $classification) {
                $query->whereIn('student_id', $scopedStudentIds);
            }

            return $query;
        };

        // Student Balance Report
        $balanceQuery = StudentFee::with('student.department')
            ->when($excludeTransferredOut, function ($q) {
                $q->whereHas('student', function ($sq) {
                    $sq->withoutTransferredOut();
                });
            })
            ->whereHas('student', function ($q) {
                $q->withoutDropped();
            })
            ->when($schoolYear, fn($q) => $q->where('school_year', $schoolYear));

        // Filter by department
        if ($departmentId) {
            $balanceQuery->whereHas('student', function ($q) use ($departmentId) {
                $q->where('department_id', $departmentId);
            });
        }

        // Filter by classification
        if ($classification) {
            $balanceQuery->whereHas('student.department', function ($q) use ($classification) {
                $q->where('classification', $classification);
            });
        }

        $balanceRows = $balanceQuery
            ->whereHas('student')
            ->orderBy('balance', 'desc')
            ->get();

        if (!$schoolYear) {
            // In all-years mode, mirror student-accounts: prefer student's active school_year row,
            // fall back to latest existing ledger row.
            $balanceRows = $balanceRows
                ->groupBy('student_id')
                ->map(function ($rows) {
                    $student = $rows->first()?->student;
                    if ($student?->school_year) {
                        $matched = $rows->firstWhere('school_year', $student->school_year);
                        if ($matched) {
                            return $matched;
                        }
                    }

                    return $rows->sortByDesc('school_year', SORT_NATURAL)->first();
                })
                ->filter()
                ->values();
        }

        $mappedBalanceReport = $balanceRows->map(function ($fee) {
                /** @var \App\Models\StudentFee $fee */
                $freshPaid = (float) $fee->payments()->sum('amount');
                $freshBalance = max(0, (float) $fee->total_amount - (float) $fee->grant_discount - $freshPaid);
                $paymentStatus = $this->resolvePaymentStatus((float) $fee->total_amount, $freshPaid, $freshBalance);
                return [
                    'student' => [
                        'id' => $fee->student->id,
                        'lrn' => $fee->student->lrn,
                        'full_name' => $fee->student->full_name,
                        'first_name' => $fee->student->first_name,
                        'last_name' => $fee->student->last_name,
                        'student_photo_url' => $fee->student->student_photo_url,
                        'program' => $fee->student->program,
                        'year_level' => $fee->student->year_level,
                        'department_id' => $fee->student->department_id,
                    ],
                    'school_year' => $fee->school_year,
                    'total_amount' => $fee->total_amount,
                    'total_paid' => $freshPaid,
                    'balance' => $freshBalance,
                    'payment_status' => $paymentStatus,
                ];
            });

        $balanceReport = $mappedBalanceReport;
        if ($status) {
            $balanceReport = $mappedBalanceReport->filter(fn($row) => $row['payment_status'] === $status)->values();
        }

        $departmentAnalysis = $this->buildDepartmentAnalysis(
            $schoolYear,
            $request->input('department_id') ? (int) $request->input('department_id') : null,
            $request->input('classification') ?: null,
            $excludeTransferredOut,
        );

        // Summary Statistics
        $summarySource = $mappedBalanceReport;
        $totalCollected = (float) collect($departmentAnalysis)->sum('collected');
        $fullyPaidCount = $summarySource->filter(fn($r) => $r['payment_status'] === 'paid')->count();
        $partialCount = $summarySource->filter(fn($r) => $r['payment_status'] === 'partial')->count();
        $unpaidCount = $summarySource->filter(fn($r) => $r['payment_status'] === 'unpaid')->count();
        $summaryStats = [
            'total_collectibles' => (float) $summarySource->sum('balance'),
            'total_collected' => $totalCollected,
            'fully_paid_count' => $fullyPaidCount,
            'partial_paid_count' => $partialCount,
            'unpaid_count' => $unpaidCount,
        ];

        // Get all school years
        $schoolYears = StudentFee::distinct()->pluck('school_year')->sort()->values();

        // Get departments and classifications
        $departments = Department::orderBy('name')->get(['id', 'name', 'code', 'classification']);
        $classifications = Department::distinct()->pluck('classification')->filter()->sort()->values();

        // Fee Income Report — all active categories/items, real data from StudentFee & StudentPayment
        $categoryFieldMap = [
            'registration' => ['field' => 'registration_fee', 'payment_for' => 'registration'],
            'tuition'      => ['field' => 'tuition_fee',      'payment_for' => 'tuition'],
            'misc'         => ['field' => 'misc_fee',         'payment_for' => 'misc'],
            'books'        => ['field' => 'books_fee',        'payment_for' => 'books'],
        ];

        $feeReport = FeeCategory::where('is_active', true)
            ->with(['items' => fn ($q) => $q->where('is_active', true)->orderBy('name')])
            ->orderBy('sort_order')->orderBy('name')
            ->get()
            ->map(function ($cat) use ($categoryFieldMap, $applyStudentFilter, $applyPaymentFilter) {
                $catLower = strtolower($cat->name);
                $mapping = null;
                foreach ($categoryFieldMap as $key => $map) {
                    if (str_contains($catLower, $key)) { $mapping = $map; break; }
                }
                $dbField   = $mapping['field']      ?? 'other_fees';
                $payFor    = $mapping['payment_for'] ?? 'other';

                // Real count & revenue from actual DB records
                $studentsAssigned = $applyStudentFilter(StudentFee::query())
                    ->where($dbField, '>', 0)
                    ->count();
                $totalAssigned = (float) $applyStudentFilter(StudentFee::query())
                    ->sum($dbField);
                $totalCollected = (float) $applyPaymentFilter(StudentPayment::query())
                    ->where('payment_for', $payFor)
                    ->sum('amount');

                $items = $cat->items->map(function ($item) use ($studentsAssigned, $totalAssigned) {
                    $selling = (float) $item->selling_price;
                    $cost    = (float) ($item->cost_price ?? 0);
                    $profit  = $selling - $cost;
                    // Use FeeItem.students_availed if it was set by applyToStudents(),
                    // otherwise fall back to the category-level count from StudentFee
                    $availed = (int) $item->students_availed > 0
                        ? (int) $item->students_availed
                        : $studentsAssigned;
                    return [
                        'name'             => $item->name,
                        'selling_price'    => round($selling, 2),
                        'cost_price'       => round($cost, 2),
                        'profit'           => round($profit, 2),
                        'students_availed' => $availed,
                        'total_revenue'    => round($selling * $availed, 2),
                        'total_income'     => round($profit * $availed, 2),
                    ];
                })->values();

                return [
                    'category'        => $cat->name,
                    'items'           => $items,
                    'total_assigned'  => round($totalAssigned, 2),
                    'total_collected' => round($totalCollected, 2),
                    'total_revenue'   => round($items->sum('total_revenue'), 2),
                    'total_income'    => round($items->sum('total_income'), 2),
                ];
            })
            ->values();

        // Document Fee Income — derive from actual DocumentRequest rows
        $documentRequestBase = DocumentRequest::query()
            ->where('accounting_status', 'approved');

        if ($from) {
            $documentRequestBase->whereDate('accounting_approved_at', '>=', $from);
        }

        if ($to) {
            $documentRequestBase->whereDate('accounting_approved_at', '<=', $to);
        }

        if ($schoolYear) {
            $documentRequestBase->whereHas('student', fn($q) => $q->where('school_year', $schoolYear));
        }

        if ($departmentId || $classification) {
            $documentRequestBase->whereIn('student_id', $scopedStudentIds);
        }

        $documentFeeReport = DocumentFeeItem::where('is_active', true)
            ->orderBy('category')->orderBy('name')
            ->get()
            ->map(function ($item) use ($documentRequestBase) {
                /** @var \App\Models\DocumentFeeItem $item */
                // Recount from real approved requests
                $item->actual_availed = (clone $documentRequestBase)
                    ->where('document_fee_item_id', $item->id)
                    ->count();
                $item->actual_revenue = (float) (clone $documentRequestBase)
                    ->where('document_fee_item_id', $item->id)
                    ->sum('fee');
                return $item;
            })
            ->groupBy('category')
            ->map(function ($fees, $cat) {
                /** @var \Illuminate\Support\Collection $fees */
                $items = $fees->map(function ($fee) {
                    $price   = (float) $fee->price;
                    $availed = $fee->actual_availed;
                    $revenue = $fee->actual_revenue > 0 ? $fee->actual_revenue : round($price * $availed, 2);
                    return [
                        'name'             => $fee->name,
                        'price'            => round($price, 2),
                        'students_availed' => $availed,
                        'total_revenue'    => round($revenue, 2),
                    ];
                })->values();
                return [
                    'category'      => $cat,
                    'items'         => $items,
                    'total_revenue' => round($items->sum('total_revenue'), 2),
                ];
            })
            ->values();

        $grantRows = GrantRecipient::query()
            ->with(['student.department:id,name,classification'])
            ->where('status', 'active')
            ->when($schoolYear, fn($q) => $q->where('school_year', $schoolYear))
            ->when($excludeTransferredOut || $departmentId || $classification, fn($q) => $q->whereIn('student_id', $scopedStudentIds))
            ->get();

        $recipientCountsByDepartment = $grantRows
            ->filter(fn ($row) => $row->student && $row->student->department)
            ->groupBy(fn ($row) => $row->student->department->id)
            ->map(fn ($rows) => [
                'students' => $rows->pluck('student_id')->unique()->count(),
                'total_discount' => (float) $rows->sum('discount_amount'),
            ]);

        $departmentBase = Department::query()
            ->when($departmentId, fn($q) => $q->where('id', $departmentId))
            ->when($classification, fn($q) => $q->where('classification', $classification))
            ->orderBy('name')
            ->get(['id', 'name', 'classification']);

        $grantTotals = $departmentBase
            ->groupBy('classification')
            ->map(function ($departments, $className) use ($recipientCountsByDepartment) {
                $rows = $departments->map(function ($dept) use ($recipientCountsByDepartment) {
                    $agg = $recipientCountsByDepartment->get($dept->id, [
                        'students' => 0,
                        'total_discount' => 0.0,
                    ]);

                    return [
                        'department' => $dept->name,
                        'students' => (int) $agg['students'],
                        'total_discount' => (float) $agg['total_discount'],
                    ];
                })->values();

                return [
                    'classification' => (string) ($className ?: 'Unclassified'),
                    'rows' => $rows,
                    'total_students' => (int) $rows->sum('students'),
                    'total_discount' => (float) $rows->sum('total_discount'),
                ];
            })
            ->sortBy(function ($group) {
                return match ($group['classification']) {
                    'K-12' => 0,
                    'College' => 1,
                    default => 2,
                };
            })
            ->values();

        $grantSummary = [
            'students' => (int) $grantTotals->sum('total_students'),
            'total_discount' => (float) $grantTotals->sum('total_discount'),
        ];

        $feeManipulations = StudentActionLog::query()
            ->with(['student:id,first_name,last_name,lrn,student_photo_url,department_id', 'performer:id,name'])
            ->whereIn('action_type', ['fee_edit', 'fee_delete', 'balance_adjustment'])
            ->when($excludeTransferredOut || $departmentId || $classification, function ($query) use ($scopedStudentIds) {
                $query->whereIn('student_id', $scopedStudentIds);
            })
            ->latest()
            ->take(300)
            ->get()
            ->map(function (StudentActionLog $log) {
                $changes = is_array($log->changes) ? $log->changes : [];

                $schoolYear = (string) (
                    $changes['school_year']
                    ?? ($changes['new']['school_year'] ?? null)
                    ?? ($changes['old']['school_year'] ?? null)
                    ?? ''
                );

                return [
                    'id' => $log->id,
                    'student' => [
                        'id' => $log->student?->id,
                        'full_name' => $log->student?->full_name,
                        'lrn' => $log->student?->lrn,
                        'student_photo_url' => $log->student?->student_photo_url,
                    ],
                    'action_type' => $log->action_type,
                    'action' => $log->action,
                    'details' => $log->details,
                    'notes' => $log->notes,
                    'school_year' => $schoolYear,
                    'performed_by' => $log->performer?->name,
                    'created_at' => $log->created_at?->format('Y-m-d H:i:s'),
                ];
            })
            ->filter(function (array $row) use ($schoolYear) {
                if (!$schoolYear) {
                    return true;
                }

                return trim((string) $row['school_year']) === trim((string) $schoolYear);
            })
            ->values();

        return Inertia::render($this->reportsView(), [
            'paymentSummary' => $paymentSummary,
            'balanceReport' => $balanceReport,
            'filters' => $request->only(['from', 'to', 'school_year', 'status', 'department_id', 'classification']),
            'schoolYears' => $schoolYears,
            'summaryStats' => $summaryStats,
            'departments' => $departments,
            'classifications' => $classifications,
            'feeReport' => $feeReport,
            'documentFeeReport' => $documentFeeReport,
            'departmentAnalysis' => $departmentAnalysis,
            'grantTotals' => $grantTotals,
            'grantSummary' => $grantSummary,
            'feeManipulations' => $feeManipulations,
        ]);
    }

    protected function reportsView(): string
    {
        return $this->viewPrefix() . '/reports';
    }

    private function buildDepartmentAnalysis(?string $forcedSchoolYear = null, ?int $departmentId = null, ?string $classification = null, bool $excludeTransferredOut = false): array
    {
        $activeSchoolYear = AppSetting::current()?->school_year ?? (date('Y') . '-' . (date('Y') + 1));

        $students = Student::query()
            ->with('department:id,name,classification')
            ->when($excludeTransferredOut, fn($q) => $q->withoutTransferredOut())
            ->withoutDropped()
            ->whereHas('enrollmentClearance', function ($q) {
                $q->where(function ($sq) {
                    $sq->where('registrar_clearance', true)
                        ->orWhere('enrollment_status', 'completed');
                });
            })
            ->whereNotIn('enrollment_status', ['not-enrolled', 'dropped'])
            ->when($departmentId, fn($q) => $q->where('department_id', $departmentId))
            ->when($classification, function ($q) use ($classification) {
                $q->whereHas('department', fn($dq) => $dq->where('classification', $classification));
            })
            ->get(['id', 'department_id', 'school_year']);

        $studentIds = $students->pluck('id')->filter()->values();

        $feeRows = StudentFee::query()
            ->with('payments:id,student_fee_id,amount')
            ->whereIn('student_id', $studentIds)
            ->get()
            ->groupBy(function (StudentFee $fee) {
                return $fee->student_id . '|' . trim((string) $fee->school_year);
            });

        $transferCollectedByDepartment = OnlineTransaction::query()
            ->with('student:id,department_id,school_year')
            ->whereNotNull('transfer_request_id')
            ->whereIn('status', ['completed', 'verified'])
            ->when($forcedSchoolYear, fn($q) => $q->whereHas('transferRequest', fn($sq) => $sq->whereRaw('TRIM(school_year) = ?', [trim((string) $forcedSchoolYear)])))
            ->when($departmentId || $classification, function ($q) use ($departmentId, $classification) {
                $q->whereHas('student', function ($sq) use ($departmentId, $classification) {
                    if ($departmentId) {
                        $sq->where('department_id', $departmentId);
                    }
                    if ($classification) {
                        $sq->whereHas('department', fn($dq) => $dq->where('classification', $classification));
                    }
                });
            })
            ->get()
            ->groupBy(fn($tx) => $tx->student?->department_id)
            ->map(fn($rows) => (float) $rows->sum('amount'));

        $departments = Department::query()
            ->when($departmentId, fn($q) => $q->where('id', $departmentId))
            ->when($classification, fn($q) => $q->where('classification', $classification))
            ->get();

        return $departments
            ->map(function ($dept) use ($students, $feeRows, $forcedSchoolYear, $activeSchoolYear, $transferCollectedByDepartment) {
                $deptStudents = $students->where('department_id', $dept->id)->values();

                $billed = 0.0;
                $collected = 0.0;
                $outstanding = 0.0;

                foreach ($deptStudents as $student) {
                    $targetSchoolYear = $forcedSchoolYear ?: ($student->school_year ?: $activeSchoolYear);
                    $key = $student->id . '|' . trim((string) $targetSchoolYear);
                    /** @var StudentFee|null $fee */
                    $fee = $feeRows->get($key)?->first();
                    if (!$fee) {
                        continue;
                    }

                    $totalAmount = (float) $fee->total_amount;
                    $totalPaid = (float) $fee->payments->sum('amount');
                    $balance = max(0, $totalAmount - (float) $fee->grant_discount - $totalPaid);

                    $billed += $totalAmount;
                    $collected += $totalPaid;
                    if ($balance > 0) {
                        $outstanding += $balance;
                    }
                }

                $collectionRate = $billed > 0 ? round(($collected / $billed) * 100, 1) : 0.0;
                $collected += (float) ($transferCollectedByDepartment->get($dept->id, 0.0));
                $collectionRate = $billed > 0 ? round(($collected / $billed) * 100, 1) : 0.0;

                return [
                    'department_id'   => $dept->id,
                    'department'      => $dept->name,
                    'students'        => $deptStudents->count(),
                    'billed'          => round($billed, 2),
                    'collected'       => round($collected, 2),
                    'balance'         => round($outstanding, 2),
                    'collection_rate' => $collectionRate,
                ];
            })
            ->sortByDesc('collected')
            ->values()
            ->toArray();
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

    public function export(Request $request)
    {
        $type = $request->input('type', 'csv'); // csv, excel, pdf

        // Implementation would depend on packages like:
        // - Laravel Excel (maatwebsite/excel) for Excel/CSV
        // - DomPDF or Snappy for PDF
        
        // For now, this is a placeholder
        return response()->json([
            'message' => 'Export functionality can be implemented with Laravel Excel package',
            'type' => $type,
        ]);
    }
}
