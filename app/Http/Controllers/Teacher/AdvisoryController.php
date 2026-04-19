<?php

namespace App\Http\Controllers\Teacher;

use App\Http\Controllers\Controller;
use App\Models\Section;
use App\Models\Student;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

class AdvisoryController extends Controller
{
    public function dashboard(): Response
    {
        $teacher = Auth::user()?->teacher;
        abort_unless($teacher, 403);

        $sections = Section::query()
            ->withCount(['students' => fn ($query) => $query->where('enrollment_status', 'enrolled')])
            ->where('teacher_id', $teacher->id)
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'room_number'])
            ->map(fn (Section $section) => [
                'id' => $section->id,
                'name' => $section->name,
                'room_number' => $section->room_number,
                'student_count' => $section->students_count,
            ])
            ->values();

        $studentsQuery = Student::query()
            ->whereIn('section_id', $sections->pluck('id'))
            ->where('enrollment_status', 'enrolled');

        $maleCount = (clone $studentsQuery)->where('gender', 'Male')->count();
        $femaleCount = (clone $studentsQuery)->where('gender', 'Female')->count();

        return Inertia::render('teacher/advisory/dashboard', [
            'sections' => $sections,
            'summary' => [
                'total_sections' => $sections->count(),
                'total_students' => $studentsQuery->count(),
                'male_students' => $maleCount,
                'female_students' => $femaleCount,
            ],
        ]);
    }

    public function studentProfiles(): Response
    {
        $teacher = Auth::user()?->teacher;
        abort_unless($teacher, 403);

        $sectionIds = Section::query()
            ->where('teacher_id', $teacher->id)
            ->where('is_active', true)
            ->pluck('id');

        $students = Student::query()
            ->whereIn('section_id', $sectionIds)
            ->where('enrollment_status', 'enrolled')
            ->orderBy('last_name')
            ->paginate(20)
            ->withQueryString()
            ->through(fn (Student $student) => [
                'id' => $student->id,
                'student_number' => $student->lrn,
                'name' => trim($student->last_name . ', ' . $student->first_name),
                'gender' => $student->gender,
                'program' => $student->program,
                'year_level' => $student->year_level,
                'section' => $student->section,
                'email' => $student->email,
                'phone' => $student->phone,
                'guardian_name' => $student->guardian_name,
                'guardian_contact' => $student->guardian_contact,
            ]);

        return Inertia::render('teacher/advisory/student-profiles', [
            'students' => $students,
        ]);
    }
}
