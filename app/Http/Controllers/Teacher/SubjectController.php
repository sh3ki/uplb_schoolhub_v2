<?php

namespace App\Http\Controllers\Teacher;

use App\Http\Controllers\Controller;
use App\Models\AppSetting;
use App\Models\Subject;
use App\Models\StudentSubject;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class SubjectController extends Controller
{
    public function index(Request $request)
    {
        $user = Auth::user();
        $teacher = $user->teacher;
        
        $query = Subject::with(['department', 'yearLevel', 'teachers:id,first_name,last_name'])
            ->where('is_active', true);

        // Filter by subjects assigned to this teacher via pivot
        if ($teacher) {
            $query->whereHas('teachers', fn($q) => $q->where('teachers.id', $teacher->id));
        }

        // Search filter
        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where(function ($q) use ($search) {
                $q->where('code', 'like', "%{$search}%")
                    ->orWhere('name', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%");
            });
        }

        // Type filter
        if ($request->filled('type') && $request->input('type') !== 'all') {
            $query->where('type', $request->input('type'));
        }

        // Classification filter
        if ($request->filled('classification') && $request->input('classification') !== 'all') {
            $query->where('classification', $request->input('classification'));
        }

        $subjects = $query->orderBy('code')->paginate(15)->withQueryString();

        return Inertia::render('teacher/subjects/index', [
            'subjects' => $subjects,
            'filters' => $request->only(['search', 'type', 'classification']),
            'teacherId' => $teacher?->id,
        ]);
    }

    /**
     * Display students enrolled in a specific subject.
     */
    public function students(Subject $subject, Request $request)
    {
        $user = Auth::user();
        $teacher = $user->teacher;

        $isAssigned = Subject::query()
            ->where('id', $subject->id)
            ->whereHas('teachers', fn ($query) => $query->where('teachers.id', $teacher?->id))
            ->exists();

        abort_unless($isAssigned, 403, 'You are not assigned to this subject.');

        $currentSchoolYear = AppSetting::current()->school_year ?? (date('Y') . '-' . (date('Y') + 1));

        $baseQuery = StudentSubject::query()
            ->where('subject_id', $subject->id)
            ->where('school_year', $currentSchoolYear)
            ->whereHas('student', fn ($query) => $query->where('enrollment_status', 'enrolled'));

        $query = (clone $baseQuery)
            ->with(['student.department:id,name,classification'])
            ->latest();

        // Search filter
        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->whereHas('student', function ($q) use ($search) {
                $q->where('first_name', 'like', "%{$search}%")
                    ->orWhere('last_name', 'like', "%{$search}%")
                    ->orWhere('middle_name', 'like', "%{$search}%")
                    ->orWhere('lrn', 'like', "%{$search}%");
            });
        }

        // Section filter
        if ($request->filled('section') && $request->input('section') !== 'all') {
            $section = (string) $request->input('section');
            $query->whereHas('student', fn ($q) => $q->where('section', $section));
        }

        // Gender filter
        if ($request->filled('gender') && $request->input('gender') !== 'all') {
            $gender = (string) $request->input('gender');
            $query->whereHas('student', fn ($q) => $q->where('gender', $gender));
        }

        // Subject enrollment status filter
        if ($request->filled('subject_status') && $request->input('subject_status') !== 'all') {
            $query->where('status', (string) $request->input('subject_status'));
        }

        $students = $query
            ->paginate(20)
            ->withQueryString()
            ->through(function (StudentSubject $enrollment) {
                $student = $enrollment->student;

                return [
                    'id' => $student?->id,
                    'student_subject_id' => $enrollment->id,
                    'first_name' => $student?->first_name,
                    'last_name' => $student?->last_name,
                    'middle_name' => $student?->middle_name,
                    'suffix' => $student?->suffix,
                    'lrn' => $student?->lrn,
                    'email' => $student?->email,
                    'year_level' => $student?->year_level,
                    'section' => $student?->section,
                    'enrollment_status' => $student?->enrollment_status,
                    'student_photo_url' => $student?->student_photo_url,
                    'department' => $student?->department,
                    'gender' => $student?->gender,
                    'grade' => $enrollment->grade,
                    'subject_status' => $enrollment->status,
                ];
            });

        // Get sections for filter from the same subject enrollment pool.
        $sections = (clone $baseQuery)
            ->with('student:id,section')
            ->get()
            ->pluck('student.section')
            ->filter(fn ($section) => filled($section))
            ->unique()
            ->sort()
            ->values();

        return Inertia::render('teacher/subjects/students', [
            'subject' => $subject->load(['department', 'yearLevel']),
            'students' => $students,
            'currentSchoolYear' => $currentSchoolYear,
            'sections' => $sections,
            'filters' => $request->only(['search', 'section', 'gender', 'subject_status']),
        ]);
    }
}
