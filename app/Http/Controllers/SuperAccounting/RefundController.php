<?php

namespace App\Http\Controllers\SuperAccounting;

use App\Http\Controllers\Controller;
use App\Models\RefundRequest;
use App\Models\StudentFee;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

class RefundController extends Controller
{
    /**
     * List all refund/void requests for super accounting.
     */
    public function index(Request $request): Response
    {
        $query = RefundRequest::with([
            'student:id,first_name,last_name,middle_name,suffix,lrn,student_photo_url,program,year_level,section,enrollment_status',
            'studentFee:id,school_year,total_amount,total_paid,balance',
            'processedBy:id,name',
        ]);

        // Filter by status (tab-based)
        $tab = $request->input('tab', 'pending');
        if ($tab && $tab !== 'all') {
            $query->where('status', $tab);
        }

        // Filter by type
        if ($type = $request->input('type')) {
            $query->where('type', $type);
        }

        // Search
        if ($search = $request->input('search')) {
            $query->whereHas('student', function ($q) use ($search) {
                $q->where('first_name', 'like', "%{$search}%")
                  ->orWhere('last_name', 'like', "%{$search}%")
                  ->orWhere('lrn', 'like', "%{$search}%");
            });
        }

        $refunds = $query->latest()->paginate(20)->withQueryString();

        $refunds->getCollection()->transform(function ($r) {
            return [
                'id' => $r->id,
                'type' => $r->type,
                'amount' => (float) $r->amount,
                'reason' => $r->reason,
                'status' => $r->status,
                'accounting_notes' => $r->accounting_notes,
                'processed_by' => $r->processedBy,
                'processed_at' => $r->processed_at?->format('M d, Y h:i A'),
                'created_at' => $r->created_at->format('M d, Y h:i A'),
                'school_year' => $r->studentFee?->school_year,
                'student' => [
                    'id' => $r->student->id,
                    'full_name' => $r->student->full_name,
                    'lrn' => $r->student->lrn,
                    'program' => $r->student->program,
                    'year_level' => $r->student->year_level,
                    'section' => $r->student->section,
                    'student_photo_url' => $r->student->student_photo_url,
                    'enrollment_status' => $r->student->enrollment_status,
                ],
                'student_fee' => $r->studentFee ? [
                    'school_year' => $r->studentFee->school_year,
                    'total_amount' => (float) $r->studentFee->total_amount,
                    'total_paid' => (float) $r->studentFee->total_paid,
                    'balance' => (float) $r->studentFee->balance,
                ] : null,
            ];
        });

        // Stats
        $stats = [
            'pending' => RefundRequest::where('status', 'pending')->count(),
            'approved' => RefundRequest::where('status', 'approved')->count(),
            'rejected' => RefundRequest::where('status', 'rejected')->count(),
            'total_pending_amount' => (float) RefundRequest::where('status', 'pending')->sum('amount'),
            'total_approved_amount' => (float) RefundRequest::where('status', 'approved')->sum('amount'),
        ];

        return Inertia::render('super-accounting/refunds/index', [
            'refunds' => $refunds,
            'stats' => $stats,
            'tab' => $tab,
            'filters' => $request->only(['search', 'type']),
        ]);
    }

    /**
     * Approve a refund/void request.
     */
    public function approve(Request $request, RefundRequest $refund): RedirectResponse
    {
        abort_if($refund->status !== 'pending', 422, 'Only pending requests can be approved.');

        $validated = $request->validate([
            'accounting_notes' => 'nullable|string|max:1000',
        ]);

        $refund->update([
            'status' => 'approved',
            'processed_by' => Auth::id(),
            'processed_at' => now(),
            'accounting_notes' => $validated['accounting_notes'] ?? null,
        ]);

        // Adjust the student fee record if one is attached
        if ($refund->student_fee_id) {
            $fee = StudentFee::find($refund->student_fee_id);
            if ($fee) {
                $fee->total_paid = max(0, (float) $fee->total_paid - (float) $refund->amount);
                $fee->balance = (float) $fee->total_amount - (float) $fee->total_paid;
                $fee->save();
            }
        }

        return back()->with('success', 'Refund/void request approved and fees adjusted.');
    }

    /**
     * Reject a refund/void request.
     */
    public function reject(Request $request, RefundRequest $refund): RedirectResponse
    {
        abort_if($refund->status !== 'pending', 422, 'Only pending requests can be rejected.');

        $validated = $request->validate([
            'accounting_notes' => 'required|string|max:1000',
        ]);

        $refund->update([
            'status' => 'rejected',
            'processed_by' => Auth::id(),
            'processed_at' => now(),
            'accounting_notes' => $validated['accounting_notes'],
        ]);

        return back()->with('success', 'Refund/void request rejected.');
    }
}
