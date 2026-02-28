<?php

namespace App\Http\Controllers\SuperAccounting;

use App\Http\Controllers\Controller;
use App\Models\Department;
use App\Models\Student;
use App\Models\StudentFee;
use App\Models\StudentPayment;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function index(Request $request): Response
    {
        $selectedMonth  = (int) $request->get('month', date('n'));
        $selectedYear   = (int) $request->get('year', date('Y'));

        // Demographic filters
        $classification = $request->get('classification');
        $departmentId   = $request->get('department_id');
        $program        = $request->get('program');
        $yearLevel      = $request->get('year_level');
        $section        = $request->get('section');

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

        // Stats scoped to filtered students
        $totalStudents       = $filteredIds->count();
        $fullyPaid           = StudentFee::whereIn('student_id', $filteredIds)->where('balance', '<=', 0)->count();
        $partialPaid         = StudentFee::whereIn('student_id', $filteredIds)->where('total_paid', '>', 0)->where('balance', '>', 0)->count();
        $unpaid              = StudentFee::whereIn('student_id', $filteredIds)->where('total_paid', 0)->where('balance', '>', 0)->count();
        $totalCollectibles   = StudentFee::whereIn('student_id', $filteredIds)->where('balance', '>', 0)->sum('balance');
        $totalCollectedToday = StudentPayment::whereIn('student_id', $filteredIds)->whereDate('payment_date', today())->sum('amount');

        $stats = [
            'total_students'        => $totalStudents,
            'fully_paid'            => $fullyPaid,
            'partial_paid'          => $partialPaid,
            'unpaid'                => $unpaid,
            'total_collectibles'    => (string) $totalCollectibles,
            'total_collected_today' => (string) $totalCollectedToday,
        ];

        // Recent payments
        $recentPayments = StudentPayment::with(['student', 'recordedBy'])
            ->whereIn('student_id', $filteredIds)
            ->latest('payment_date')
            ->latest('created_at')
            ->take(10)
            ->get()
            ->map(function ($payment) {
                return [
                    'id'          => $payment->id,
                    'payment_date'=> $payment->payment_date->format('Y-m-d'),
                    'or_number'   => $payment->or_number,
                    'amount'      => (string) $payment->amount,
                    'student'     => $payment->student ? [
                        'first_name' => $payment->student->first_name,
                        'last_name'  => $payment->student->last_name,
                        'lrn'        => $payment->student->lrn,
                    ] : ['first_name' => 'Unknown', 'last_name' => '', 'lrn' => 'N/A'],
                    'recorded_by' => $payment->recordedBy ? ['name' => $payment->recordedBy->name] : null,
                ];
            })
            ->toArray();

        // Top pending balances
        $pendingPayments = StudentFee::with(['student'])
            ->whereIn('student_id', $filteredIds)
            ->where('balance', '>', 0)
            ->orderBy('balance', 'desc')
            ->take(10)
            ->get()
            ->map(function ($fee) {
                return [
                    'id'           => $fee->id,
                    'balance'      => (string) $fee->balance,
                    'total_amount' => (string) $fee->total_amount,
                    'student'      => $fee->student ? [
                        'first_name' => $fee->student->first_name,
                        'last_name'  => $fee->student->last_name,
                        'lrn'        => $fee->student->lrn,
                        'program'    => $fee->student->program ?? 'N/A',
                        'year_level' => $fee->student->year_level ?? 'N/A',
                    ] : ['first_name' => 'Unknown', 'last_name' => '', 'lrn' => 'N/A', 'program' => 'N/A', 'year_level' => 'N/A'],
                ];
            })
            ->toArray();

        // Daily income for the selected month
        $monthStart  = Carbon::create($selectedYear, $selectedMonth, 1)->startOfMonth();
        $monthEnd    = Carbon::create($selectedYear, $selectedMonth, 1)->endOfMonth();
        $daysInMonth = $monthEnd->day;

        $dailyIncome = [];
        for ($day = 1; $day <= $daysInMonth; $day++) {
            $date        = Carbon::create($selectedYear, $selectedMonth, $day);
            $dayPayments = StudentPayment::whereIn('student_id', $filteredIds)->whereDate('payment_date', $date)->get();
            $total       = $dayPayments->sum('amount');

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
                'day'       => $day,
                'date'      => $date->format('Y-m-d'),
                'day_label' => $date->format('D, M j'),
                'total'     => (float) $total,
                'count'     => $dayPayments->count(),
                'avg_time'  => $timeFormatted,
            ];
        }

        // Months dropdown
        $months = [];
        for ($m = 1; $m <= 12; $m++) {
            $months[] = ['value' => $m, 'label' => Carbon::create(null, $m)->format('F')];
        }

        $years = StudentPayment::selectRaw('YEAR(payment_date) as year')
            ->distinct()->orderBy('year', 'desc')->pluck('year')->toArray();
        if (empty($years)) $years = [(int) date('Y')];

        // Filter options
        $departments = Department::orderBy('name')->get()->map(fn($d) => ['value' => (string) $d->id, 'label' => $d->name]);
        $programs    = Student::whereNotNull('program')->where('program', '!=', '')->distinct()->orderBy('program')->pluck('program')->map(fn($v) => ['value' => $v, 'label' => $v]);
        $yearLevels  = Student::whereNotNull('year_level')->where('year_level', '!=', '')->distinct()->orderBy('year_level')->pluck('year_level')->map(fn($v) => ['value' => $v, 'label' => $v]);
        $sections    = Student::whereNotNull('section')->where('section', '!=', '')->distinct()->orderBy('section')->pluck('section')->map(fn($v) => ['value' => $v, 'label' => $v]);

        return Inertia::render('super-accounting/dashboard', [
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
}
