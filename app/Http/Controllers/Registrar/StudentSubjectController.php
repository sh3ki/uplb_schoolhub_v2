<?php

namespace App\Http\Controllers\Registrar;

use App\Http\Controllers\Controller;
use App\Models\Student;
use App\Models\Subject;
use App\Models\StudentSubject;
use App\Models\AppSetting;
use Illuminate\Http\Request;

class StudentSubjectController extends Controller
{
    /**
     * Return subjects for a given student's department,
     * grouped by year level, annotated with the student's enrollment status.
     */
    public function index(Request $request, Student $student)
    {
        $schoolYear = $request->input('school_year', AppSetting::getSetting('school_year', date('Y') . '-' . (date('Y') + 1)));
        $semester   = $request->input('semester'); // 1 | 2 | null

        // All subjects in the student's department (all year levels = full curriculum view)
        $subjects = Subject::with(['yearLevel:id,name,level_number'])
            ->where('department_id', $student->department_id)
            ->where('classification', 'College')
            ->where('is_active', true)
            ->orderBy('year_level_id')
            ->orderBy('semester')
            ->orderBy('code')
            ->get();

        // Student's enrollment records for the requested school year
        $enrollments = StudentSubject::where('student_id', $student->id)
            ->where('school_year', $schoolYear)
            ->get()
            ->keyBy(fn ($e) => "{$e->subject_id}_{$e->semester}");

        // Annotate each subject with enrollment status
        $annotated = $subjects->map(function ($subject) use ($enrollments, $semester) {
            $key = "{$subject->id}_{$subject->semester}";
            $enrollment = $enrollments[$key] ?? null;
            return [
                'id'              => $subject->id,
                'code'            => $subject->code,
                'name'            => $subject->name,
                'units'           => (float) $subject->units,
                'type'            => $subject->type,
                'semester'        => $subject->semester,
                'year_level_id'   => $subject->year_level_id,
                'year_level_name' => $subject->yearLevel?->name ?? 'N/A',
                'level_number'    => $subject->yearLevel?->level_number ?? 0,
                // enrollment info
                'enrollment_status' => $enrollment?->status,   // null = not enrolled
                'enrollment_id'     => $enrollment?->id,
                'grade'             => $enrollment?->grade,
            ];
        });

        // Group by year level
        $grouped = $annotated
            ->sortBy(['level_number', 'semester', 'code'])
            ->groupBy('year_level_name')
            ->map(fn ($items) => $items->values());

        // Totals for current school year
        $enrolledUnits = StudentSubject::where('student_id', $student->id)
            ->where('school_year', $schoolYear)
            ->whereIn('status', ['enrolled'])
            ->join('subjects', 'subjects.id', '=', 'student_subjects.subject_id')
            ->sum('subjects.units');

        $completedUnits = StudentSubject::where('student_id', $student->id)
            ->where('status', 'completed')
            ->join('subjects', 'subjects.id', '=', 'student_subjects.subject_id')
            ->sum('subjects.units');

        return response()->json([
            'subjects_by_year_level' => $grouped,
            'school_year'            => $schoolYear,
            'enrolled_units'         => (float) $enrolledUnits,
            'completed_units'        => (float) $completedUnits,
        ]);
    }

    /**
     * Enroll a student in a list of subject IDs for a given school year/semester.
     * Pass subject_ids[], school_year, semester in the request body.
     */
    public function sync(Request $request, Student $student)
    {
        $data = $request->validate([
            'subject_ids'   => ['required', 'array'],
            'subject_ids.*' => ['integer', 'exists:subjects,id'],
            'school_year'   => ['required', 'string'],
            'semester'      => ['nullable', 'integer', 'in:1,2'],
        ]);

        $schoolYear = $data['school_year'];
        $semester   = $data['semester'] ?? null;

        // Remove existing enrolled records for this school year + semester (not completed/failed)
        StudentSubject::where('student_id', $student->id)
            ->where('school_year', $schoolYear)
            ->where('semester', $semester)
            ->where('status', 'enrolled')
            ->whereNotIn('subject_id', $data['subject_ids'])
            ->delete();

        // Insert / ensure exist for the chosen subjects
        foreach ($data['subject_ids'] as $subjectId) {
            StudentSubject::firstOrCreate([
                'student_id' => $student->id,
                'subject_id' => $subjectId,
                'school_year'=> $schoolYear,
                'semester'   => $semester,
            ], [
                'status' => 'enrolled',
            ]);
        }

        return back()->with('success', 'Subjects updated successfully.');
    }

    /**
     * Update the status of a specific student–subject enrollment.
     * PATCH /registrar/students/{student}/subjects/{enrollment}
     */
    public function updateStatus(Request $request, Student $student, StudentSubject $enrollment)
    {
        // Ensure the enrollment belongs to this student
        abort_unless($enrollment->student_id === $student->id, 403);

        $data = $request->validate([
            'status' => ['required', 'in:enrolled,completed,failed,dropped'],
            'grade'  => ['nullable', 'numeric', 'min:0', 'max:100'],
        ]);

        $enrollment->update($data);

        return back()->with('success', 'Subject status updated.');
    }
}
