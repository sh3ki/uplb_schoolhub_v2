<?php

namespace App\Http\Controllers\Accounting;

use App\Http\Controllers\Controller;
use App\Models\AppSetting;
use App\Models\EnrollmentRequest;
use App\Models\Student;
use App\Models\StudentActionLog;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

class EnrollmentClearanceController extends Controller
{
    /**
     * List registrar-approved enrollment requests awaiting accounting review.
     */
    public function index(Request $request): Response
    {
        $query = EnrollmentRequest::with([
            'student:id,first_name,last_name,middle_name,lrn,program,year_level,student_photo_url',
            'subjects:id,code,name,units,type,year_level_id',
        ])
        ->where('status', 'pending_accounting');

        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->whereHas('student', function ($q) use ($search) {
                $q->where('first_name', 'like', "%{$search}%")
                  ->orWhere('last_name', 'like', "%{$search}%")
                  ->orWhere('lrn', 'like', "%{$search}%");
            });
        }

        $requests = $query->latest()->paginate(15)->withQueryString();

        $mapped = $requests->through(function ($er) {
            return [
                'id'         => $er->id,
                'school_year' => $er->school_year,
                'semester'   => $er->semester,
                'status'     => $er->status,
                'created_at' => $er->created_at,
                'student'    => [
                    'id'         => $er->student->id,
                    'full_name'  => trim("{$er->student->first_name} {$er->student->last_name}"),
                    'lrn'        => $er->student->lrn,
                    'program'    => $er->student->program,
                    'year_level' => $er->student->year_level,
                    'photo_url'  => $er->student->student_photo_url,
                ],
                'subjects'   => $er->subjects->map(fn ($s) => [
                    'id'           => $s->id,
                    'code'         => $s->code,
                    'name'         => $s->name,
                    'units'        => (float) $s->units,
                    'type'         => $s->type,
                    'selling_price' => (float) $s->pivot->selling_price,
                ])->values(),
                'total_selling_price' => $er->subjects->sum(fn ($s) => (float) $s->pivot->selling_price),
            ];
        });

        return Inertia::render('accounting/clearance/index', [
            'enrollmentRequests' => $mapped,
            'filters' => $request->only(['search']),
        ]);
    }

    /**
     * Approve an enrollment request — send back to registrar.
     */
    public function approve(Request $request, EnrollmentRequest $enrollmentRequest): RedirectResponse
    {
        if ($enrollmentRequest->status !== 'pending_accounting') {
            return back()->with('error', 'This request is not pending accounting review.');
        }

        $enrollmentRequest->update([
            'status' => 'approved_accounting',
            'accounting_reviewed_by' => Auth::id(),
            'accounting_reviewed_at' => now(),
            'accounting_notes' => null,
        ]);

        StudentActionLog::create([
            'student_id'   => $enrollmentRequest->student_id,
            'performed_by' => Auth::id(),
            'action'       => 'Enrollment Clearance Approved',
            'action_type'  => 'enrollment',
            'details'      => "Accounting approved enrollment request #{$enrollmentRequest->id}. Sent back to registrar for finalization.",
        ]);

        return back()->with('success', 'Enrollment request approved. Registrar will complete the enrollment.');
    }

    /**
     * Disapprove an enrollment request — requires notes.
     */
    public function disapprove(Request $request, EnrollmentRequest $enrollmentRequest): RedirectResponse
    {
        if ($enrollmentRequest->status !== 'pending_accounting') {
            return back()->with('error', 'This request is not pending accounting review.');
        }

        $validated = $request->validate([
            'notes' => 'required|string|max:1000',
        ]);

        $enrollmentRequest->update([
            'status' => 'rejected_accounting',
            'accounting_reviewed_by' => Auth::id(),
            'accounting_reviewed_at' => now(),
            'accounting_notes' => $validated['notes'],
        ]);

        StudentActionLog::create([
            'student_id'   => $enrollmentRequest->student_id,
            'performed_by' => Auth::id(),
            'action'       => 'Enrollment Clearance Rejected',
            'action_type'  => 'enrollment',
            'details'      => "Accounting rejected enrollment request #{$enrollmentRequest->id}. Notes: {$validated['notes']}",
        ]);

        return back()->with('error', 'Enrollment request rejected.');
    }
}
