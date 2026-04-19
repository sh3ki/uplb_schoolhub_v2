<?php

namespace App\Http\Controllers\Teacher;

use App\Http\Controllers\Controller;
use App\Models\AppSetting;
use App\Models\StudentActionLog;
use App\Models\StudentSubject;
use App\Models\Subject;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

class SubjectClassController extends Controller
{
    public function index(Request $request): Response
    {
        $teacher = Auth::user()?->teacher;
        abort_unless($teacher, 403);

        $currentSchoolYear = AppSetting::current()->school_year ?? (date('Y') . '-' . (date('Y') + 1));

        $subjects = Subject::query()
            ->whereHas('teachers', fn ($query) => $query->where('teachers.id', $teacher->id))
            ->orderBy('code')
            ->get(['id', 'code', 'name'])
            ->map(function (Subject $subject) use ($currentSchoolYear) {
                $studentCount = StudentSubject::query()
                    ->where('subject_id', $subject->id)
                    ->where('school_year', $currentSchoolYear)
                    ->whereHas('student', fn ($query) => $query->where('enrollment_status', 'enrolled'))
                    ->count();

                return [
                    'id' => $subject->id,
                    'code' => $subject->code,
                    'name' => $subject->name,
                    'student_count' => $studentCount,
                ];
            })
            ->values();

        $selectedSubjectId = (int) ($request->integer('subject_id') ?: ($subjects->first()['id'] ?? 0));

        $enrollments = collect();
        if ($selectedSubjectId > 0) {
            $isAssigned = Subject::query()
                ->where('id', $selectedSubjectId)
                ->whereHas('teachers', fn ($query) => $query->where('teachers.id', $teacher->id))
                ->exists();

            abort_unless($isAssigned, 403);

            $enrollments = StudentSubject::query()
                ->with(['student:id,first_name,last_name,middle_name,suffix,lrn,section,program'])
                ->where('subject_id', $selectedSubjectId)
                ->where('school_year', $currentSchoolYear)
                ->whereHas('student', fn ($query) => $query->where('enrollment_status', 'enrolled'))
                ->orderByDesc('updated_at')
                ->get()
                ->map(fn (StudentSubject $enrollment) => [
                    'id' => $enrollment->id,
                    'student_id' => $enrollment->student_id,
                    'student_name' => trim(($enrollment->student?->last_name ?? '') . ', ' . ($enrollment->student?->first_name ?? '')),
                    'student_number' => $enrollment->student?->lrn,
                    'section' => $enrollment->student?->section,
                    'program' => $enrollment->student?->program,
                    'grade' => $enrollment->grade,
                    'status' => $enrollment->status,
                    'updated_at' => $enrollment->updated_at?->format('M d, Y h:i A'),
                ])
                ->values();
        }

        return Inertia::render('teacher/subject-classes/index', [
            'subjects' => $subjects,
            'selectedSubjectId' => $selectedSubjectId,
            'currentSchoolYear' => $currentSchoolYear,
            'enrollments' => $enrollments,
        ]);
    }

    public function postGrade(Request $request): RedirectResponse
    {
        $teacher = Auth::user()?->teacher;
        abort_unless($teacher, 403);

        $validated = $request->validate([
            'student_subject_id' => 'required|integer|exists:student_subjects,id',
            'grade' => 'required|numeric|min:0|max:100',
            'notes' => 'nullable|string|max:1000',
        ]);

        $enrollment = StudentSubject::query()
            ->with(['subject:id,code,name'])
            ->findOrFail((int) $validated['student_subject_id']);

        $isAssigned = Subject::query()
            ->where('id', $enrollment->subject_id)
            ->whereHas('teachers', fn ($query) => $query->where('teachers.id', $teacher->id))
            ->exists();

        abort_unless($isAssigned, 403);

        $grade = (float) $validated['grade'];

        $enrollment->update([
            'grade' => $grade,
            'status' => $grade >= 75 ? 'completed' : 'failed',
        ]);

        StudentActionLog::log(
            studentId: (int) $enrollment->student_id,
            action: 'grade_posted',
            actionType: 'elms_grade',
            details: 'Your grade has been posted by your subject teacher.',
            notes: $validated['notes'] ?? null,
            changes: [
                'subject_id' => $enrollment->subject_id,
                'subject_code' => $enrollment->subject?->code,
                'subject_name' => $enrollment->subject?->name,
                'grade' => $grade,
                'status' => $grade >= 75 ? 'completed' : 'failed',
                'school_year' => $enrollment->school_year,
            ],
            performedBy: Auth::id()
        );

        return back()->with('success', 'Grade posted successfully.');
    }
}
