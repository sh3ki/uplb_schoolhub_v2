<?php

namespace App\Http\Controllers\Registrar;

use App\Http\Controllers\Controller;
use App\Models\AppSetting;
use App\Models\Student;
use App\Models\TransferRequest;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Carbon;
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
        ]);

        if ($tab && $tab !== 'all') {
            $query->where('registrar_status', $tab);
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
            'pending' => TransferRequest::where('registrar_status', 'pending')->count(),
            'approved' => TransferRequest::where('registrar_status', 'approved')->count(),
            'rejected' => TransferRequest::where('registrar_status', 'rejected')->count(),
        ];

        $settings = AppSetting::current();

        $deadline = $settings->transfer_request_deadline ? Carbon::parse($settings->transfer_request_deadline) : null;

        return Inertia::render('registrar/transfer-requests/index', [
            'requests' => $requests,
            'stats' => $stats,
            'tab' => $tab,
            'filters' => $request->only(['search']),
            'transferRequestDeadline' => $deadline?->format('Y-m-d'),
        ]);
    }

    public function setDeadline(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'transfer_request_deadline' => 'nullable|date',
        ]);

        AppSetting::current()->update([
            'transfer_request_deadline' => $validated['transfer_request_deadline'] ?? null,
        ]);

        return back()->with('success', $validated['transfer_request_deadline']
            ? 'Transfer request deadline set to ' . date('M d, Y', strtotime($validated['transfer_request_deadline'])) . '.'
            : 'Transfer request deadline cleared.');
    }

    public function approve(Request $request, TransferRequest $transferRequest): RedirectResponse
    {
        if ($transferRequest->registrar_status !== 'pending') {
            return back()->with('error', 'Only pending requests can be approved.');
        }

        $validated = $request->validate([
            'registrar_remarks' => 'nullable|string|max:1000',
        ]);

        $transferRequest->approveByRegistrar(Auth::id(), $validated['registrar_remarks'] ?? null);

        return back()->with('success', 'Transfer request approved and forwarded to accounting.');
    }

    public function reject(Request $request, TransferRequest $transferRequest): RedirectResponse
    {
        if ($transferRequest->registrar_status !== 'pending') {
            return back()->with('error', 'Only pending requests can be rejected.');
        }

        $validated = $request->validate([
            'registrar_remarks' => 'required|string|max:1000',
        ]);

        $transferRequest->rejectByRegistrar(Auth::id(), $validated['registrar_remarks']);

        return back()->with('success', 'Transfer request rejected.');
    }

    public function finalize(TransferRequest $transferRequest): RedirectResponse
    {
        if ($transferRequest->accounting_status !== 'approved') {
            return back()->with('error', 'Transfer request must be approved by accounting first.');
        }

        if ($transferRequest->student && !$transferRequest->student->is_active) {
            return back()->with('error', 'Student account is already deactivated.');
        }

        $transferRequest->finalizeByRegistrar();

        return back()->with('success', 'Student has been officially transferred out and account access is disabled.');
    }

    public function reactivate(Student $student): RedirectResponse
    {
        if ($student->is_active) {
            return back()->with('error', 'Student account is already active.');
        }

        $student->update([
            'enrollment_status' => 'not-enrolled',
            'is_active' => true,
        ]);

        return back()->with('success', 'Student has been reactivated and can log in again.');
    }
}
