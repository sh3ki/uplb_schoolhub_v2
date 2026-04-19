<?php

namespace App\Http\Controllers\Registrar;

use App\Http\Controllers\Controller;
use App\Models\EnrollmentRequest;
use App\Models\Student;
use App\Models\StudentActionLog;
use App\Models\StudentFee;
use App\Models\StudentSubject;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class EnrollmentRequestController extends Controller
{
    /**
     * Approve an enrollment request — send to accounting.
     */
    public function approve(Request $request, EnrollmentRequest $enrollmentRequest): RedirectResponse
    {
        if ($enrollmentRequest->status !== 'pending_registrar') {
            return back()->with('error', 'This request is not pending registrar review.');
        }

        $enrollmentRequest->update([
            'status' => 'pending_accounting',
            'registrar_reviewed_by' => Auth::id(),
            'registrar_reviewed_at' => now(),
            'registrar_notes' => null,
        ]);

        StudentActionLog::create([
            'student_id'   => $enrollmentRequest->student_id,
            'performed_by' => Auth::id(),
            'action'       => 'Enrollment Request Approved',
            'action_type'  => 'enrollment',
            'details'      => "Registrar approved enrollment request #{$enrollmentRequest->id} and forwarded to accounting.",
        ]);

        return back()->with('success', 'Enrollment request approved and sent to accounting.');
    }

    /**
     * Disapprove an enrollment request — requires notes.
     */
    public function disapprove(Request $request, EnrollmentRequest $enrollmentRequest): RedirectResponse
    {
        if ($enrollmentRequest->status !== 'pending_registrar') {
            return back()->with('error', 'This request is not pending registrar review.');
        }

        $validated = $request->validate([
            'notes' => 'required|string|max:1000',
        ]);

        $enrollmentRequest->update([
            'status' => 'rejected_registrar',
            'registrar_reviewed_by' => Auth::id(),
            'registrar_reviewed_at' => now(),
            'registrar_notes' => $validated['notes'],
        ]);

        StudentActionLog::create([
            'student_id'   => $enrollmentRequest->student_id,
            'performed_by' => Auth::id(),
            'action'       => 'Enrollment Request Rejected',
            'action_type'  => 'enrollment',
            'details'      => "Registrar rejected enrollment request #{$enrollmentRequest->id}. Notes: {$validated['notes']}",
        ]);

        return back()->with('success', 'Enrollment request rejected.');
    }

    /**
     * Complete enrollment — after accounting approval.
     * Creates StudentSubject records and adds total to student's yearly balance.
     */
    public function complete(Request $request, EnrollmentRequest $enrollmentRequest): RedirectResponse
    {
        if ($enrollmentRequest->status !== 'approved_accounting') {
            return back()->with('error', 'This request has not been approved by accounting yet.');
        }

        $student = $enrollmentRequest->student;

        DB::transaction(function () use ($enrollmentRequest, $student) {
            $subjects = $enrollmentRequest->subjects()->get();
            $total = 0;
            $enrolledNames = [];

            foreach ($subjects as $subject) {
                $sellingPrice = (float) $subject->pivot->selling_price;
                $total += $sellingPrice;

                // Create StudentSubject record if it doesn't already exist
                StudentSubject::firstOrCreate(
                    [
                        'student_id'  => $student->id,
                        'subject_id'  => $subject->id,
                        'school_year' => $enrollmentRequest->school_year,
                        'semester'    => $enrollmentRequest->semester,
                    ],
                    ['status' => 'enrolled']
                );

                $enrolledNames[] = $subject->code . ' - ' . $subject->name;
            }

            // Add total to student's yearly balance
            if ($total > 0) {
                $studentFee = StudentFee::firstOrCreate(
                    ['student_id' => $student->id, 'school_year' => $enrollmentRequest->school_year],
                    [
                        'registration_fee' => 0,
                        'tuition_fee' => 0,
                        'misc_fee' => 0,
                        'books_fee' => 0,
                        'other_fees' => 0,
                        'total_amount' => 0,
                        'total_paid' => 0,
                        'balance' => 0,
                        'grant_discount' => 0,
                    ]
                );

                $studentFee->tuition_fee = (float) $studentFee->tuition_fee + $total;
                $studentFee->total_amount = (float) $studentFee->total_amount + $total;
                $studentFee->balance = max(
                    0,
                    (float) $studentFee->total_amount - (float) $studentFee->total_paid - (float) ($studentFee->grant_discount ?? 0)
                );

                $studentFee->payment_status = $studentFee->is_overdue
                    ? 'overdue'
                    : ($studentFee->balance <= 0
                        ? 'paid'
                        : ((float) $studentFee->total_paid > 0 ? 'partial' : 'unpaid'));

                $studentFee->save();
            }

            $enrollmentRequest->update([
                'status' => 'completed',
                'completed_by' => Auth::id(),
                'completed_at' => now(),
                'total_amount' => $total,
            ]);

            StudentActionLog::create([
                'student_id'   => $student->id,
                'performed_by' => Auth::id(),
                'action'       => 'Enrollment Completed',
                'action_type'  => 'enrollment',
                'details'      => "Registrar completed enrollment. Subjects: " . implode(', ', $enrolledNames) . ". Total added to balance: ₱" . number_format($total, 2),
            ]);
        });

        return back()->with('success', 'Enrollment completed successfully.');
    }
}
