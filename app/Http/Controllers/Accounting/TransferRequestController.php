<?php

namespace App\Http\Controllers\Accounting;

use App\Http\Controllers\Controller;
use App\Models\StudentFee;
use App\Models\TransferRequest;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

class TransferRequestController extends Controller
{
    public function index(Request $request): Response
    {
        $tab = $request->input('tab', 'pending');

        $query = TransferRequest::with([
            'student:id,first_name,last_name,middle_name,suffix,lrn,email,program,year_level,section,student_photo_url,enrollment_status,department_id,is_active',
            'student.department:id,name,classification',
            'registrarApprovedBy:id,name',
            'accountingApprovedBy:id,name',
        ])->where('registrar_status', 'approved');

        if ($tab === 'pending') {
            $query->where('accounting_status', 'pending');
        } elseif ($tab === 'approved') {
            $query->where('accounting_status', 'approved');
        } elseif ($tab === 'rejected') {
            $query->where('accounting_status', 'rejected');
        }

        if ($search = $request->input('search')) {
            $query->whereHas('student', function ($q) use ($search) {
                $q->where('first_name', 'like', "%{$search}%")
                    ->orWhere('last_name', 'like', "%{$search}%")
                    ->orWhere('lrn', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%");
            });
        }

        $requests = $query->latest()->paginate(20)->withQueryString();

        $requests->getCollection()->transform(function ($r) {
            $currentOutstanding = (float) StudentFee::where('student_id', $r->student_id)->sum('balance');

            return [
                'id' => $r->id,
                'reason' => $r->reason,
                'status' => $r->status,
                'registrar_status' => $r->registrar_status,
                'accounting_status' => $r->accounting_status,
                'semester' => $r->semester,
                'school_year' => $r->school_year,
                'registrar_remarks' => $r->registrar_remarks,
                'accounting_remarks' => $r->accounting_remarks,
                'outstanding_balance' => (float) $r->outstanding_balance,
                'current_outstanding_balance' => max(0, $currentOutstanding),
                'balance_override' => (bool) $r->balance_override,
                'balance_override_reason' => $r->balance_override_reason,
                'registrar_approved_by' => $r->registrarApprovedBy ? [
                    'id' => $r->registrarApprovedBy->id,
                    'name' => $r->registrarApprovedBy->name,
                ] : null,
                'accounting_approved_by' => $r->accountingApprovedBy ? [
                    'id' => $r->accountingApprovedBy->id,
                    'name' => $r->accountingApprovedBy->name,
                ] : null,
                'registrar_approved_at' => $r->registrar_approved_at?->format('M d, Y h:i A'),
                'accounting_approved_at' => $r->accounting_approved_at?->format('M d, Y h:i A'),
                'created_at' => $r->created_at->format('M d, Y h:i A'),
                'student' => $r->student ? [
                    'id' => $r->student->id,
                    'full_name' => $r->student->full_name,
                    'lrn' => $r->student->lrn,
                    'email' => $r->student->email,
                    'program' => $r->student->program,
                    'year_level' => $r->student->year_level,
                    'section' => $r->student->section,
                    'student_photo_url' => $r->student->student_photo_url,
                    'enrollment_status' => $r->student->enrollment_status,
                    'is_active' => (bool) $r->student->is_active,
                    'classification' => $r->student->department?->classification,
                ] : null,
            ];
        });

        $stats = [
            'pending' => TransferRequest::where('registrar_status', 'approved')->where('accounting_status', 'pending')->count(),
            'approved' => TransferRequest::where('registrar_status', 'approved')->where('accounting_status', 'approved')->count(),
            'rejected' => TransferRequest::where('registrar_status', 'approved')->where('accounting_status', 'rejected')->count(),
        ];

        return Inertia::render($this->viewPrefix() . '/transfer-requests/index', [
            'requests' => $requests,
            'stats' => $stats,
            'tab' => $tab,
            'filters' => $request->only(['search']),
        ]);
    }

    public function approve(Request $request, TransferRequest $transferRequest): RedirectResponse
    {
        if ($transferRequest->registrar_status !== 'approved') {
            return back()->with('error', 'Transfer request has not been approved by registrar yet.');
        }

        if ($transferRequest->accounting_status !== 'pending') {
            return back()->with('error', 'This transfer request has already been processed.');
        }

        $validated = $request->validate([
            'accounting_remarks' => 'nullable|string|max:1000',
            'override_with_balance' => 'nullable|boolean',
            'override_reason' => 'nullable|string|max:1000',
        ]);

        $outstandingBalance = max(0, (float) StudentFee::where('student_id', $transferRequest->student_id)->sum('balance'));
        $override = (bool) ($validated['override_with_balance'] ?? false);

        if ($outstandingBalance > 0 && !$override) {
            return back()->with('error', 'Student has an outstanding balance. Enable override to proceed.');
        }

        if ($outstandingBalance > 0 && $override && empty($validated['override_reason'])) {
            return back()->with('error', 'Please provide an override reason.');
        }

        $transferRequest->approveByAccounting(
            Auth::id(),
            $validated['accounting_remarks'] ?? null,
            $override,
            $validated['override_reason'] ?? null,
            $outstandingBalance
        );

        return back()->with('success', 'Transfer request approved. Awaiting registrar finalization.');
    }

    public function reject(Request $request, TransferRequest $transferRequest): RedirectResponse
    {
        if ($transferRequest->registrar_status !== 'approved') {
            return back()->with('error', 'Transfer request has not been approved by registrar yet.');
        }

        if ($transferRequest->accounting_status !== 'pending') {
            return back()->with('error', 'This transfer request has already been processed.');
        }

        $validated = $request->validate([
            'accounting_remarks' => 'required|string|max:1000',
        ]);

        $transferRequest->rejectByAccounting(Auth::id(), $validated['accounting_remarks']);

        return back()->with('success', 'Transfer request rejected.');
    }
}
