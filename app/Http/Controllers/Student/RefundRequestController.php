<?php

namespace App\Http\Controllers\Student;

use App\Http\Controllers\Controller;
use App\Models\DropRequest;
use App\Models\RefundRequest;
use App\Models\StudentFee;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class RefundRequestController extends Controller
{
    /**
     * List the student's refund/void requests.
     */
    public function index(): Response
    {
        $user    = auth()->user();
        $student = $user->student;

        if (! $student) {
            return Inertia::render('student/refund-requests/index', [
                'requests'    => [],
                'studentFees' => [],
                'canRequestRefund' => false,
                'dropStatus' => null,
            ]);
        }

        // Check if student has an approved drop request (required to request refund)
        $approvedDropRequest = DropRequest::where('student_id', $student->id)
            ->where('status', 'approved')
            ->exists();

        $pendingDropRequest = DropRequest::where('student_id', $student->id)
            ->where('status', 'pending')
            ->exists();

        $canRequestRefund = $approvedDropRequest && $student->enrollment_status === 'dropped';

        $requests = RefundRequest::where('student_id', $student->id)
            ->with(['studentFee', 'processedBy:id,name'])
            ->latest()
            ->get()
            ->map(fn ($r) => [
                'id'               => $r->id,
                'type'             => $r->type,
                'amount'           => (float) $r->amount,
                'reason'           => $r->reason,
                'status'           => $r->status,
                'accounting_notes' => $r->accounting_notes,
                'processed_by'     => $r->processedBy?->name,
                'processed_at'     => $r->processed_at?->format('M d, Y h:i A'),
                'school_year'      => $r->studentFee?->school_year,
                'created_at'       => $r->created_at->format('M d, Y h:i A'),
            ]);

        // Fees with any payment made (available for refund requests)
        $studentFees = StudentFee::where('student_id', $student->id)
            ->where('total_paid', '>', 0)
            ->get()
            ->map(fn ($f) => [
                'id'          => $f->id,
                'school_year' => $f->school_year,
                'total_paid'  => (float) $f->total_paid,
                'balance'     => max(0, (float) $f->balance),
            ]);

        // Determine drop status for UI
        $dropStatus = null;
        if ($approvedDropRequest) {
            $dropStatus = 'approved';
        } elseif ($pendingDropRequest) {
            $dropStatus = 'pending';
        }

        return Inertia::render('student/refund-requests/index', [
            'requests'    => $requests,
            'studentFees' => $studentFees,
            'canRequestRefund' => $canRequestRefund,
            'dropStatus' => $dropStatus,
        ]);
    }

    /**
     * Submit a new refund / void request.
     */
    public function store(Request $request): RedirectResponse
    {
        $user    = auth()->user();
        $student = $user->student;

        abort_unless($student, 403, 'No student account linked.');

        // Check if student has an approved drop request
        $approvedDropRequest = DropRequest::where('student_id', $student->id)
            ->where('status', 'approved')
            ->exists();

        if (!$approvedDropRequest || $student->enrollment_status !== 'dropped') {
            return back()->with('error', 'You must have an approved drop request before you can request a refund.');
        }

        $validated = $request->validate([
            'student_fee_id' => 'nullable|exists:student_fees,id',
            'type'           => 'required|in:refund,void',
            'amount'         => 'required|numeric|min:0.01',
            'reason'         => 'required|string|max:1000',
        ]);

        // Verify the fee belongs to this student
        if ($validated['student_fee_id']) {
            $fee = StudentFee::where('id', $validated['student_fee_id'])
                ->where('student_id', $student->id)
                ->firstOrFail();

            $maxRefundable = (float) $fee->total_paid;
            if ((float) $validated['amount'] > $maxRefundable) {
                return back()->withErrors(['amount' => "Amount cannot exceed total paid (₱{$maxRefundable})."])->withInput();
            }
        }

        RefundRequest::create([
            'student_id'     => $student->id,
            'student_fee_id' => $validated['student_fee_id'] ?? null,
            'type'           => $validated['type'],
            'amount'         => $validated['amount'],
            'reason'         => $validated['reason'],
            'status'         => 'pending',
        ]);

        return back()->with('success', 'Your refund request has been submitted and is pending Super Accounting review.');
    }
}
