<?php

namespace App\Http\Controllers\Owner;

use App\Http\Controllers\Controller;
use App\Models\Department;
use App\Models\DocumentRequest;
use App\Models\DropRequest;
use App\Models\OnlineTransaction;
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

        // Today's Income (fees + approved document fees + approved drop fees)
        $todayIncome = (float) StudentPayment::whereDate('payment_date', Carbon::today())->sum('amount')
            + (float) OnlineTransaction::query()
                ->whereNotNull('transfer_request_id')
                ->whereIn('status', ['completed', 'verified'])
                ->whereDate('verified_at', Carbon::today())
                ->sum('amount')
            + (float) DocumentRequest::where('is_paid', true)
                ->where('accounting_status', 'approved')
                ->whereDate('accounting_approved_at', Carbon::today())
                ->sum('fee')
            + (float) DropRequest::where('is_paid', true)
                ->where('accounting_status', 'approved')
                ->whereDate('accounting_approved_at', Carbon::today())
                ->sum('fee_amount');

        // Today's Target (avg daily from last 30 days)
        $thirtyDaysAgo = Carbon::today()->subDays(30);
        $last30Sum = (float) StudentPayment::whereBetween('payment_date', [$thirtyDaysAgo, Carbon::today()])->sum('amount')
            + (float) OnlineTransaction::query()
                ->whereNotNull('transfer_request_id')
                ->whereIn('status', ['completed', 'verified'])
                ->whereBetween('verified_at', [$thirtyDaysAgo->copy()->startOfDay(), Carbon::today()->endOfDay()])
                ->sum('amount')
            + (float) DocumentRequest::where('is_paid', true)
                ->where('accounting_status', 'approved')
                ->whereBetween('accounting_approved_at', [$thirtyDaysAgo->copy()->startOfDay(), Carbon::today()->endOfDay()])
                ->sum('fee')
            + (float) DropRequest::where('is_paid', true)
                ->where('accounting_status', 'approved')
                ->whereBetween('accounting_approved_at', [$thirtyDaysAgo->copy()->startOfDay(), Carbon::today()->endOfDay()])
                ->sum('fee_amount');
        $todayTarget = $last30Sum > 0 ? round($last30Sum / 30, 2) : 1;

        // Overall Income for selected school year (with optional date range)
        $overallQuery = StudentPayment::whereHas('studentFee', function ($q) use ($selectedSchoolYear) {
            $q->where('school_year', $selectedSchoolYear);
        });
        if ($dateFrom) $overallQuery->whereDate('payment_date', '>=', $dateFrom);
        if ($dateTo)   $overallQuery->whereDate('payment_date', '<=', $dateTo);

        $overallDocsQuery = DocumentRequest::where('is_paid', true)
            ->where('accounting_status', 'approved')
            ->whereHas('student', fn($q) => $q->where('school_year', $selectedSchoolYear));
        if ($dateFrom) $overallDocsQuery->whereDate('accounting_approved_at', '>=', $dateFrom);
        if ($dateTo)   $overallDocsQuery->whereDate('accounting_approved_at', '<=', $dateTo);

        $overallDropsQuery = DropRequest::where('is_paid', true)
            ->where('accounting_status', 'approved')
            ->whereHas('student', fn($q) => $q->where('school_year', $selectedSchoolYear));
        if ($dateFrom) $overallDropsQuery->whereDate('accounting_approved_at', '>=', $dateFrom);
        if ($dateTo)   $overallDropsQuery->whereDate('accounting_approved_at', '<=', $dateTo);

        $overallTransferQuery = OnlineTransaction::query()
            ->whereNotNull('transfer_request_id')
            ->whereIn('status', ['completed', 'verified'])
            ->whereHas('transferRequest', fn($q) => $q->whereRaw('TRIM(school_year) = ?', [trim((string) $selectedSchoolYear)]));
        if ($dateFrom) $overallTransferQuery->whereDate('verified_at', '>=', $dateFrom);
        if ($dateTo)   $overallTransferQuery->whereDate('verified_at', '<=', $dateTo);

        $overallIncome = (float) $overallQuery->sum('amount')
            + (float) $overallTransferQuery->sum('amount')
            + (float) $overallDocsQuery->sum('fee')
            + (float) $overallDropsQuery->sum('fee_amount');

        // Overall Target
        $overallTarget = (float) StudentFee::where('school_year', $selectedSchoolYear)->sum('total_amount');

        // Expected Income (remaining balance)
        $expectedIncome = (float) StudentFee::where('school_year', $selectedSchoolYear)
            ->with('payments:id,student_fee_id,amount')
            ->get()
            ->sum(function ($fee) {
                $paid = (float) $fee->payments->sum('amount');
                return max(0, (float) $fee->total_amount - (float) $fee->grant_discount - $paid);
            });
        $expectedTarget = $expectedIncome;

        // Department Analysis
        $departmentStats = Department::query()
            ->with(['students' => function ($query) use ($selectedSchoolYear) {
                $query->with(['fees' => function ($feeQuery) use ($selectedSchoolYear) {
                    $feeQuery->where('school_year', $selectedSchoolYear);
                }]);
            }])
            ->get();

        $transferRevenueByDepartment = OnlineTransaction::query()
            ->with('student:id,department_id')
            ->whereNotNull('transfer_request_id')
            ->whereIn('status', ['completed', 'verified'])
            ->whereHas('transferRequest', fn($q) => $q->whereRaw('TRIM(school_year) = ?', [trim((string) $selectedSchoolYear)]))
            ->get()
            ->groupBy(fn($tx) => $tx->student?->department_id)
            ->map(fn($rows) => (float) $rows->sum('amount'));

        $departmentStats = $departmentStats
            ->map(function ($department) use ($transferRevenueByDepartment) {
                $totalRevenue  = $department->students->sum(fn($s) => $s->fees->sum(fn($fee) => (float) $fee->payments->sum('amount')));
                $totalRevenue += (float) $transferRevenueByDepartment->get($department->id, 0.0);
                $totalExpected = $department->students->sum(fn($s) => $s->fees->sum('total_amount'));
                $enrollments = $department->students->filter(fn($s) => $s->fees->isNotEmpty())->count();

                return [
                    'id'              => $department->id,
                    'name'            => $department->name,
                    'code'            => $department->code,
                    'enrollments'     => $enrollments,
                    'revenue'         => $totalRevenue,
                    'expected'        => $totalExpected,
                    'collection_rate' => $totalExpected > 0
                        ? round(($totalRevenue / $totalExpected) * 100, 1) : 0,
                ];
            });

        // Revenue Trend (last 7 days)
        $revenueTrend = [];
        for ($i = 6; $i >= 0; $i--) {
            $date = Carbon::today()->subDays($i)->toDateString();
            $start = Carbon::parse($date)->startOfDay();
            $end = Carbon::parse($date)->endOfDay();
            $dayTotal = (float) StudentPayment::whereDate('payment_date', $date)->sum('amount')
                + (float) OnlineTransaction::query()
                    ->whereNotNull('transfer_request_id')
                    ->whereIn('status', ['completed', 'verified'])
                    ->whereBetween('verified_at', [$start, $end])
                    ->sum('amount')
                + (float) DocumentRequest::where('is_paid', true)
                    ->where('accounting_status', 'approved')
                    ->whereBetween('accounting_approved_at', [$start, $end])
                    ->sum('fee')
                + (float) DropRequest::where('is_paid', true)
                    ->where('accounting_status', 'approved')
                    ->whereBetween('accounting_approved_at', [$start, $end])
                    ->sum('fee_amount');
            $revenueTrend[] = [
                'date'   => $date,
                'label'  => Carbon::parse($date)->format('M d'),
                'amount' => $dayTotal,
            ];
        }

        // Total Students Enrolled in selected school year
        $totalStudents = Student::whereHas('fees', fn($q) => $q->where('school_year', $selectedSchoolYear))->count();

        // Payment count
        $totalPayments = StudentPayment::whereHas('studentFee', fn($q) => $q->where('school_year', $selectedSchoolYear))->count()
            + OnlineTransaction::query()
                ->whereNotNull('transfer_request_id')
                ->whereIn('status', ['completed', 'verified'])
                ->whereHas('transferRequest', fn($q) => $q->whereRaw('TRIM(school_year) = ?', [trim((string) $selectedSchoolYear)]))
                ->count()
            + DocumentRequest::where('is_paid', true)->where('accounting_status', 'approved')->whereHas('student', fn($q) => $q->where('school_year', $selectedSchoolYear))->count()
            + DropRequest::where('is_paid', true)->where('accounting_status', 'approved')->whereHas('student', fn($q) => $q->where('school_year', $selectedSchoolYear))->count();

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
