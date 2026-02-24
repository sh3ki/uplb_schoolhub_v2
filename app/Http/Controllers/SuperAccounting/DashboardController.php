<?php

namespace App\Http\Controllers\SuperAccounting;

use App\Http\Controllers\Controller;
use App\Models\RefundRequest;
use App\Models\Student;
use App\Models\StudentFee;
use App\Models\StudentPayment;
use App\Models\AppSetting;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function index(): Response
    {
        $settings = AppSetting::current();
        $currentSchoolYear = $settings?->school_year ?? date('Y') . '-' . (date('Y') + 1);

        // Refund Statistics
        $refundStats = [
            'pending' => RefundRequest::pending()->count(),
            'approved' => RefundRequest::where('status', 'approved')->count(),
            'rejected' => RefundRequest::where('status', 'rejected')->count(),
            'total_pending_amount' => (float) RefundRequest::pending()->sum('amount'),
            'total_approved_amount' => (float) RefundRequest::where('status', 'approved')->sum('amount'),
            'total_rejected_amount' => (float) RefundRequest::where('status', 'rejected')->sum('amount'),
        ];

        // This month's refunds
        $thisMonth = Carbon::now()->startOfMonth();
        $monthlyRefunds = RefundRequest::where('status', 'approved')
            ->where('processed_at', '>=', $thisMonth)
            ->sum('amount');

        // Dropped students count
        $droppedStudentsCount = Student::where('enrollment_status', 'dropped')->count();

        // Recent refund requests
        $recentRefunds = RefundRequest::with([
            'student:id,first_name,last_name,lrn,program,year_level',
            'processedBy:id,name',
        ])
            ->latest()
            ->take(10)
            ->get()
            ->map(function ($r) {
                return [
                    'id' => $r->id,
                    'type' => $r->type,
                    'amount' => (float) $r->amount,
                    'status' => $r->status,
                    'student' => [
                        'full_name' => $r->student->full_name,
                        'lrn' => $r->student->lrn,
                    ],
                    'created_at' => $r->created_at->format('M d, Y'),
                ];
            });

        // Refund trend (last 7 days)
        $refundTrend = [];
        for ($i = 6; $i >= 0; $i--) {
            $date = Carbon::today()->subDays($i);
            $approved = RefundRequest::where('status', 'approved')
                ->whereDate('processed_at', $date)
                ->sum('amount');
            $refundTrend[] = [
                'date' => $date->format('M d'),
                'amount' => (float) $approved,
            ];
        }

        // Top reasons for refunds (from dropped students)
        $topReasons = RefundRequest::select('reason', DB::raw('COUNT(*) as count'))
            ->groupBy('reason')
            ->orderByDesc('count')
            ->take(5)
            ->get();

        return Inertia::render('super-accounting/dashboard', [
            'refundStats' => $refundStats,
            'monthlyRefunds' => (float) $monthlyRefunds,
            'droppedStudentsCount' => $droppedStudentsCount,
            'recentRefunds' => $recentRefunds,
            'refundTrend' => $refundTrend,
            'topReasons' => $topReasons,
            'schoolYear' => $currentSchoolYear,
        ]);
    }
}
