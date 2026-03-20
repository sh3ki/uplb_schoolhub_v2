<?php

namespace App\Http\Controllers\Owner;

use App\Http\Controllers\Controller;
use App\Models\DocumentRequest;
use App\Models\DropRequest;
use App\Models\StudentPayment;
use App\Models\StudentFee;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class AuditLogController extends Controller
{
    /**
     * Display all cashier payment transaction logs.
     */
    public function index(Request $request): Response
    {
        $query = StudentPayment::with([
            'student:id,first_name,last_name,lrn,program,year_level',
            'recordedBy:id,name,role',
            'studentFee:id,school_year',
        ])->orderByDesc('created_at')->orderByDesc('payment_date');

        // Search by student name, LRN, OR number, or cashier name
        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->whereHas('student', function ($sq) use ($search) {
                    $sq->where('first_name', 'like', "%{$search}%")
                       ->orWhere('last_name', 'like', "%{$search}%")
                       ->orWhere('lrn', 'like', "%{$search}%");
                })
                ->orWhereHas('recordedBy', function ($sq) use ($search) {
                    $sq->where('name', 'like', "%{$search}%");
                })
                ->orWhere('or_number', 'like', "%{$search}%");
            });
        }

        // Filter by school year (via studentFee)
        if ($schoolYear = $request->input('school_year')) {
            $query->whereHas('studentFee', function ($q) use ($schoolYear) {
                $q->where('school_year', $schoolYear);
            });
        }

        // Filter by date range
        if ($dateFrom = $request->input('date_from')) {
            $query->whereDate('payment_date', '>=', $dateFrom);
        }
        if ($dateTo = $request->input('date_to')) {
            $query->whereDate('payment_date', '<=', $dateTo);
        }

        $payments = $query->paginate(25)->withQueryString();

        // Transform for frontend
        $payments->through(function ($payment) {
            return [
                'id' => $payment->id,
                'student' => $payment->student ? [
                    'id'         => $payment->student->id,
                    'full_name'  => $payment->student->first_name . ' ' . $payment->student->last_name,
                    'lrn'        => $payment->student->lrn,
                    'program'    => $payment->student->program,
                    'year_level' => $payment->student->year_level,
                ] : null,
                'cashier' => $payment->recordedBy ? [
                    'name' => $payment->recordedBy->name,
                    'role' => $payment->recordedBy->role,
                ] : null,
                'amount'           => (float) $payment->amount,
                'or_number'        => $payment->or_number,
                'payment_method'   => $payment->payment_method,
                'payment_mode'     => $payment->payment_mode,
                'payment_for'      => $payment->payment_for,
                'reference_number' => $payment->reference_number,
                'notes'            => $payment->notes,
                'school_year'      => $payment->studentFee?->school_year,
                'payment_date'     => $payment->payment_date?->format('M d, Y'),
                'created_at'       => $payment->created_at->format('M d, Y h:i A'),
            ];
        });

        // Get available school years for filter
        $schoolYears = StudentFee::distinct()
            ->whereNotNull('school_year')
            ->orderBy('school_year', 'desc')
            ->pluck('school_year');

        // Summary stats
        $totalPayments  = StudentPayment::count();

        $paymentTotalQuery = StudentPayment::query();
        $documentTotalQuery = DocumentRequest::query()
            ->where('is_paid', true)
            ->where('accounting_status', 'approved');
        $dropTotalQuery = DropRequest::query()
            ->where('is_paid', true)
            ->where('accounting_status', 'approved');

        if ($schoolYear = $request->input('school_year')) {
            $paymentTotalQuery->whereHas('studentFee', function ($q) use ($schoolYear) {
                $q->where('school_year', $schoolYear);
            });
            $documentTotalQuery->whereHas('student', function ($q) use ($schoolYear) {
                $q->where('school_year', $schoolYear);
            });
            $dropTotalQuery->whereHas('student', function ($q) use ($schoolYear) {
                $q->where('school_year', $schoolYear);
            });
        }

        if ($dateFrom = $request->input('date_from')) {
            $paymentTotalQuery->whereDate('payment_date', '>=', $dateFrom);
            $documentTotalQuery->whereDate('accounting_approved_at', '>=', $dateFrom);
            $dropTotalQuery->whereDate('accounting_approved_at', '>=', $dateFrom);
        }
        if ($dateTo = $request->input('date_to')) {
            $paymentTotalQuery->whereDate('payment_date', '<=', $dateTo);
            $documentTotalQuery->whereDate('accounting_approved_at', '<=', $dateTo);
            $dropTotalQuery->whereDate('accounting_approved_at', '<=', $dateTo);
        }

        $totalCollected = (float) $paymentTotalQuery->sum('amount')
            + (float) $documentTotalQuery->sum('fee')
            + (float) $dropTotalQuery->sum('fee_amount');
        $cashiersCount  = StudentPayment::distinct('recorded_by')->count('recorded_by');
        $todayCount     = StudentPayment::whereDate('payment_date', today())->count();

        return Inertia::render('owner/audit-logs', [
            'payments'    => $payments,
            'filters'     => $request->only(['search', 'school_year', 'date_from', 'date_to']),
            'schoolYears' => $schoolYears,
            'stats'       => [
                'total_payments'  => $totalPayments,
                'total_collected' => (float) $totalCollected,
                'cashiers_count'  => $cashiersCount,
                'today_count'     => $todayCount,
            ],
        ]);
    }
}