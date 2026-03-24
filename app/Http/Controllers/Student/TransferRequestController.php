<?php

namespace App\Http\Controllers\Student;

use App\Http\Controllers\Controller;
use App\Models\AppSetting;
use App\Models\TransferRequest;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Carbon;
use Inertia\Inertia;
use Inertia\Response;

class TransferRequestController extends Controller
{
    public function index(): Response
    {
        $user = Auth::user();
        $student = $user->student;
        $settings = AppSetting::current();

        $requests = TransferRequest::where('student_id', $student->id)
            ->with(['processedBy:id,name'])
            ->orderByDesc('created_at')
            ->get()
            ->map(function ($r) {
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
                    'balance_override' => $r->balance_override,
                    'balance_override_reason' => $r->balance_override_reason,
                    'processed_by' => $r->processedBy?->name,
                    'processed_at' => $r->processed_at?->format('M d, Y h:i A'),
                    'created_at' => $r->created_at->format('M d, Y h:i A'),
                ];
            });

        $hasPendingRequest = TransferRequest::where('student_id', $student->id)
            ->where('status', 'pending')
            ->exists();

        $hasApprovedRequest = TransferRequest::where('student_id', $student->id)
            ->where('status', 'approved')
            ->exists();

        $deadline = $settings?->transfer_request_deadline ? Carbon::parse($settings->transfer_request_deadline) : null;
        $deadlinePassed = $deadline && now()->startOfDay()->gt($deadline);

        return Inertia::render('student/transfer-request/index', [
            'requests' => $requests,
            'hasPendingRequest' => $hasPendingRequest,
            'hasApprovedRequest' => $hasApprovedRequest,
            'isTransferredOut' => $student->enrollment_status === 'dropped' && !$student->is_active,
            'currentSchoolYear' => $settings?->school_year ?? date('Y') . '-' . (date('Y') + 1),
            'transferRequestDeadline' => $deadline?->format('M d, Y'),
            'deadlinePassed' => $deadlinePassed,
            'classification' => $student->resolveDepartmentClassification() ?? 'K-12',
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $user = Auth::user();
        $student = $user->student;

        if (!$student->is_active) {
            return back()->with('error', 'Your account is currently inactive.');
        }

        $settings = AppSetting::current();
        $deadline = $settings?->transfer_request_deadline ? Carbon::parse($settings->transfer_request_deadline) : null;
        if ($deadline && now()->startOfDay()->gt($deadline)) {
            return back()->with('error', 'The transfer request submission deadline has passed.');
        }

        $existingPending = TransferRequest::where('student_id', $student->id)
            ->where('status', 'pending')
            ->exists();

        if ($existingPending) {
            return back()->with('error', 'You already have a pending transfer request.');
        }

        $validated = $request->validate([
            'reason' => 'required|string|min:20|max:2000',
            'semester' => 'nullable|string|max:50',
            'school_year' => 'nullable|string|max:20',
        ]);

        TransferRequest::create([
            'student_id' => $student->id,
            'reason' => $validated['reason'],
            'semester' => $validated['semester'] ?? null,
            'school_year' => $validated['school_year'] ?? null,
            'status' => 'pending',
        ]);

        return back()->with('success', 'Your transfer request has been submitted. Please wait for approval.');
    }

    public function cancel(TransferRequest $transferRequest): RedirectResponse
    {
        $user = Auth::user();
        $student = $user->student;

        if ($transferRequest->student_id !== $student->id) {
            abort(403);
        }

        if ($transferRequest->status !== 'pending') {
            return back()->with('error', 'Only pending requests can be cancelled.');
        }

        $transferRequest->delete();

        return back()->with('success', 'Transfer request cancelled successfully.');
    }
}
