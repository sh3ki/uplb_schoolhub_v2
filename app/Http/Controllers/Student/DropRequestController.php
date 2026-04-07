<?php

namespace App\Http\Controllers\Student;

use App\Http\Controllers\Controller;
use App\Models\AppSetting;
use App\Models\DropRequest;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

class DropRequestController extends Controller
{
    /**
     * Display the student's drop requests.
     */
    public function index(): Response
    {
        $user = Auth::user();
        $student = $user->student;
        $settings = AppSetting::current();

        $requests = DropRequest::where('student_id', $student->id)
            ->with(['processedBy:id,name', 'feeItems'])
            ->orderByDesc('created_at')
            ->get()
            ->map(function ($r) {
                return [
                    'id'               => $r->id,
                    'reason'           => $r->reason,
                    'status'           => $r->status,
                    'registrar_status' => $r->registrar_status,
                    'accounting_status'=> $r->accounting_status,
                    'semester'         => $r->semester,
                    'school_year'      => $r->school_year,
                    'registrar_remarks'=> $r->registrar_remarks ?: $r->registrar_notes,
                    'accounting_remarks'=> $r->accounting_remarks,
                    'fee_amount'       => (float) $r->fee_amount,
                    'is_paid'          => $r->is_paid,
                    'or_number'        => $r->or_number,
                    'processed_by'     => $r->processedBy?->name,
                    'processed_at'     => $r->processed_at?->format('M d, Y h:i A'),
                    'created_at'       => $r->created_at->format('M d, Y h:i A'),
                    'fee_items'        => $r->feeItems->map(fn ($fi) => [
                        'id'     => $fi->id,
                        'name'   => $fi->name,
                        'amount' => (float) $fi->pivot->amount,
                    ]),
                ];
            });

        $hasPendingRequest = DropRequest::where('student_id', $student->id)
            ->where('status', 'pending')
            ->exists();

        $hasApprovedRequest = DropRequest::where('student_id', $student->id)
            ->where('status', 'approved')
            ->exists();

        $deadline = $settings?->drop_request_deadline;
        $deadlinePassed = $deadline && now()->startOfDay()->gt($deadline);

        return Inertia::render('student/drop-request/index', [
            'requests' => $requests,
            'hasPendingRequest' => $hasPendingRequest,
            'hasApprovedRequest' => $hasApprovedRequest,
            'isDropped' => $student->enrollment_status === 'dropped',
            'currentSchoolYear' => $settings?->school_year ?? date('Y') . '-' . (date('Y') + 1),
            'dropRequestDeadline' => $deadline?->format('M d, Y'),
            'deadlinePassed' => $deadlinePassed,
            'classification' => $student->resolveDepartmentClassification() ?? 'K-12',
        ]);
    }

    /**
     * Submit a new drop request.
     */
    public function store(Request $request): RedirectResponse
    {
        $user = Auth::user();
        $student = $user->student;

        // Check if already dropped
        if ($student->enrollment_status === 'dropped') {
            return back()->with('error', 'You are already dropped from enrollment.');
        }

        // Check drop request deadline
        $settings = AppSetting::current();
        $deadline = $settings?->drop_request_deadline;
        if ($deadline && now()->startOfDay()->gt($deadline)) {
            return back()->with('error', 'The drop request submission deadline has passed.');
        }

        // Check for existing pending request
        $existingPending = DropRequest::where('student_id', $student->id)
            ->where('status', 'pending')
            ->exists();

        if ($existingPending) {
            return back()->with('error', 'You already have a pending drop request.');
        }

        $validated = $request->validate([
            'reason' => 'required|string|min:20|max:2000',
            'semester' => 'nullable|string|max:50',
            'school_year' => 'nullable|string|max:20',
        ]);

        DropRequest::create([
            'student_id' => $student->id,
            'reason' => $validated['reason'],
            'semester' => $validated['semester'] ?? null,
            'school_year' => $validated['school_year'] ?? null,
            'status' => 'pending',
        ]);

        return back()->with('success', 'Your drop request has been submitted. Please wait for registrar approval.');
    }

    /**
     * Cancel a pending drop request.
     */
    public function cancel(DropRequest $dropRequest): RedirectResponse
    {
        $user = Auth::user();
        $student = $user->student;

        // Ensure the request belongs to this student
        if ($dropRequest->student_id !== $student->id) {
            abort(403);
        }

        // Only pending requests can be cancelled
        if ($dropRequest->status !== 'pending') {
            return back()->with('error', 'Only pending requests can be cancelled.');
        }

        $dropRequest->delete();

        return back()->with('success', 'Drop request cancelled successfully.');
    }
}
