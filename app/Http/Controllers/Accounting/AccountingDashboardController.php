<?php

namespace App\Http\Controllers\Accounting;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Department;
use App\Models\DocumentRequest;
use App\Models\DropRequest;
use App\Models\AppSetting;
use App\Models\OnlineTransaction;
use App\Models\Student;
use App\Models\StudentFee;
use App\Models\StudentPayment;
use App\Models\TransferRequest;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class AccountingDashboardController extends Controller
{
    private function getAvailableSchoolYears(): array
    {
        return StudentFee::query()
            ->select('school_year')
            ->whereNotNull('school_year')
            ->distinct()
            ->orderByDesc('school_year')
            ->pluck('school_year')
            ->values()
            ->toArray();
    }

    private function resolveSelectedSchoolYear(?string $requestedSchoolYear, string $currentSchoolYear, array $availableSchoolYears): string
    {
        $selectedSchoolYear = trim((string) $requestedSchoolYear);
        if ($selectedSchoolYear === '') {
            $selectedSchoolYear = $currentSchoolYear;
        }

        if (!empty($availableSchoolYears) && !in_array($selectedSchoolYear, $availableSchoolYears, true)) {
            $selectedSchoolYear = (string) $availableSchoolYears[0];
        }

        return $selectedSchoolYear;
    }

    /**
     * Display the main accounting dashboard (overview).
     */
    public function index(Request $request): Response
    {
        $selectedYear = $request->get('year', date('Y'));
        $currentSchoolYear = \App\Models\AppSetting::current()?->school_year
            ?? (date('Y') . '-' . (date('Y') + 1));
        $availableSchoolYears = $this->getAvailableSchoolYears();
        $requestedSchoolYear = trim((string) $request->input('school_year', ''));
        $hasExplicitSchoolYearFilter = $requestedSchoolYear !== ''
            && strtolower($requestedSchoolYear) !== 'all';
        $selectedSchoolYear = $this->resolveSelectedSchoolYear(
            $hasExplicitSchoolYearFilter ? $requestedSchoolYear : $currentSchoolYear,
            $currentSchoolYear,
            $availableSchoolYears
        );
        // Match student-accounts behavior when no school year is explicitly requested.
        $receivablesSchoolYear = $hasExplicitSchoolYearFilter ? $selectedSchoolYear : null;

        $eligibleStudents = Student::query()
            ->with('department:id,name')
            ->where(function ($q) {
                $q->whereHas('enrollmentClearance', function ($eq) {
                    $eq->where(function ($sq) {
                        $sq->where('registrar_clearance', true)
                            ->orWhere('enrollment_status', 'completed');
                    });
                })
                ->orWhere('enrollment_status', 'pending-accounting');
            })
            ->withoutDropped()
            ->withoutTransferredOut()
            ->get(['id', 'school_year', 'department_id']);

        $eligibleStudentIds = $eligibleStudents->pluck('id');
        $snapshots = $this->buildStudentAccountSnapshots($eligibleStudents, $receivablesSchoolYear, $currentSchoolYear);

        $fullyPaid = 0;
        $partialPayment = 0;
        $unpaid = 0;
        $totalOutstanding = 0.0;
        $projectedRevenue = 0.0;
        $totalCollected = 0.0;

        foreach ($snapshots as $snapshot) {
            $totalAmount = (float) $snapshot['total_amount'];
            $paid = (float) $snapshot['total_paid'];
            $balance = (float) $snapshot['balance'];

            // Keep totals aligned with student-accounts receivables math.
            $projectedRevenue += $totalAmount;
            $totalCollected += $paid;
            if ($balance > 0) {
                $totalOutstanding += $balance;
            }

            if ($totalAmount <= 0) {
                continue;
            }

            if ($balance <= 0) {
                $fullyPaid++;
            } elseif ($paid > 0) {
                $partialPayment++;
            } else {
                $unpaid++;
            }
        }

        $totalStudents = $eligibleStudentIds->count();
        // Keep overview KPI inclusive of historical collected payments, including transferred-out records.
        $tuitionCollectedQuery = StudentPayment::query();
        if ($selectedSchoolYear !== 'all') {
            $tuitionCollectedQuery->whereHas('studentFee', fn($q) => $q->where('school_year', $selectedSchoolYear));
        }

        $transferCollectedQuery = OnlineTransaction::query();
        $this->applyTransferFeeTransactionScope($transferCollectedQuery);
        $this->applyTransferFeeSchoolYearFilter($transferCollectedQuery, $selectedSchoolYear);

        $manualTransferCollectedQuery = TransferRequest::query()
            ->whereDoesntHave('onlineTransactions', function ($q) {
                $q->whereIn('status', ['completed', 'verified']);
            });
        $this->applyManualTransferSettlementScope($manualTransferCollectedQuery);

        if ($selectedSchoolYear !== 'all') {
            $manualTransferCollectedQuery->where(function ($q) use ($selectedSchoolYear) {
                $q->whereRaw('TRIM(school_year) = ?', [trim((string) $selectedSchoolYear)])
                    ->orWhere(function ($fallbackScope) use ($selectedSchoolYear) {
                        $fallbackScope->where(function ($nullYearScope) {
                            $nullYearScope->whereNull('school_year')
                                ->orWhere('school_year', '');
                        })->whereHas('student', function ($studentScope) use ($selectedSchoolYear) {
                            $studentScope->whereRaw('TRIM(school_year) = ?', [trim((string) $selectedSchoolYear)]);
                        });
                    });
            });
        }

        $allAccountsProcessedTotal = (float) $tuitionCollectedQuery->sum('amount')
            + (float) $transferCollectedQuery->sum('amount')
            + (float) $manualTransferCollectedQuery->sum('transfer_fee_amount');
        
        $stats = [
            'total_students' => $totalStudents,
            'fully_paid' => $fullyPaid,
            'partial_payment' => $partialPayment,
            'overdue' => collect($snapshots)->filter(fn($row) => (bool) $row['is_overdue'] && (float) $row['balance'] > 0)->count(),
            'document_payments' => DocumentRequest::where('is_paid', true)->count(),
            'total_collected' => $allAccountsProcessedTotal,
        ];

        // Monthly collections for the selected year
        $monthlyCollections = [];
        for ($month = 1; $month <= 12; $month++) {
            $monthStart = Carbon::create($selectedYear, $month, 1)->startOfMonth();
            $monthEnd = Carbon::create($selectedYear, $month, 1)->endOfMonth();

            $transferCollectionsQuery = OnlineTransaction::query()
                ->whereBetween('verified_at', [$monthStart, $monthEnd]);
            $this->applyTransferFeeTransactionScope($transferCollectionsQuery);
            $this->applyTransferFeeSchoolYearFilter($transferCollectionsQuery, $selectedSchoolYear);

            $amount = (float) StudentPayment::whereBetween('payment_date', [$monthStart, $monthEnd])
                ->whereHas('studentFee', fn($q) => $q->where('school_year', $selectedSchoolYear))
                ->sum('amount')
                + (float) $transferCollectionsQuery->sum('amount')
                + (float) DocumentRequest::where('is_paid', true)
                    ->where('accounting_status', 'approved')
                    ->whereIn('student_id', $eligibleStudentIds)
                    ->whereBetween('accounting_approved_at', [$monthStart, $monthEnd])
                    ->sum('fee')
                + (float) DropRequest::where('is_paid', true)
                    ->where('accounting_status', 'approved')
                    ->whereIn('student_id', $eligibleStudentIds)
                    ->whereBetween('accounting_approved_at', [$monthStart, $monthEnd])
                    ->sum('fee_amount');
            
            // Get average time of payment
            $avgTime = StudentPayment::whereBetween('payment_date', [$monthStart, $monthEnd])
                ->whereHas('studentFee', fn($q) => $q->where('school_year', $selectedSchoolYear))
                ->whereNotNull('created_at')
                ->avg(DB::raw('HOUR(created_at)'));
            
            $timeFormatted = $avgTime ? sprintf('%02d:%02d %s', 
                $avgTime > 12 ? $avgTime - 12 : ($avgTime == 0 ? 12 : $avgTime),
                0,
                $avgTime >= 12 ? 'PM' : 'AM'
            ) : 'N/A';

            $monthlyCollections[] = [
                'month' => $month,
                'month_name' => Carbon::create($selectedYear, $month, 1)->format('M'),
                'amount' => (float) $amount,
                'time' => $timeFormatted,
            ];
        }

        // Outstanding balance by department
        $departmentBalances = collect($snapshots)
            ->groupBy('department')
            ->map(function ($rows, $department) {
                $studentCount = $rows->pluck('student_id')->unique()->count();
                $overdueBalance = $rows
                    ->filter(fn($row) => (float) $row['balance'] > 0)
                    ->sum('balance');

                return [
                    'department' => (string) ($department ?: 'Unassigned'),
                    'student_count' => (int) $studentCount,
                    'balance' => (float) $overdueBalance,
                ];
            })
            ->sortByDesc('balance')
            ->take(6)
            ->values()
            ->toArray();

        // Recent payment activities
        $recentPayments = StudentPayment::with(['student'])
            ->whereHas('studentFee', fn($q) => $q->where('school_year', $selectedSchoolYear))
            ->latest('payment_date')
            ->latest('created_at')
            ->take(10)
            ->get()
            ->map(function ($payment) {
                return [
                    'id' => $payment->id,
                    'student_name' => $payment->student?->full_name ?? 'Unknown',
                    'student_photo_url' => $payment->student?->student_photo_url ?? null,
                    'amount' => (float) $payment->amount,
                    'method' => $payment->payment_method ?? 'CASH',
                    'or_number' => $payment->or_number ?? 'N/A',
                    'time_ago' => Carbon::parse($payment->created_at)->diffForHumans(),
                ];
            })
            ->toArray();

        // Calculate average collection time
        $avgHour = StudentPayment::whereYear('payment_date', $selectedYear)
            ->whereHas('studentFee', fn($q) => $q->where('school_year', $selectedSchoolYear))
            ->whereNotNull('created_at')
            ->avg(DB::raw('HOUR(created_at)'));
        
        $averageCollectionTime = $avgHour ? sprintf('%d:%02d %s',
            $avgHour > 12 ? floor($avgHour - 12) : ($avgHour == 0 ? 12 : floor($avgHour)),
            ($avgHour - floor($avgHour)) * 60,
            $avgHour >= 12 ? 'PM' : 'AM'
        ) : 'N/A';

        // Available years
        $years = StudentPayment::selectRaw('YEAR(payment_date) as year')
            ->distinct()
            ->orderBy('year', 'desc')
            ->pluck('year')
            ->toArray();
        
        if (empty($years)) {
            $years = [(int) date('Y')];
        }

        $schoolYears = $availableSchoolYears;

        if (empty($schoolYears)) {
            $schoolYears = [$currentSchoolYear];
        }

        return Inertia::render('accounting/main-dashboard', [
            'stats' => $stats,
            'monthlyCollections' => $monthlyCollections,
            'departmentBalances' => $departmentBalances,
            'recentPayments' => $recentPayments,
            'totalOutstanding' => (float) $totalOutstanding,
            'averageCollectionTime' => $averageCollectionTime,
            'years' => $years,
            'selectedYear' => (int) $selectedYear,
            'schoolYears' => $schoolYears,
            'selectedSchoolYear' => $selectedSchoolYear,
            'projectedRevenue' => (float) $projectedRevenue,
            'totalCollected' => (float) $allAccountsProcessedTotal,
        ]);
    }

    private function buildStudentAccountSnapshots($students, ?string $forcedSchoolYear, string $fallbackSchoolYear): array
    {
        $studentIds = $students->pluck('id')->filter()->values();
        if ($studentIds->isEmpty()) {
            return [];
        }

        $feesByStudentYear = StudentFee::query()
            ->with('payments:id,student_fee_id,amount')
            ->whereIn('student_id', $studentIds)
            ->orderByDesc('updated_at')
            ->orderByDesc('id')
            ->get()
            ->groupBy(function (StudentFee $fee) {
                return $fee->student_id . '|' . trim((string) $fee->school_year);
            });

        $snapshots = [];
        foreach ($students as $student) {
            $targetSchoolYear = $forcedSchoolYear ?: ($student->school_year ?: $fallbackSchoolYear);
            $key = $student->id . '|' . trim((string) $targetSchoolYear);
            /** @var StudentFee|null $fee */
            $fee = $feesByStudentYear->get($key)?->first();

            $totalAmount = (float) ($fee?->total_amount ?? 0);
            $linkedPaid = (float) ($fee ? $fee->payments->sum('amount') : 0);
            $unlinkedPaid = $this->getUnlinkedOnlineTransactionAmountForStudent($student, (string) $targetSchoolYear, $fallbackSchoolYear);
            $totalPaid = $linkedPaid + $unlinkedPaid;
            $balance = max(0, $totalAmount - (float) ($fee?->grant_discount ?? 0) - $totalPaid);

            $snapshots[] = [
                'student_id' => (int) $student->id,
                'department' => $student->department?->name,
                'school_year' => $targetSchoolYear,
                'total_amount' => $totalAmount,
                'total_paid' => $totalPaid,
                'balance' => $balance,
                'is_overdue' => (bool) ($fee?->is_overdue ?? false),
            ];
        }

        return $snapshots;
    }

    private function getUnlinkedOnlineTransactionAmountForStudent(Student $student, string $schoolYear, string $fallbackSchoolYear): float
    {
        $normalizedSchoolYear = trim((string) $schoolYear);
        $billingYear = trim((string) ($student->school_year ?: $fallbackSchoolYear));

        if ($normalizedSchoolYear === '' || $billingYear === '' || $normalizedSchoolYear !== $billingYear) {
            return 0.0;
        }

        return (float) OnlineTransaction::query()
            ->where('student_id', $student->id)
            ->whereNull('student_payment_id')
            ->whereIn('status', ['completed', 'verified'])
            ->sum('amount');
    }

    /**
     * Display the simplified main dashboard.
     */
    public function mainDashboard(Request $request): Response
    {
        $selectedMonth  = (int) $request->get('month', date('n'));
        $selectedYear   = (int) $request->get('year', date('Y'));

        // Demographic filters
        $classification = $request->get('classification');
        $departmentId   = $request->get('department_id');
        $program        = $request->get('program');
        $yearLevel      = $request->get('year_level');
        $section        = $request->get('section');
        $currentSchoolYear = AppSetting::current()?->school_year
            ?? (date('Y') . '-' . (date('Y') + 1));
        $availableSchoolYears = $this->getAvailableSchoolYears();
        $selectedSchoolYear = $this->resolveSelectedSchoolYear(
            $request->get('school_year', $currentSchoolYear),
            $currentSchoolYear,
            $availableSchoolYears
        );

        // Build scoped student IDs
        $studentQ = Student::select('id');
        if ($classification) {
            $studentQ->whereHas('department', fn($q) => $q->where('classification', $classification));
        }
        if ($departmentId) $studentQ->where('department_id', $departmentId);
        if ($program)      $studentQ->where('program', $program);
        if ($yearLevel)    $studentQ->where('year_level', $yearLevel);
        if ($section)      $studentQ->where('section', $section);
        $filteredIds = $studentQ->pluck('id');

        // Financial aggregates should include historical payments even for students who are now dropped/transferred out.
        $financialStudentQ = Student::select('id');
        if ($classification) {
            $financialStudentQ->whereHas('department', fn($q) => $q->where('classification', $classification));
        }
        if ($departmentId) $financialStudentQ->where('department_id', $departmentId);
        if ($program)      $financialStudentQ->where('program', $program);
        if ($yearLevel)    $financialStudentQ->where('year_level', $yearLevel);
        if ($section)      $financialStudentQ->where('section', $section);
        if ($selectedSchoolYear !== 'all') {
            $financialStudentQ->where(function ($q) use ($selectedSchoolYear) {
                $q->where('school_year', $selectedSchoolYear)
                    ->orWhereHas('fees', fn($fq) => $fq->where('school_year', $selectedSchoolYear));
            });
        }
        $financialStudentIds = $financialStudentQ->pluck('id');

        $currentSchoolYear = \App\Models\AppSetting::current()?->school_year
            ?? (date('Y') . '-' . (date('Y') + 1));

        $yearFeeRows = StudentFee::with('payments')
            ->whereIn('student_id', $filteredIds)
            ->where('school_year', $selectedSchoolYear)
            ->get()
            ->groupBy('student_id');

        $fullyPaid = 0;
        $partialPaid = 0;
        $unpaid = 0;
        $totalCollectibles = 0.0;

        foreach ($yearFeeRows as $rows) {
            $totalAmount = (float) $rows->sum('total_amount');
            $discount = (float) $rows->sum('grant_discount');
            $paid = (float) $rows->flatMap->payments->sum('amount');
            $balance = max(0, $totalAmount - $discount - $paid);

            $totalCollectibles += $balance;

            if ($totalAmount <= 0) {
                continue;
            }

            if ($balance <= 0) {
                $fullyPaid++;
            } elseif ($paid > 0) {
                $partialPaid++;
            } else {
                $unpaid++;
            }
        }

        // Get stats scoped to filtered students
        $totalStudents       = $filteredIds->count();
        // Keep simplified dashboard cards on the same fee-ledger basis as receivables/balances.
        $totalCollectedAllAccounts = (float) StudentPayment::whereIn('student_id', $financialStudentIds)
            ->whereHas('studentFee', fn($q) => $q->where('school_year', $currentSchoolYear))
            ->sum('amount');
        if ($selectedSchoolYear !== 'all') {
            $totalCollectedAllAccounts = (float) StudentPayment::whereIn('student_id', $financialStudentIds)
                ->whereHas('studentFee', fn($q) => $q->where('school_year', $selectedSchoolYear))
                ->sum('amount');
        }
        $transferBaseQuery = OnlineTransaction::query();
        $this->applyTransferFeeTransactionScope($transferBaseQuery);
        $this->applyTransferFeeSchoolYearFilter($transferBaseQuery, $selectedSchoolYear);

        if ($classification || $departmentId || $program || $yearLevel || $section) {
            $transferBaseQuery->whereHas('student', function ($q) use ($classification, $departmentId, $program, $yearLevel, $section) {
                if ($classification) {
                    $q->whereHas('department', fn($dq) => $dq->where('classification', $classification));
                }
                if ($departmentId) {
                    $q->where('department_id', $departmentId);
                }
                if ($program) {
                    $q->where('program', $program);
                }
                if ($yearLevel) {
                    $q->where('year_level', $yearLevel);
                }
                if ($section) {
                    $q->where('section', $section);
                }
            });
        }

        $totalCollectedAllAccounts += (float) $transferBaseQuery->sum('amount');

        $stats = [
            'total_students' => $totalStudents,
            'fully_paid' => $fullyPaid,
            'partial_paid' => $partialPaid,
            'unpaid' => $unpaid,
            'total_collectibles' => (string) $totalCollectibles,
            'total_collected_today' => (string) $totalCollectedAllAccounts,
        ];

        // Recent payments with student and recorded_by info
        $recentPayments = StudentPayment::with(['student', 'recordedBy'])
            ->whereIn('student_id', $filteredIds)
            ->latest('payment_date')
            ->latest('created_at')
            ->take(10)
            ->get()
            ->map(function ($payment) {
                return [
                    'id' => $payment->id,
                    'payment_date' => $payment->payment_date->format('Y-m-d'),
                    'or_number' => $payment->or_number,
                    'amount' => (string) $payment->amount,
                    'student' => $payment->student ? [
                        'first_name' => $payment->student->first_name,
                        'last_name' => $payment->student->last_name,
                        'lrn' => $payment->student->lrn,
                    ] : ['first_name' => 'Unknown', 'last_name' => '', 'lrn' => 'N/A'],
                    'recorded_by' => $payment->recordedBy ? [
                        'name' => $payment->recordedBy->name,
                    ] : null,
                ];
            })
            ->toArray();

        // Top pending payments
        $pendingPayments = StudentFee::with(['student'])
            ->whereIn('student_id', $filteredIds)
            ->where('balance', '>', 0)
            ->orderBy('balance', 'desc')
            ->take(10)
            ->get()
            ->map(function ($fee) {
                return [
                    'id' => $fee->id,
                    'balance' => (string) $fee->balance,
                    'total_amount' => (string) $fee->total_amount,
                    'student' => $fee->student ? [
                        'first_name' => $fee->student->first_name,
                        'last_name' => $fee->student->last_name,
                        'lrn' => $fee->student->lrn,
                        'program' => $fee->student->program ?? 'N/A',
                        'year_level' => $fee->student->year_level ?? 'N/A',
                    ] : ['first_name' => 'Unknown', 'last_name' => '', 'lrn' => 'N/A', 'program' => 'N/A', 'year_level' => 'N/A'],
                ];
            })
            ->toArray();

        // Daily income for the selected month
        $monthStart = Carbon::create($selectedYear, $selectedMonth, 1)->startOfMonth();
        $monthEnd = Carbon::create($selectedYear, $selectedMonth, 1)->endOfMonth();
        $daysInMonth = $monthEnd->day;

        $dailyIncome = [];
        for ($day = 1; $day <= $daysInMonth; $day++) {
            $date = Carbon::create($selectedYear, $selectedMonth, $day);
            $dayPayments = StudentPayment::whereIn('student_id', $financialStudentIds)->whereDate('payment_date', $date)->get();
            $dayDocuments = DocumentRequest::query()
                ->whereIn('student_id', $financialStudentIds)
                ->where('is_paid', true)
                ->where('accounting_status', 'approved')
                ->whereDate('accounting_approved_at', $date)
                ->get();
            $dayDrops = DropRequest::query()
                ->whereIn('student_id', $financialStudentIds)
                ->where('is_paid', true)
                ->where('accounting_status', 'approved')
                ->whereDate('accounting_approved_at', $date)
                ->get();

            $total = (float) $dayPayments->sum('amount')
                + (float) (function () use ($date, $selectedSchoolYear, $classification, $departmentId, $program, $yearLevel, $section) {
                    $dayTransferQuery = OnlineTransaction::query()->whereDate('verified_at', $date);
                    $this->applyTransferFeeTransactionScope($dayTransferQuery);
                    $this->applyTransferFeeSchoolYearFilter($dayTransferQuery, $selectedSchoolYear);

                    if ($classification || $departmentId || $program || $yearLevel || $section) {
                        $dayTransferQuery->whereHas('student', function ($sq) use ($classification, $departmentId, $program, $yearLevel, $section) {
                            if ($classification) {
                                $sq->whereHas('department', fn($dq) => $dq->where('classification', $classification));
                            }
                            if ($departmentId) {
                                $sq->where('department_id', $departmentId);
                            }
                            if ($program) {
                                $sq->where('program', $program);
                            }
                            if ($yearLevel) {
                                $sq->where('year_level', $yearLevel);
                            }
                            if ($section) {
                                $sq->where('section', $section);
                            }
                        });
                    }

                    return $dayTransferQuery->sum('amount');
                })()
                + (float) $dayDocuments->sum('fee')
                + (float) $dayDrops->sum('fee_amount');

            $avgHour = null;
            if ($dayPayments->count() > 0) {
                $avgHour = $dayPayments->avg(function ($p) {
                    return Carbon::parse($p->created_at)->hour + Carbon::parse($p->created_at)->minute / 60;
                });
            }

            $timeFormatted = $avgHour !== null
                ? sprintf('%d:%02d %s',
                    $avgHour > 12 ? floor($avgHour - 12) : ($avgHour < 1 ? 12 : floor($avgHour)),
                    round(($avgHour - floor($avgHour)) * 60),
                    $avgHour >= 12 ? 'PM' : 'AM'
                )
                : null;

            $dailyIncome[] = [
                'day' => $day,
                'date' => $date->format('Y-m-d'),
                'day_label' => $date->format('D, M j'),
                'total' => (float) $total,
                'count' => $dayPayments->count() + $dayDocuments->count() + $dayDrops->count(),
                'avg_time' => $timeFormatted,
            ];
        }

        // Months for dropdown
        $months = [];
        for ($m = 1; $m <= 12; $m++) {
            $months[] = [
                'value' => $m,
                'label' => Carbon::create(null, $m)->format('F'),
            ];
        }

        $years = StudentPayment::selectRaw('YEAR(payment_date) as year')
            ->distinct()
            ->orderBy('year', 'desc')
            ->pluck('year')
            ->toArray();

        if (empty($years)) {
            $years = [(int) date('Y')];
        }

        // Filter options
        $departments = Department::orderBy('name')->get()->map(fn($d) => ['value' => (string) $d->id, 'label' => $d->name]);
        $programs    = Student::whereNotNull('program')->where('program', '!=', '')->distinct()->orderBy('program')->pluck('program')->map(fn($v) => ['value' => $v, 'label' => $v]);
        $yearLevels  = Student::whereNotNull('year_level')->where('year_level', '!=', '')->distinct()->orderBy('year_level')->pluck('year_level')->map(fn($v) => ['value' => $v, 'label' => $v]);
        $sections    = Student::whereNotNull('section')->where('section', '!=', '')->distinct()->orderBy('section')->pluck('section')->map(fn($v) => ['value' => $v, 'label' => $v]);

        return Inertia::render('accounting/dashboard', [
            'stats'           => $stats,
            'recentPayments'  => $recentPayments,
            'pendingPayments' => $pendingPayments,
            'dailyIncome'     => $dailyIncome,
            'selectedMonth'   => $selectedMonth,
            'selectedYear'    => $selectedYear,
            'months'          => $months,
            'years'           => $years,
            'departments'     => $departments,
            'programs'        => $programs,
            'yearLevels'      => $yearLevels,
            'sections'        => $sections,
            'filters'         => [
                'classification' => $classification,
                'department_id'  => $departmentId,
                'program'        => $program,
                'year_level'     => $yearLevel,
                'section'        => $section,
            ],
        ]);
    }

    /**
     * Display the account dashboard (aggregate stats with demographic + date filters).
     */
    public function accountDashboard(Request $request): Response
    {
        $accountId = (int) auth()->id();
        $currentUser = auth()->user();
        $isSuperAccounting = $currentUser?->role === User::ROLE_SUPER_ACCOUNTING;

        $accountingAccounts = collect();
        if ($isSuperAccounting) {
            $accountingAccounts = User::query()
                ->whereIn('role', [User::ROLE_ACCOUNTING, User::ROLE_SUPER_ACCOUNTING])
                ->orderBy('name')
                ->get(['id', 'name']);
        }

        $requestedAccountId = (string) $request->get('account_id', 'all');
        if (!$isSuperAccounting) {
            $selectedAccountId = 'all';
        } elseif ($requestedAccountId === 'all') {
            $selectedAccountId = 'all';
        } else {
            $selectedAccountId = $accountingAccounts->contains('id', (int) $requestedAccountId)
                ? (string) ((int) $requestedAccountId)
                : 'all';
        }

        // Demographic filters
        $classification = $request->get('classification');
        $departmentId   = $request->get('department_id');
        $program        = $request->get('program');
        $yearLevel      = $request->get('year_level');
        $section        = $request->get('section');
        $currentSchoolYear = AppSetting::current()?->school_year
            ?? (date('Y') . '-' . (date('Y') + 1));
        $availableSchoolYears = $this->getAvailableSchoolYears();
        $requestedSchoolYear = trim((string) $request->input('school_year', ''));
        if ($requestedSchoolYear === '' || strtolower($requestedSchoolYear) === 'all') {
            $selectedSchoolYear = 'all';
        } else {
            $selectedSchoolYear = $this->resolveSelectedSchoolYear(
                $requestedSchoolYear,
                $currentSchoolYear,
                $availableSchoolYears
            );
        }

        // Date range (fallback to current month)
        $dateFrom      = $request->get('date_from');
        $dateTo        = $request->get('date_to');
        $selectedMonth = (int) $request->get('month', date('n'));
        $selectedYear  = (int) $request->get('year', date('Y'));

        if ($dateFrom && $dateTo) {
            $periodStart = Carbon::parse($dateFrom)->startOfDay();
            $periodEnd   = Carbon::parse($dateTo)->endOfDay();
        } else {
            $periodStart = Carbon::create($selectedYear, $selectedMonth, 1)->startOfMonth();
            $periodEnd   = Carbon::create($selectedYear, $selectedMonth, 1)->endOfMonth();
        }

        // Build scoped student IDs
        $studentQ = Student::select('id');
        if ($classification) {
            $studentQ->whereHas('department', fn($q) => $q->where('classification', $classification));
        }
        if ($departmentId) $studentQ->where('department_id', $departmentId);
        if ($program)      $studentQ->where('program', $program);
        if ($yearLevel)    $studentQ->where('year_level', $yearLevel);
        if ($section)      $studentQ->where('section', $section);
        if ($selectedSchoolYear !== 'all') {
            $studentQ->where(function ($q) use ($selectedSchoolYear) {
                $q->where('school_year', $selectedSchoolYear)
                    ->orWhereHas('fees', fn($fq) => $fq->where('school_year', $selectedSchoolYear));
            });
        }
        $studentIds = $studentQ->pluck('id');

        $transactions = [];
        $dailyCollections = [];

        $paymentsQuery  = StudentPayment::with([
            'recordedBy',
            'student:id,first_name,last_name,middle_name,suffix,lrn,program,year_level,section,department_id',
            'student.department:id,name',
        ])
            ->whereIn('student_id', $studentIds)
            ->whereBetween('payment_date', [$periodStart, $periodEnd]);

        if ($isSuperAccounting && $selectedAccountId !== 'all') {
            $paymentsQuery->where('recorded_by', (int) $selectedAccountId);
        }

        $payments = $paymentsQuery->get();

        $transferTransactionsQuery = OnlineTransaction::query()
            ->with([
                'verifiedBy:id,name',
                'student:id,first_name,last_name,middle_name,suffix,lrn,department_id,year_level,section',
                'student.department:id,name',
                'transferRequest:id,transfer_fee_or_number',
            ])
            ->whereBetween('verified_at', [$periodStart, $periodEnd]);
        $this->applyTransferFeeTransactionScope($transferTransactionsQuery);
        $this->applyTransferFeeSchoolYearFilter($transferTransactionsQuery, $selectedSchoolYear);

        if ($classification || $departmentId || $program || $yearLevel || $section) {
            $transferTransactionsQuery->whereHas('student', function ($q) use ($classification, $departmentId, $program, $yearLevel, $section) {
                if ($classification) {
                    $q->whereHas('department', fn($dq) => $dq->where('classification', $classification));
                }
                if ($departmentId) {
                    $q->where('department_id', $departmentId);
                }
                if ($program) {
                    $q->where('program', $program);
                }
                if ($yearLevel) {
                    $q->where('year_level', $yearLevel);
                }
                if ($section) {
                    $q->where('section', $section);
                }
            });
        }

        if ($isSuperAccounting && $selectedAccountId !== 'all') {
            $transferTransactionsQuery->where('verified_by', (int) $selectedAccountId);
        }

        $transferTransactions = $transferTransactionsQuery->get();

        $manualTransferPaymentsQuery = TransferRequest::query()
            ->with([
                'processedBy:id,name',
                'accountingApprovedBy:id,name',
                'student:id,first_name,last_name,middle_name,suffix,lrn,department_id,year_level,section',
                'student.department:id,name',
            ])
            ->whereIn('student_id', $studentIds)
            ->whereDoesntHave('onlineTransactions', function ($q) {
                $q->whereIn('status', ['completed', 'verified']);
            })
            ->where(function ($q) use ($periodStart, $periodEnd) {
                $q->where(function ($inner) use ($periodStart, $periodEnd) {
                    $inner->whereNotNull('processed_at')
                        ->whereBetween('processed_at', [$periodStart, $periodEnd]);
                })->orWhere(function ($inner) use ($periodStart, $periodEnd) {
                    $inner->whereNull('processed_at')
                        ->whereNotNull('accounting_approved_at')
                        ->whereBetween('accounting_approved_at', [$periodStart, $periodEnd]);
                });
            });
        $this->applyManualTransferSettlementScope($manualTransferPaymentsQuery);

        if ($classification || $departmentId || $program || $yearLevel || $section) {
            $manualTransferPaymentsQuery->whereHas('student', function ($q) use ($classification, $departmentId, $program, $yearLevel, $section) {
                if ($classification) {
                    $q->whereHas('department', fn($dq) => $dq->where('classification', $classification));
                }
                if ($departmentId) {
                    $q->where('department_id', $departmentId);
                }
                if ($program) {
                    $q->where('program', $program);
                }
                if ($yearLevel) {
                    $q->where('year_level', $yearLevel);
                }
                if ($section) {
                    $q->where('section', $section);
                }
            });
        }

        if ($isSuperAccounting && $selectedAccountId !== 'all') {
            $manualTransferPaymentsQuery->where(function ($q) use ($selectedAccountId) {
                $q->where('processed_by', (int) $selectedAccountId)
                    ->orWhere('accounting_approved_by', (int) $selectedAccountId);
            });
        }

        $manualTransferPayments = $manualTransferPaymentsQuery->get();

        $documents = DocumentRequest::with([
                'accountingApprovedBy:id,name',
                'processedBy:id,name',
            'documentFeeItem:id,name,category',
                'student:id,first_name,last_name,middle_name,suffix,lrn,program,year_level,section,department_id',
                'student.department:id,name',
            ])
            ->whereIn('student_id', $studentIds)
            ->where('is_paid', true)
            ->where(function ($q) use ($accountId, $periodStart, $periodEnd, $isSuperAccounting, $selectedAccountId) {
                $q->where(function ($inner) use ($accountId, $periodStart, $periodEnd, $isSuperAccounting, $selectedAccountId) {
                    if ($isSuperAccounting && $selectedAccountId !== 'all') {
                        $inner->where('accounting_approved_by', (int) $selectedAccountId);
                    }

                    $inner
                        ->whereNotNull('accounting_approved_at')
                        ->whereBetween('accounting_approved_at', [$periodStart, $periodEnd]);
                })->orWhere(function ($inner) use ($accountId, $periodStart, $periodEnd, $isSuperAccounting, $selectedAccountId) {
                    if ($isSuperAccounting && $selectedAccountId !== 'all') {
                        $inner->where('processed_by', (int) $selectedAccountId);
                    }

                    $inner
                        ->whereBetween('created_at', [$periodStart, $periodEnd]);
                });
            })
            ->get();

        $dropRequests = DropRequest::query()
            ->with([
                'processedBy:id,name',
                'accountingApprovedBy:id,name',
                'student:id,first_name,last_name,middle_name,suffix,lrn,program,year_level,section,department_id',
                'student.department:id,name',
            ])
            ->whereIn('student_id', $studentIds);
        $this->applyDropCollectionScope($dropRequests);

        $dropRequests = $dropRequests->where(function ($q) use ($accountId, $periodStart, $periodEnd, $isSuperAccounting, $selectedAccountId) {
                $q->where(function ($inner) use ($accountId, $periodStart, $periodEnd, $isSuperAccounting, $selectedAccountId) {
                    if ($isSuperAccounting && $selectedAccountId !== 'all') {
                        $inner->where('accounting_approved_by', (int) $selectedAccountId);
                    }

                    $inner
                        ->whereNotNull('accounting_approved_at')
                        ->whereBetween('accounting_approved_at', [$periodStart, $periodEnd]);
                })->orWhere(function ($inner) use ($accountId, $periodStart, $periodEnd, $isSuperAccounting, $selectedAccountId) {
                    if ($isSuperAccounting && $selectedAccountId !== 'all') {
                        $inner->where('processed_by', (int) $selectedAccountId);
                    }

                    $inner
                        ->whereNotNull('processed_at')
                        ->whereBetween('processed_at', [$periodStart, $periodEnd]);
                });
            })
            ->get();

        $transferCount = $transferTransactions->count() + $manualTransferPayments->count();
        $feeCount    = $payments->count() + $transferCount;
        $docCount    = $documents->count();
        $dropCount   = $dropRequests->count();
        $feeSum      = (float) $payments->sum('amount')
            + (float) $transferTransactions->sum('amount')
            + (float) $manualTransferPayments->sum('transfer_fee_amount');
        $docSum      = (float) $documents->sum('fee');
        $dropSum     = (float) $dropRequests->sum('fee_amount');
        $overallFeePaidQuery = StudentPayment::whereIn('student_id', $studentIds);
        if ($isSuperAccounting && $selectedAccountId !== 'all') {
            $overallFeePaidQuery->where('recorded_by', (int) $selectedAccountId);
        }
        $overallFeePaid = (float) $overallFeePaidQuery->sum('amount');
        $overallTransferPaidQuery = OnlineTransaction::query();
        $this->applyTransferFeeTransactionScope($overallTransferPaidQuery);
        $this->applyTransferFeeSchoolYearFilter($overallTransferPaidQuery, $selectedSchoolYear);

        $overallFeePaid += (float) $overallTransferPaidQuery
            ->when($classification || $departmentId || $program || $yearLevel || $section, function ($q) use ($classification, $departmentId, $program, $yearLevel, $section) {
                $q->whereHas('student', function ($sq) use ($classification, $departmentId, $program, $yearLevel, $section) {
                    if ($classification) {
                        $sq->whereHas('department', fn($dq) => $dq->where('classification', $classification));
                    }
                    if ($departmentId) {
                        $sq->where('department_id', $departmentId);
                    }
                    if ($program) {
                        $sq->where('program', $program);
                    }
                    if ($yearLevel) {
                        $sq->where('year_level', $yearLevel);
                    }
                    if ($section) {
                        $sq->where('section', $section);
                    }
                });
            })
            ->when($isSuperAccounting && $selectedAccountId !== 'all', fn($q) => $q->where('verified_by', (int) $selectedAccountId))
            ->sum('amount');

        $overallManualTransferPaidQuery = TransferRequest::query()
            ->whereIn('student_id', $studentIds)
            ->whereDoesntHave('onlineTransactions', function ($q) {
                $q->whereIn('status', ['completed', 'verified']);
            });
        $this->applyManualTransferSettlementScope($overallManualTransferPaidQuery);

        if ($classification || $departmentId || $program || $yearLevel || $section) {
            $overallManualTransferPaidQuery->whereHas('student', function ($sq) use ($classification, $departmentId, $program, $yearLevel, $section) {
                if ($classification) {
                    $sq->whereHas('department', fn($dq) => $dq->where('classification', $classification));
                }
                if ($departmentId) {
                    $sq->where('department_id', $departmentId);
                }
                if ($program) {
                    $sq->where('program', $program);
                }
                if ($yearLevel) {
                    $sq->where('year_level', $yearLevel);
                }
                if ($section) {
                    $sq->where('section', $section);
                }
            });
        }

        if ($isSuperAccounting && $selectedAccountId !== 'all') {
            $overallManualTransferPaidQuery->where(function ($q) use ($selectedAccountId) {
                $q->where('processed_by', (int) $selectedAccountId)
                    ->orWhere('accounting_approved_by', (int) $selectedAccountId);
            });
        }

        $overallFeePaid += (float) $overallManualTransferPaidQuery->sum('transfer_fee_amount');

        $overallDocumentPaidQuery = DocumentRequest::whereIn('student_id', $studentIds)
            ->where('is_paid', true)
            ->where(function ($q) use ($accountId, $isSuperAccounting, $selectedAccountId) {
                if ($isSuperAccounting && $selectedAccountId !== 'all') {
                    $q->where('accounting_approved_by', (int) $selectedAccountId)
                        ->orWhere('processed_by', (int) $selectedAccountId);
                }
            });
        $overallDocumentPaid = (float) $overallDocumentPaidQuery->sum('fee');

        $overallDropPaidQuery = DropRequest::query()
            ->whereIn('student_id', $studentIds);
        $this->applyDropCollectionScope($overallDropPaidQuery);

        $overallDropPaidQuery = $overallDropPaidQuery->where(function ($q) use ($accountId, $isSuperAccounting, $selectedAccountId) {
                if ($isSuperAccounting && $selectedAccountId !== 'all') {
                    $q->where('accounting_approved_by', (int) $selectedAccountId)
                        ->orWhere('processed_by', (int) $selectedAccountId);
                }
            });
        $overallDropPaid = (float) $overallDropPaidQuery->sum('fee_amount');
        $overallPaid = $overallFeePaid + $overallDocumentPaid + $overallDropPaid;
        $feesBilled  = (float) StudentFee::whereIn('student_id', $studentIds)->sum('total_amount');
        $rate        = $feesBilled > 0
            ? min(round(($overallFeePaid / $feesBilled) * 100, 1), 100)
            : ($overallFeePaid > 0 ? 100 : 0);

        $stats = [
            'total_transactions'       => $feeCount + $docCount + $dropCount,
            'fee_transactions'         => $feeCount,
            'document_transactions'    => $docCount,
            'drop_transactions'        => $dropCount,
            'collection_rate'          => $rate,
            'total_fees_processed'     => $feeSum,
            'total_document_processed' => $docSum,
            'total_drop_processed'     => $dropSum,
            'total_amount_processed'   => $feeSum + $docSum + $dropSum,
            'overall_amount_processed' => $overallPaid,
        ];

        $accountingBreakdown = collect();
        if ($isSuperAccounting) {
            $accountingBreakdown = $accountingAccounts->map(function ($account) use ($studentIds, $periodStart, $periodEnd, $selectedSchoolYear, $classification, $departmentId, $program, $yearLevel, $section) {
                $accountId = (int) $account->id;

                $feeTotal = (float) StudentPayment::whereIn('student_id', $studentIds)
                    ->where('recorded_by', $accountId)
                    ->whereBetween('payment_date', [$periodStart, $periodEnd])
                    ->sum('amount');
                $accountTransferTotalQuery = OnlineTransaction::query();
                $this->applyTransferFeeTransactionScope($accountTransferTotalQuery);
                $this->applyTransferFeeSchoolYearFilter($accountTransferTotalQuery, $selectedSchoolYear);

                $feeTotal += (float) $accountTransferTotalQuery
                    ->when($classification || $departmentId || $program || $yearLevel || $section, function ($q) use ($classification, $departmentId, $program, $yearLevel, $section) {
                        $q->whereHas('student', function ($sq) use ($classification, $departmentId, $program, $yearLevel, $section) {
                            if ($classification) {
                                $sq->whereHas('department', fn($dq) => $dq->where('classification', $classification));
                            }
                            if ($departmentId) {
                                $sq->where('department_id', $departmentId);
                            }
                            if ($program) {
                                $sq->where('program', $program);
                            }
                            if ($yearLevel) {
                                $sq->where('year_level', $yearLevel);
                            }
                            if ($section) {
                                $sq->where('section', $section);
                            }
                        });
                    })
                    ->where('verified_by', $accountId)
                    ->whereBetween('verified_at', [$periodStart, $periodEnd])
                    ->sum('amount');

                $accountManualTransferQuery = TransferRequest::query()
                    ->whereIn('student_id', $studentIds)
                    ->whereDoesntHave('onlineTransactions', function ($q) {
                        $q->whereIn('status', ['completed', 'verified']);
                    })
                    ->when($classification || $departmentId || $program || $yearLevel || $section, function ($q) use ($classification, $departmentId, $program, $yearLevel, $section) {
                        $q->whereHas('student', function ($sq) use ($classification, $departmentId, $program, $yearLevel, $section) {
                            if ($classification) {
                                $sq->whereHas('department', fn($dq) => $dq->where('classification', $classification));
                            }
                            if ($departmentId) {
                                $sq->where('department_id', $departmentId);
                            }
                            if ($program) {
                                $sq->where('program', $program);
                            }
                            if ($yearLevel) {
                                $sq->where('year_level', $yearLevel);
                            }
                            if ($section) {
                                $sq->where('section', $section);
                            }
                        });
                    })
                    ->where(function ($q) use ($accountId) {
                        $q->where('processed_by', $accountId)
                            ->orWhere('accounting_approved_by', $accountId);
                    })
                    ->where(function ($q) use ($periodStart, $periodEnd) {
                        $q->where(function ($inner) use ($periodStart, $periodEnd) {
                            $inner->whereNotNull('processed_at')
                                ->whereBetween('processed_at', [$periodStart, $periodEnd]);
                        })->orWhere(function ($inner) use ($periodStart, $periodEnd) {
                            $inner->whereNull('processed_at')
                                ->whereNotNull('accounting_approved_at')
                                ->whereBetween('accounting_approved_at', [$periodStart, $periodEnd]);
                        });
                    });
                $this->applyManualTransferSettlementScope($accountManualTransferQuery);
                $accountManualTransferTotal = (float) $accountManualTransferQuery->sum('transfer_fee_amount');

                $feeTotal += $accountManualTransferTotal;

                $documentTotal = (float) DocumentRequest::whereIn('student_id', $studentIds)
                    ->where('is_paid', true)
                    ->where(function ($q) use ($accountId, $periodStart, $periodEnd) {
                        $q->where(function ($inner) use ($accountId, $periodStart, $periodEnd) {
                            $inner->where('accounting_approved_by', $accountId)
                                ->whereNotNull('accounting_approved_at')
                                ->whereBetween('accounting_approved_at', [$periodStart, $periodEnd]);
                        })->orWhere(function ($inner) use ($accountId, $periodStart, $periodEnd) {
                            $inner->where('processed_by', $accountId)
                                ->whereBetween('created_at', [$periodStart, $periodEnd]);
                        });
                    })
                    ->sum('fee');

                $accountDropQuery = DropRequest::query()
                    ->whereIn('student_id', $studentIds);
                $this->applyDropCollectionScope($accountDropQuery);

                $dropTotal = (float) $accountDropQuery->where(function ($q) use ($accountId, $periodStart, $periodEnd) {
                        $q->where(function ($inner) use ($accountId, $periodStart, $periodEnd) {
                            $inner->where('accounting_approved_by', $accountId)
                                ->whereNotNull('accounting_approved_at')
                                ->whereBetween('accounting_approved_at', [$periodStart, $periodEnd]);
                        })->orWhere(function ($inner) use ($accountId, $periodStart, $periodEnd) {
                            $inner->where('processed_by', $accountId)
                                ->whereNotNull('processed_at')
                                ->whereBetween('processed_at', [$periodStart, $periodEnd]);
                        });
                    })
                    ->sum('fee_amount');

                return [
                    'account_id' => (string) $account->id,
                    'account_name' => (string) $account->name,
                    'total_amount_processed' => (float) ($feeTotal + $documentTotal + $dropTotal),
                ];
            })->values();
        }

        $paymentSummary = [
            'cash'  => (float) $payments->filter(fn($p) => $this->normalizePaymentMode($p->payment_mode, $p->payment_method) === 'CASH')->sum('amount'),
            'gcash' => (float) $payments->filter(fn($p) => $this->normalizePaymentMode($p->payment_mode, $p->payment_method) === 'GCASH')->sum('amount'),
            'bank'  => (float) $payments->filter(fn($p) => $this->normalizePaymentMode($p->payment_mode, $p->payment_method) === 'BANK')->sum('amount'),
        ];

        // Daily collections across the period
        $periodDay    = $periodStart->copy()->startOfDay();
        $periodEndDay = $periodEnd->copy()->startOfDay();
        while ($periodDay->lte($periodEndDay)) {
            $dayPayments = $payments->filter(fn($p) => Carbon::parse($p->payment_date)->isSameDay($periodDay));
            $dayTransfer = $transferTransactions->filter(fn($t) => $t->verified_at && Carbon::parse($t->verified_at)->isSameDay($periodDay));
            $dayManualTransfer = $manualTransferPayments->filter(function ($transferRequest) use ($periodDay) {
                $eventAt = $transferRequest->processed_at ?: $transferRequest->accounting_approved_at;

                return $eventAt && Carbon::parse($eventAt)->isSameDay($periodDay);
            });
            $dayAmount   = (float) $dayPayments->sum('amount')
                + (float) $dayTransfer->sum('amount')
                + (float) $dayManualTransfer->sum('transfer_fee_amount');
            if ($dayAmount > 0) {
                $avgHour = $dayPayments->avg(fn($p) => Carbon::parse($p->created_at)->hour);
                $avgTime = $avgHour !== null
                    ? sprintf('%d:%02d %s',
                        $avgHour > 12 ? floor($avgHour - 12) : ($avgHour == 0 ? 12 : floor($avgHour)),
                        0,
                        $avgHour >= 12 ? 'PM' : 'AM'
                    ) : 'N/A';
                $dailyCollections[] = [
                    'day'    => $periodDay->day,
                    'date'   => $periodDay->format('Y-m-d'),
                    'amount' => $dayAmount,
                    'time'   => $avgTime,
                ];
            }
            $periodDay->addDay();
        }

        // Recent transactions (top 25 payments + top 10 documents)
        foreach ($payments->sortByDesc('payment_date')->take(25) as $p) {
            $sortAt = Carbon::parse($p->created_at)->timestamp;
            $displayOrNumber = $this->resolveRefundDisplayOrNumber(
                $p->or_number,
                (float) $p->amount,
                (string) ($p->notes ?? '')
            );

            $transactions[] = [
                'id'           => $p->id,
                'date'         => Carbon::parse($p->payment_date)->format('Y-m-d'),
                'time'         => Carbon::parse($p->created_at)->format('h:i A'),
                'type'         => 'Fee',
                'or_number'    => $displayOrNumber ?? 'N/A',
                'mode'         => $this->normalizePaymentMode($p->payment_mode, $p->payment_method),
                'reference'    => $p->reference_number,
                'amount'       => (float) $p->amount,
                'student_id'   => $p->student_id,
                'student_name' => $p->student?->full_name,
                'student_lrn' => $p->student?->lrn,
                'student_department' => $p->student?->department?->name,
                'student_year_level' => $p->student?->year_level,
                'student_section' => $p->student?->section,
                'processed_by' => $p->recordedBy?->name ?? 'N/A',
                'sort_at'      => $sortAt,
            ];
        }
        foreach ($transferTransactions->sortByDesc('verified_at')->take(10) as $transferTx) {
            $transferDateTime = Carbon::parse($transferTx->verified_at ?? $transferTx->transaction_date ?? $transferTx->created_at);
            $resolvedTransferOrNumber = trim((string) ($transferTx->transferRequest?->transfer_fee_or_number ?? ''));
            if ($resolvedTransferOrNumber === '' && preg_match('/\[OR:([^\]]+)\]/i', (string) ($transferTx->remarks ?? ''), $orMatches) === 1) {
                $resolvedTransferOrNumber = trim((string) ($orMatches[1] ?? ''));
            }
            if ($resolvedTransferOrNumber === '') {
                $resolvedTransferOrNumber = (string) ($transferTx->transaction_id ?? 'N/A');
            }

            $transactions[] = [
                'id'           => 'transfer-' . $transferTx->id,
                'date'         => $transferDateTime->format('Y-m-d'),
                'time'         => $transferDateTime->format('h:i A'),
                'type'         => 'Transfer',
                'or_number'    => $resolvedTransferOrNumber,
                'mode'         => strtoupper((string) ($transferTx->payment_method ?? 'ONLINE')),
                'reference'    => 'Transfer Out Fee',
                'amount'       => (float) $transferTx->amount,
                'student_id'   => $transferTx->student_id,
                'student_name' => $transferTx->student?->full_name,
                'student_lrn' => $transferTx->student?->lrn,
                'student_department' => $transferTx->student?->department?->name,
                'student_year_level' => $transferTx->student?->year_level,
                'student_section' => $transferTx->student?->section,
                'processed_by' => $transferTx->verifiedBy?->name ?? 'N/A',
                'sort_at'      => $transferDateTime->timestamp,
            ];
        }
        foreach ($manualTransferPayments->sortByDesc(function ($transferRequest) {
            $eventAt = $transferRequest->processed_at ?: $transferRequest->accounting_approved_at ?: $transferRequest->updated_at;

            return Carbon::parse($eventAt)->timestamp;
        })->take(10) as $transferRequest) {
            $eventAt = Carbon::parse($transferRequest->processed_at ?: $transferRequest->accounting_approved_at ?: $transferRequest->updated_at);
            $transactions[] = [
                'id'           => 'transfer-manual-' . $transferRequest->id,
                'date'         => $eventAt->format('Y-m-d'),
                'time'         => $eventAt->format('h:i A'),
                'type'         => 'Transfer',
                'or_number'    => $transferRequest->transfer_fee_or_number ?? ('TRF' . str_pad((string) $transferRequest->id, 3, '0', STR_PAD_LEFT)),
                'mode'         => 'CASH',
                'reference'    => 'Transfer Out Fee',
                'amount'       => (float) $transferRequest->transfer_fee_amount,
                'student_id'   => $transferRequest->student_id,
                'student_name' => $transferRequest->student?->full_name,
                'student_lrn' => $transferRequest->student?->lrn,
                'student_department' => $transferRequest->student?->department?->name,
                'student_year_level' => $transferRequest->student?->year_level,
                'student_section' => $transferRequest->student?->section,
                'processed_by' => $transferRequest->processedBy?->name ?? $transferRequest->accountingApprovedBy?->name ?? 'N/A',
                'sort_at'      => $eventAt->timestamp,
            ];
        }
        foreach ($documents->take(10) as $doc) {
            $docDateTime = Carbon::parse($doc->created_at);
            $transactions[] = [
                'id'           => 'doc-' . $doc->id,
                'date'         => $docDateTime->format('Y-m-d'),
                'time'         => $docDateTime->format('h:i A'),
                'type'         => 'Document',
                'or_number'    => 'DOC' . str_pad($doc->id, 3, '0', STR_PAD_LEFT),
                'mode'         => strtoupper($doc->payment_type ?? 'CASH'),
                'reference'    => $this->resolveDocumentReferenceLabel($doc),
                'amount'       => (float) $doc->fee,
                'student_id'   => $doc->student_id,
                'student_name' => $doc->student?->full_name,
                'student_lrn' => $doc->student?->lrn,
                'student_department' => $doc->student?->department?->name,
                'student_year_level' => $doc->student?->year_level,
                'student_section' => $doc->student?->section,
                'processed_by' => $doc->accountingApprovedBy?->name ?? $doc->processedBy?->name ?? 'N/A',
                'sort_at'      => $docDateTime->timestamp,
            ];
        }
        foreach ($dropRequests->take(10) as $drop) {
            $dropDateTime = Carbon::parse($drop->accounting_approved_at ?: $drop->processed_at ?: $drop->updated_at);
            $transactions[] = [
                'id'           => 'drop-' . $drop->id,
                'date'         => $dropDateTime->format('Y-m-d'),
                'time'         => $dropDateTime->format('h:i A'),
                'type'         => 'Drop',
                'or_number'    => $drop->or_number ?? ('DRP' . str_pad($drop->id, 3, '0', STR_PAD_LEFT)),
                'mode'         => 'CASH',
                'reference'    => 'Drop Request',
                'amount'       => (float) $drop->fee_amount,
                'student_id'   => $drop->student_id,
                'student_name' => $drop->student?->full_name,
                'student_lrn' => $drop->student?->lrn,
                'student_department' => $drop->student?->department?->name,
                'student_year_level' => $drop->student?->year_level,
                'student_section' => $drop->student?->section,
                'processed_by' => $drop->processedBy?->name ?? $drop->accountingApprovedBy?->name ?? 'N/A',
                'sort_at'      => $dropDateTime->timestamp,
            ];
        }
        usort($transactions, fn($a, $b) => ($b['sort_at'] ?? 0) <=> ($a['sort_at'] ?? 0));
        $transactions = array_map(function ($tx) {
            unset($tx['sort_at']);
            return $tx;
        }, $transactions);

        // Filter options
        $departments = Department::orderBy('name')->get()->map(fn($d) => ['value' => (string) $d->id, 'label' => $d->name]);
        $programs    = Student::whereNotNull('program')->where('program', '!=', '')->distinct()->orderBy('program')->pluck('program')->map(fn($v) => ['value' => $v, 'label' => $v]);
        $yearLevels  = Student::whereNotNull('year_level')->where('year_level', '!=', '')->distinct()->orderBy('year_level')->pluck('year_level')->map(fn($v) => ['value' => $v, 'label' => $v]);
        $sections    = Student::whereNotNull('section')->where('section', '!=', '')->distinct()->orderBy('section')->pluck('section')->map(fn($v) => ['value' => $v, 'label' => $v]);

        $months = [];
        for ($m = 1; $m <= 12; $m++) {
            $months[] = ['value' => $m, 'label' => Carbon::create(null, $m, 1)->format('F')];
        }
        $years = StudentPayment::selectRaw('YEAR(payment_date) as year')->distinct()->orderBy('year', 'desc')->pluck('year')->toArray();
        if (empty($years)) $years = [(int) date('Y')];

        $schoolYears = $availableSchoolYears;

        if (empty($schoolYears)) {
            $schoolYears = [$currentSchoolYear];
        }

        $appSettings = AppSetting::current();

        return Inertia::render($this->viewPrefix() . '/account-dashboard', [
            'stats'            => $stats,
            'transactions'     => array_values($transactions),
            'dailyCollections' => $dailyCollections,
            'paymentSummary'   => $paymentSummary,
            'departments'      => $departments,
            'programs'         => $programs,
            'yearLevels'       => $yearLevels,
            'sections'         => $sections,
            'accountingAccounts' => $accountingAccounts->map(fn($account) => [
                'value' => (string) $account->id,
                'label' => $account->name,
            ])->values(),
            'accountingBreakdown' => $accountingBreakdown,
            'selectedMonth'    => $selectedMonth,
            'selectedYear'     => $selectedYear,
            'months'           => $months,
            'years'            => array_values($years),
            'schoolYears'      => $schoolYears,
            'selectedSchoolYear' => $selectedSchoolYear,
            'appSettings'      => [
                'has_k12' => $appSettings->has_k12,
                'has_college' => $appSettings->has_college,
            ],
            'filters'          => [
                'classification' => $classification,
                'department_id'  => $departmentId,
                'program'        => $program,
                'year_level'     => $yearLevel,
                'section'        => $section,
                'account_id'     => $selectedAccountId,
                'date_from'      => $dateFrom,
                'date_to'        => $dateTo,
                'month'          => $selectedMonth,
                'year'           => $selectedYear,
                'school_year'    => $selectedSchoolYear,
            ],
        ]);
    }

    /**
     * Export dashboard data (main dashboard — monthly collections).
     */
    public function export(Request $request)
    {
        $selectedYear = $request->get('year', date('Y'));

        $rows = [];
        $rows[] = ['Month', 'Amount Collected'];

        for ($month = 1; $month <= 12; $month++) {
            $monthStart = Carbon::create($selectedYear, $month, 1)->startOfMonth();
            $monthEnd   = Carbon::create($selectedYear, $month, 1)->endOfMonth();
            $amount     = (float) StudentPayment::whereBetween('payment_date', [$monthStart, $monthEnd])->sum('amount')
                + (float) DocumentRequest::where('is_paid', true)
                    ->where('accounting_status', 'approved')
                    ->whereBetween('accounting_approved_at', [$monthStart, $monthEnd])
                    ->sum('fee')
                + (float) DropRequest::where('is_paid', true)
                    ->where('accounting_status', 'approved')
                    ->whereBetween('accounting_approved_at', [$monthStart, $monthEnd])
                    ->sum('fee_amount');
            $rows[]     = [Carbon::create($selectedYear, $month, 1)->format('F Y'), number_format((float) $amount, 2, '.', '')];
        }

        return $this->streamCsv("dashboard-export-{$selectedYear}.csv", $rows);
    }

    /**
     * Export account dashboard data (transactions for a period).
     */
    public function exportAccountDashboard(Request $request)
    {
        $accountId = (int) auth()->id();
        $currentUser = auth()->user();
        $isSuperAccounting = $currentUser?->role === User::ROLE_SUPER_ACCOUNTING;

        // Re-use the same demographic / date filters as the accountDashboard view
        $classification = $request->get('classification');
        $departmentId   = $request->get('department_id');
        $program        = $request->get('program');
        $yearLevel      = $request->get('year_level');
        $section        = $request->get('section');
        $currentSchoolYear = AppSetting::current()?->school_year
            ?? (date('Y') . '-' . (date('Y') + 1));
        $selectedSchoolYear = trim((string) $request->get('school_year', $currentSchoolYear));
        if ($selectedSchoolYear === '') {
            $selectedSchoolYear = $currentSchoolYear;
        }
        $selectedAccountId = (string) $request->get('account_id', 'all');
        $dateFrom       = $request->get('date_from');
        $dateTo         = $request->get('date_to');
        $selectedMonth  = (int) $request->get('month', date('n'));
        $selectedYear   = (int) $request->get('year', date('Y'));

        if ($dateFrom && $dateTo) {
            $periodStart = Carbon::parse($dateFrom)->startOfDay();
            $periodEnd   = Carbon::parse($dateTo)->endOfDay();
        } else {
            $periodStart = Carbon::create($selectedYear, $selectedMonth, 1)->startOfMonth();
            $periodEnd   = Carbon::create($selectedYear, $selectedMonth, 1)->endOfMonth();
        }

        $studentQ = Student::select('id')
            ->withoutDropped()
            ->withoutTransferredOut();
        if ($classification) {
            $studentQ->whereHas('department', fn($q) => $q->where('classification', $classification));
        }
        if ($departmentId) $studentQ->where('department_id', $departmentId);
        if ($program)      $studentQ->where('program', $program);
        if ($yearLevel)    $studentQ->where('year_level', $yearLevel);
        if ($section)      $studentQ->where('section', $section);
        if ($selectedSchoolYear !== 'all') {
            $studentQ->where(function ($q) use ($selectedSchoolYear) {
                $q->where('school_year', $selectedSchoolYear)
                    ->orWhereHas('fees', fn($fq) => $fq->where('school_year', $selectedSchoolYear));
            });
        }
        $studentIds = $studentQ->pluck('id');

        $payments = StudentPayment::with(['student', 'recordedBy'])
            ->whereIn('student_id', $studentIds)
            ->whereBetween('payment_date', [$periodStart, $periodEnd])
            ->orderBy('payment_date', 'desc');

        if (!$isSuperAccounting) {
            $payments->where('recorded_by', $accountId);
        } elseif ($selectedAccountId !== 'all') {
            $payments->where('recorded_by', (int) $selectedAccountId);
        }

        $payments = $payments->get();

        $rows = [];
        $rows[] = ['Date', 'Time', 'Student', 'LRN', 'OR Number', 'Mode', 'Reference', 'Amount', 'Processed By'];

        foreach ($payments as $p) {
            $rows[] = [
                Carbon::parse($p->payment_date)->format('Y-m-d'),
                $p->created_at->format('h:i A'),
                $p->student?->full_name ?? 'Unknown',
                $p->student?->lrn ?? 'N/A',
                $p->or_number ?? 'N/A',
                $this->normalizePaymentMode($p->payment_mode, $p->payment_method),
                $p->reference_number ?? '',
                number_format((float) $p->amount, 2, '.', ''),
                $p->recordedBy?->name ?? 'N/A',
            ];
        }

        $filename = 'account-dashboard-export-' . $periodStart->format('Ymd') . '-' . $periodEnd->format('Ymd') . '.csv';

        return $this->streamCsv($filename, $rows);
    }

    private function applyTransferFeeTransactionScope($query): void
    {
        $query
            ->whereIn('status', ['completed', 'verified'])
            ->where(function ($scope) {
                $scope->whereNotNull('transfer_request_id')
                    ->orWhere('payment_context', 'transfer_out_fee')
                    ->orWhere('remarks', 'like', '%[PaymentType: transfer_out_fee]%');
            });
    }

    private function applyTransferFeeSchoolYearFilter($query, ?string $selectedSchoolYear): void
    {
        $normalizedSchoolYear = trim((string) $selectedSchoolYear);
        if ($normalizedSchoolYear === '' || strtolower($normalizedSchoolYear) === 'all') {
            return;
        }

        $query->where(function ($scope) use ($normalizedSchoolYear) {
            $scope->whereHas('transferRequest', function ($transferQuery) use ($normalizedSchoolYear) {
                $transferQuery->where(function ($transferYearScope) use ($normalizedSchoolYear) {
                    $transferYearScope->whereRaw('TRIM(school_year) = ?', [$normalizedSchoolYear])
                        ->orWhere(function ($fallbackYearScope) use ($normalizedSchoolYear) {
                            $fallbackYearScope->where(function ($nullYearScope) {
                                $nullYearScope->whereNull('school_year')
                                    ->orWhere('school_year', '');
                            })->whereHas('student', function ($studentQuery) use ($normalizedSchoolYear) {
                                $studentQuery->whereRaw('TRIM(school_year) = ?', [$normalizedSchoolYear]);
                            });
                        });
                });
            })->orWhere(function ($fallbackQuery) use ($normalizedSchoolYear) {
                $fallbackQuery->whereNull('transfer_request_id')
                    ->where(function ($legacyScope) use ($normalizedSchoolYear) {
                        $legacyScope->whereHas('student', function ($studentQuery) use ($normalizedSchoolYear) {
                            $studentQuery->whereRaw('TRIM(school_year) = ?', [$normalizedSchoolYear]);
                        })->orWhere('remarks', 'like', '%[SchoolYear:' . $normalizedSchoolYear . '%');
                    });
            });
        });
    }

    private function applyManualTransferSettlementScope($query): void
    {
        $query
            ->where('accounting_status', 'approved')
            ->where('transfer_fee_amount', '>', 0)
            ->where(function ($scope) {
                $scope->where('transfer_fee_paid', true)
                    ->orWhere(function ($orScope) {
                        $orScope->whereNotNull('transfer_fee_or_number')
                            ->whereRaw("TRIM(transfer_fee_or_number) <> ''");
                    });
            });
    }

    private function applyDropCollectionScope($query): void
    {
        $query
            ->where('accounting_status', 'approved')
            ->where(function ($scope) {
                $scope->where('is_paid', true)
                    ->orWhere('fee_amount', '<=', 0);
            });
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

    private function resolveDocumentReferenceLabel(DocumentRequest $document): string
    {
        $feeItemName = trim((string) ($document->documentFeeItem?->name ?? ''));
        if ($feeItemName !== '') {
            return $feeItemName;
        }

        $label = trim((string) ($document->document_type_label ?? ''));
        if ($label !== '' && !in_array(strtolower($label), ['document_process', 'document process'], true)) {
            return $label;
        }

        $rawType = trim((string) ($document->document_type ?? ''));
        if ($rawType === '') {
            return 'Document';
        }

        return ucwords(str_replace(['_', '-'], ' ', strtolower($rawType)));
    }

    /**
     * Stream an array of rows as a CSV download.
     */
    private function streamCsv(string $filename, array $rows): \Symfony\Component\HttpFoundation\StreamedResponse
    {
        return response()->streamDownload(function () use ($rows) {
            $handle = fopen('php://output', 'w');
            foreach ($rows as $row) {
                fputcsv($handle, $row);
            }
            fclose($handle);
        }, $filename, [
            'Content-Type' => 'text/csv',
        ]);
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
}
