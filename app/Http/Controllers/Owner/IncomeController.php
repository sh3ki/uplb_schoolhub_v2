<?php

namespace App\Http\Controllers\Owner;

use App\Http\Controllers\Controller;
use App\Models\StudentFee;
use App\Models\StudentPayment;
use App\Models\DocumentRequest;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class IncomeController extends Controller
{
    /**
     * Get available school years from fee records.
     */
    private function schoolYears(): array
    {
        return StudentFee::distinct()->whereNotNull('school_year')
            ->orderByDesc('school_year')->pluck('school_year')->toArray();
    }

    /**
     * Today's Income — payments received today.
     */
    public function today(Request $request): Response
    {
        $today     = Carbon::today();
        $yesterday = Carbon::yesterday();

        // Optional date override
        $dateFrom = $request->input('date_from', $today->toDateString());
        $dateTo   = $request->input('date_to', $today->toDateString());

        $todayPayments = StudentPayment::whereBetween('payment_date', [$dateFrom, $dateTo])->get();
        $todayDocs     = DocumentRequest::where('is_paid', true)
            ->whereBetween(\Illuminate\Support\Facades\DB::raw('DATE(updated_at)'), [$dateFrom, $dateTo])->get();

        $todayFees  = (float) $todayPayments->sum('amount');
        $todayDoc   = (float) $todayDocs->sum('fee');
        $todayTotal = $todayFees + $todayDoc;

        // Yesterday's total for comparison
        $yesterdayTotal = (float) StudentPayment::whereDate('payment_date', $yesterday)->sum('amount')
                        + (float) DocumentRequest::where('is_paid', true)->whereDate('updated_at', $yesterday)->sum('fee');

        // Target = average daily over last 30 days
        $thirtyDaysAgo = Carbon::today()->subDays(30);
        $last30Sum     = (float) StudentPayment::whereBetween('payment_date', [$thirtyDaysAgo, $today])->sum('amount');
        $dailyTarget   = $last30Sum > 0 ? round($last30Sum / 30, 2) : 1;
        $achievement   = $dailyTarget > 0 ? ($todayTotal / $dailyTarget) * 100 : ($todayTotal > 0 ? 100 : 0);

        // Hourly breakdown
        $hourlyData = [];
        for ($h = 6; $h <= 22; $h++) {
            $start  = Carbon::parse($dateFrom)->setHour($h)->startOfHour();
            $end    = Carbon::parse($dateTo)->setHour($h)->endOfHour();
            $amount = (float) StudentPayment::whereBetween('created_at', [$start, $end])->sum('amount');
            $hourlyData[] = [
                'hour'   => $h,
                'label'  => sprintf('%02d:00 %s', $h > 12 ? $h - 12 : ($h === 0 ? 12 : $h), $h >= 12 ? 'PM' : 'AM'),
                'amount' => $amount,
                'count'  => (int) StudentPayment::whereBetween('created_at', [$start, $end])->count(),
            ];
        }

        // Payment method breakdown
        $byMethod = [
            'cash'  => (float) $todayPayments->where('payment_method', 'CASH')->sum('amount'),
            'gcash' => (float) $todayPayments->where('payment_method', 'GCASH')->sum('amount'),
            'bank'  => (float) $todayPayments->where('payment_method', 'BANK')->sum('amount'),
        ];

        // Recent transactions
        $recent = StudentPayment::with('student:id,first_name,last_name,middle_name,suffix')
            ->whereBetween('payment_date', [$dateFrom, $dateTo])
            ->orderByDesc('created_at')->take(10)->get()
            ->map(fn($p) => [
                'id'           => $p->id,
                'student_name' => $p->student?->full_name ?? 'Unknown',
                'amount'       => (float) $p->amount,
                'method'       => $p->payment_method ?? 'CASH',
                'or_number'    => $p->or_number ?? 'N/A',
                'time'         => Carbon::parse($p->created_at)->format('h:i A'),
            ]);

        return Inertia::render('owner/income/today', [
            'income' => [
                'title'       => "Today's Income",
                'amount'      => $todayTotal,
                'target'      => $dailyTarget,
                'achievement' => round($achievement, 2),
                'period'      => Carbon::parse($dateFrom)->format('l, F j, Y'),
                'variant'     => 'today',
            ],
            'fees'       => $todayFees,
            'documents'  => $todayDoc,
            'yesterday'  => $yesterdayTotal,
            'byMethod'   => $byMethod,
            'hourlyData' => $hourlyData,
            'recent'     => $recent,
            'count'      => $todayPayments->count() + $todayDocs->count(),
            'filters'    => $request->only(['date_from', 'date_to']),
        ]);
    }

    /**
     * Overall Income — all-time / selected school year totals.
     */
    public function overall(Request $request): Response
    {
        $schoolYears       = $this->schoolYears();
        $defaultSchoolYear = \App\Models\AppSetting::current()->school_year ?? ($schoolYears[0] ?? date('Y') . '-' . (date('Y') + 1));
        $selectedYear      = $request->input('school_year', $defaultSchoolYear);
        $dateFrom          = $request->input('date_from');
        $dateTo            = $request->input('date_to');

        $paymentQuery = StudentPayment::whereHas('studentFee', fn($q) => $q->where('school_year', $selectedYear));
        if ($dateFrom) $paymentQuery->whereDate('payment_date', '>=', $dateFrom);
        if ($dateTo)   $paymentQuery->whereDate('payment_date', '<=', $dateTo);

        $totalCollected = (float) $paymentQuery->sum('amount');
        $totalDocFees   = (float) DocumentRequest::where('is_paid', true)->sum('fee');
        $grandTotal     = $totalCollected + $totalDocFees;
        $totalBilled    = (float) StudentFee::where('school_year', $selectedYear)->sum('total_amount');
        $totalBalance   = (float) StudentFee::where('school_year', $selectedYear)->where('balance', '>', 0)->sum('balance');
        $achievement    = $totalBilled > 0 ? ($grandTotal / $totalBilled) * 100 : ($grandTotal > 0 ? 100 : 0);

        // Monthly breakdown for selected year (extract year from school_year e.g. "2024-2025")
        $yearInt = (int) substr($selectedYear, 0, 4);
        $monthlyData = [];
        for ($m = 1; $m <= 12; $m++) {
            $start  = Carbon::create($yearInt, $m, 1)->startOfMonth();
            $end    = Carbon::create($yearInt, $m, 1)->endOfMonth();
            $amount = (float) StudentPayment::whereHas('studentFee', fn($q) => $q->where('school_year', $selectedYear))
                ->whereBetween('payment_date', [$start, $end])->sum('amount');
            $monthlyData[] = ['month' => Carbon::create($yearInt, $m, 1)->format('M'), 'amount' => $amount];
        }

        // Top paying students
        $topStudents = StudentPayment::with('student:id,first_name,last_name,middle_name,suffix')
            ->whereHas('studentFee', fn($q) => $q->where('school_year', $selectedYear))
            ->selectRaw('student_id, SUM(amount) as total')
            ->groupBy('student_id')->orderByDesc('total')->take(10)->get()
            ->map(fn($p) => ['student_name' => $p->student?->full_name ?? 'Unknown', 'total' => (float) $p->total]);

        return Inertia::render('owner/income/overall', [
            'income' => [
                'title'       => 'Overall Income',
                'amount'      => $grandTotal,
                'target'      => $totalBilled,
                'achievement' => round($achievement, 2),
                'period'      => $selectedYear,
                'variant'     => 'overall',
            ],
            'totalCollected'  => $totalCollected,
            'totalDocFees'    => $totalDocFees,
            'totalBilled'     => $totalBilled,
            'totalBalance'    => $totalBalance,
            'monthlyData'     => $monthlyData,
            'topStudents'     => $topStudents,
            'fullyPaidCount'  => (int) StudentFee::where('school_year', $selectedYear)->where('balance', '<=', 0)->count(),
            'partialCount'    => (int) StudentFee::where('school_year', $selectedYear)->where('total_paid', '>', 0)->where('balance', '>', 0)->count(),
            'unpaidCount'     => (int) StudentFee::where('school_year', $selectedYear)->where('total_paid', 0)->where('balance', '>', 0)->count(),
            'schoolYears'     => $schoolYears,
            'selectedYear'    => $selectedYear,
            'filters'         => $request->only(['school_year', 'date_from', 'date_to']),
        ]);
    }

    /**
     * Expected Income — projected total based on outstanding balances.
     */
    public function expected(Request $request): Response
    {
        $schoolYears       = $this->schoolYears();
        $defaultSchoolYear = \App\Models\AppSetting::current()->school_year ?? ($schoolYears[0] ?? date('Y') . '-' . (date('Y') + 1));
        $selectedYear      = $request->input('school_year', $defaultSchoolYear);
        $dateFrom          = $request->input('date_from');
        $dateTo            = $request->input('date_to');

        $feeQuery = StudentFee::where('school_year', $selectedYear);
        $totalBilled    = (float) $feeQuery->sum('total_amount');
        $totalBalance   = (float) (clone $feeQuery)->where('balance', '>', 0)->sum('balance');
        $totalDocExpected = (float) DocumentRequest::where('is_paid', false)->sum('fee');

        $collectedQuery = StudentPayment::whereHas('studentFee', fn($q) => $q->where('school_year', $selectedYear));
        if ($dateFrom) $collectedQuery->whereDate('payment_date', '>=', $dateFrom);
        if ($dateTo)   $collectedQuery->whereDate('payment_date', '<=', $dateTo);
        $totalCollected = (float) $collectedQuery->sum('amount');

        $achievement = $totalBilled > 0 ? ($totalCollected / $totalBilled) * 100 : 0;
        $projected   = $totalBilled > 0 ? (($totalCollected + $totalBalance) / $totalBilled) * 100 : 0;

        // Monthly projection based on trend
        $last3Months = [];
        for ($i = 2; $i >= 0; $i--) {
            $date   = Carbon::now()->subMonths($i);
            $amount = (float) StudentPayment::whereHas('studentFee', fn($q) => $q->where('school_year', $selectedYear))
                ->whereYear('payment_date', $date->year)->whereMonth('payment_date', $date->month)->sum('amount');
            $last3Months[] = ['month' => $date->format('M Y'), 'amount' => $amount];
        }

        $avgMonthly   = count($last3Months) > 0 ? array_sum(array_column($last3Months, 'amount')) / count($last3Months) : 0;
        $monthsToFull = $avgMonthly > 0 ? ceil($totalBalance / $avgMonthly) : null;

        // Balance breakdown by department
        $byDepartment = StudentFee::with('student.department')
            ->where('school_year', $selectedYear)->where('balance', '>', 0)->get()
            ->groupBy(fn($f) => $f->student?->department?->name ?? 'Unknown')
            ->map(fn($group, $dept) => [
                'department' => $dept,
                'count'      => $group->count(),
                'balance'    => (float) $group->sum('balance'),
            ])
            ->sortByDesc('balance')->take(8)->values();

        return Inertia::render('owner/income/expected', [
            'income' => [
                'title'       => 'Expected Income',
                'amount'      => $totalBilled,
                'target'      => $totalBilled,
                'achievement' => round($achievement, 2),
                'period'      => 'Projected Collection - ' . $selectedYear,
                'variant'     => 'expected',
                'projected'   => round($projected, 2),
            ],
            'totalBilled'        => $totalBilled,
            'totalCollected'     => $totalCollected,
            'totalBalance'       => $totalBalance,
            'totalDocExpected'   => $totalDocExpected,
            'avgMonthlyIncome'   => round($avgMonthly, 2),
            'monthsToFullPay'    => $monthsToFull,
            'last3Months'        => $last3Months,
            'byDepartment'       => $byDepartment,
            'studentCount'       => (int) (clone $feeQuery)->where('balance', '>', 0)->count(),
            'schoolYears'        => $schoolYears,
            'selectedYear'       => $selectedYear,
            'filters'            => $request->only(['school_year', 'date_from', 'date_to']),
        ]);
    }
}