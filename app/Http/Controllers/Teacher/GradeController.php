<?php

namespace App\Http\Controllers\Teacher;

use App\Http\Controllers\Controller;
use App\Models\Student;
use App\Models\Section;
use App\Models\Subject;
use App\Models\StudentSubject;
use App\Models\AppSetting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class GradeController extends Controller
{
    public function index(Request $request)
    {
        $user = Auth::user();
        $teacher = $user->teacher;
        $settings = AppSetting::current();
        $currentSchoolYear = $settings->school_year ?? (date('Y') . '-' . (date('Y') + 1));

        // Advisory section IDs for this teacher
        $advisorySectionIds = Section::where('teacher_id', $teacher?->id)
            ->where('is_active', true)
            ->pluck('id')
            ->toArray();

        // Teaching subjects for this teacher
        $teachingSubjects = Subject::whereHas('teachers', fn ($q) => $q->where('teachers.id', $teacher?->id))
            ->where('is_active', true)
            ->get();

        // Base scoped student query
        $base = Student::query()
            ->where('enrollment_status', 'enrolled')
            ->where(function ($q) use ($advisorySectionIds, $teachingSubjects) {
                if (!empty($advisorySectionIds)) {
                    $q->orWhereIn('section_id', $advisorySectionIds);
                }
                foreach ($teachingSubjects as $subject) {
                    $q->orWhere(function ($inner) use ($subject) {
                        $inner->where('department_id', $subject->department_id);
                        if ($subject->year_level_id) {
                            $inner->where('year_level_id', $subject->year_level_id);
                        }
                    });
                }
            });

        // Fallback if no assignments yet
        $hasAssignments = !empty($advisorySectionIds) || $teachingSubjects->isNotEmpty();
        if (!$hasAssignments && $teacher?->department_id) {
            $base = Student::query()
                ->where('enrollment_status', 'enrolled')
                ->where('department_id', $teacher->department_id);
        }

        $query = clone $base;

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('first_name', 'like', "%{$search}%")
                  ->orWhere('last_name', 'like', "%{$search}%")
                  ->orWhere('lrn', 'like', "%{$search}%");
            });
        }

        if ($request->filled('section') && $request->section !== 'all') {
            $query->where('section', $request->section);
        }

        if ($request->filled('subject') && $request->subject !== 'all') {
            // Filter by students enrolled in this subject
            $subjectId = $request->subject;
            $query->whereHas('studentSubjects', fn ($q) => $q->where('subject_id', $subjectId)->where('school_year', $currentSchoolYear));
        }

        $students = $query->with(['studentSubjects' => fn ($q) => $q->where('school_year', $currentSchoolYear)->with('subject:id,code,name,units')])
            ->orderBy('last_name')
            ->paginate(25)
            ->withQueryString();

        // Sections scoped to this teacher's pool
        $sectionNames = (clone $base)->select('section')
            ->whereNotNull('section')
            ->where('section', '!=', '')
            ->distinct()
            ->orderBy('section')
            ->pluck('section')
            ->map(fn ($name) => ['id' => $name, 'name' => $name]);

        return Inertia::render('teacher/grades/index', [
            'students'          => $students,
            'sections'          => $sectionNames,
            'subjects'          => $teachingSubjects->map(fn ($s) => ['id' => $s->id, 'name' => "{$s->code} - {$s->name}"]),
            'currentSchoolYear' => $currentSchoolYear,
            'filters'           => [
                'search'  => $request->search,
                'section' => $request->section,
                'subject' => $request->subject,
            ],
        ]);
    }

    /**
     * Store/update grades for students.
     * Expects: { grades: [{ student_id, subject_id, grade, status? }] }
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'grades'              => 'required|array|min:1',
            'grades.*.student_id' => 'required|exists:students,id',
            'grades.*.subject_id' => 'required|exists:subjects,id',
            'grades.*.grade'      => 'nullable|numeric|min:0|max:100',
            'grades.*.status'     => 'nullable|in:enrolled,completed,failed,dropped',
        ]);

        $settings = AppSetting::current();
        $currentSchoolYear = $settings->school_year ?? (date('Y') . '-' . (date('Y') + 1));

        $updated = 0;
        foreach ($validated['grades'] as $gradeEntry) {
            // Find the student_subjects record
            $enrollment = StudentSubject::where('student_id', $gradeEntry['student_id'])
                ->where('subject_id', $gradeEntry['subject_id'])
                ->where('school_year', $currentSchoolYear)
                ->first();

            if ($enrollment) {
                $updateData = [];
                
                if (isset($gradeEntry['grade'])) {
                    $updateData['grade'] = $gradeEntry['grade'];
                    
                    // Auto-determine status based on grade if not explicitly set
                    if (!isset($gradeEntry['status'])) {
                        // Passing grade is typically >= 75 or >= 1.0 depending on system
                        // Using 75 as passing threshold
                        $updateData['status'] = $gradeEntry['grade'] >= 75 ? 'completed' : 'failed';
                    }
                }
                
                if (isset($gradeEntry['status'])) {
                    $updateData['status'] = $gradeEntry['status'];
                }

                if (!empty($updateData)) {
                    $enrollment->update($updateData);
                    $updated++;
                }
            }
        }

        return back()->with('success', "{$updated} grade(s) saved successfully.");
    }
}
