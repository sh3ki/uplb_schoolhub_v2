<?php

namespace App\Http\Controllers\Owner;

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

class OwnerDashboardController extends Controller
{
    public function index(Request $request): Response
    {
        // Available school years
        $schoolYears = StudentFee::distinct()->whereNotNull('school_year')
            ->orderByDesc('school_year')->pluck('school_year');

        $defaultSchoolYear = \App\Models\AppSetting::current()->school_year ?? ($schoolYears->first() ?? date('Y') . '-' . (date('Y') + 1));
        $selectedSchoolYear = $request->input('school_year', $defaultSchoolYear);

        // Optional date range filter
        $dateFrom = $request->input('date_from');
        $dateTo   = $request->input('date_to');

        // Today's Income
        $todayIncome = StudentPayment::whereDate('payment_date', Carbon::today())->sum('amount');

        // Today's Target (avg daily from last 30 days)
        $thirtyDaysAgo = Carbon::today()->subDays(30);
        $last30Sum = (float) StudentPayment::whereBetween('payment_date', [$thirtyDaysAgo, Carbon::today()])->sum('amount');
        $todayTarget = $last30Sum > 0 ? round($last30Sum / 30, 2) : 1;

        // Overall Income for selected school year (with optional date range)
        $overallQuery = StudentPayment::whereHas('studentFee', function ($q) use ($selectedSchoolYear) {
            $q->where('school_year', $selectedSchoolYear);
        });
        if ($dateFrom) $overallQuery->whereDate('payment_date', '>=', $dateFrom);
        if ($dateTo)   $overallQuery->whereDate('payment_date', '<=', $dateTo);
        $overallIncome = (float) $overallQuery->sum('amount');

        // Overall Target
        $overallTarget = (float) StudentFee::where('school_year', $selectedSchoolYear)->sum('total_amount');

        // Expected Income (remaining balance)
        $expectedIncome = (float) StudentFee::where('school_year', $selectedSchoolYear)->sum('balance');
        $expectedTarget = $expectedIncome;

        // Department Analysis
        $departmentStats = Department::withCount('students')
            ->with(['students' => function ($query) use ($selectedSchoolYear) {
                $query->with(['fees' => function ($feeQuery) use ($selectedSchoolYear) {
                    $feeQuery->where('school_year', $selectedSchoolYear);
                }]);
            }])
            ->get()
            ->map(function ($department) {
                $totalRevenue  = $department->students->sum(fn($s) => $s->fees->sum('total_paid'));
                $totalExpected = $department->students->sum(fn($s) => $s->fees->sum('total_amount'));

                return [
                    'id'              => $department->id,
                    'name'            => $department->name,
                    'code'            => $department->code,
                    'enrollments'     => $department->students_count,
                    'revenue'         => $totalRevenue,
                    'expected'        => $totalExpected,
                    'collection_rate' => $totalExpected > 0
                        ? round(($totalRevenue / $totalExpected) * 100, 1) : 0,
                ];
            });

        // Revenue Trend (last 7 days)
        $revenueData = StudentPayment::where('payment_date', '>=', Carbon::today()->subDays(6))
            ->whereDate('payment_date', '<=', Carbon::today())
            ->select(DB::raw('DATE(payment_date) as date'), DB::raw('SUM(amount) as total'))
            ->groupBy('date')->orderBy('date')->get();

        $revenueTrend = [];
        for ($i = 6; $i >= 0; $i--) {
            $date = Carbon::today()->subDays($i)->toDateString();
            $found = $revenueData->firstWhere('date', $date);
            $revenueTrend[] = [
                'date'   => $date,
                'label'  => Carbon::parse($date)->format('M d'),
                'amount' => $found ? (float) $found->total : 0,
            ];
        }

        // Total Students Enrolled in selected school year
        $totalStudents = Student::whereHas('fees', fn($q) => $q->where('school_year', $selectedSchoolYear))->count();

        // Payment count
        $totalPayments = StudentPayment::whereHas('studentFee', fn($q) => $q->where('school_year', $selectedSchoolYear))->count();

        return Inertia::render('owner/dashboard', [
            'todayIncome'       => $todayIncome,
            'todayTarget'       => $todayTarget,
            'todayAchievement'  => $todayTarget > 0 ? round(($todayIncome / $todayTarget) * 100, 1) : 0,

            'overallIncome'      => $overallIncome,
            'overallTarget'      => $overallTarget,
            'overallAchievement' => $overallTarget > 0 ? round(($overallIncome / $overallTarget) * 100, 1) : 0,

            'expectedIncome'      => $expectedIncome,
            'expectedTarget'      => $expectedTarget,
            'expectedAchievement' => 100,

            'departmentStats' => $departmentStats,
            'revenueTrend'    => $revenueTrend,
            'totalStudents'   => $totalStudents,
            'totalPayments'   => $totalPayments,
            'schoolYear'      => $selectedSchoolYear,
            'schoolYears'     => $schoolYears,
            'filters'         => $request->only(['school_year', 'date_from', 'date_to']),
        ]);
    }
}
