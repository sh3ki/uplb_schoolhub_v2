<?php

namespace App\Http\Controllers\Student;

use App\Http\Controllers\Controller;
use App\Models\AppSetting;
use App\Models\Department;
use App\Models\EnrollmentRequest;
use App\Models\Program;
use App\Models\Student;
use App\Models\StudentActionLog;
use App\Models\StudentSubject;
use App\Models\Subject;
use App\Models\YearLevel;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class CollegeEnrollmentController extends Controller
{
    private const MAX_UNITS  = 24;
    private const MIN_UNITS  = 15;
    private const IDEAL_UNITS = 21;

    public function index(): Response|RedirectResponse
    {
        $user    = Auth::user();
        $student = $user->student;

        if (!$student) {
            return redirect()->route('student.dashboard')
                ->with('error', 'No student record linked to your account.');
        }

        $settings          = AppSetting::current();
        $currentSchoolYear = $settings->school_year ?? date('Y') . '-' . (date('Y') + 1);
        $activeSemester    = (int) ($settings->active_semester ?? 1);

        if ($student->enrollment_status !== 'enrolled') {
            return redirect()->route('student.enrollment.index')
                ->with('error', 'You must be officially enrolled to access subject enrollment.');
        }

        $classification = $student->resolveDepartmentClassification();
        $departmentId   = $student->resolveDepartmentId();

        if ($classification !== 'College') {
            return redirect()->route('student.dashboard')
                ->with('error', 'Subject enrollment is only available for college students.');
        }

        if (!$settings->isEnrollmentOpen('College')) {
            return redirect()->route('student.dashboard')
                ->with('info', 'College enrollment is currently closed.');
        }

        $program = Program::where('name', $student->program)
            ->when($departmentId, fn ($q) => $q->where('department_id', $departmentId))
            ->first();

        $yearLevel = YearLevel::where('name', $student->year_level)
            ->when($departmentId, fn ($q) => $q->where('department_id', $departmentId))
            ->first();

        $availableSubjects = $this->getAvailableSubjects(
            $student,
            $activeSemester,
            $currentSchoolYear,
            $program,
            $yearLevel
        );

        // Current semester enrolled subjects
        $enrolledSubjects = StudentSubject::where('student_id', $student->id)
            ->where('school_year', $currentSchoolYear)
            ->where('semester', $activeSemester)
            ->with('subject:id,code,name,units,type,semester,year_level_id')
            ->get()
            ->map(fn ($ss) => [
                'id'         => $ss->id,
                'subject_id' => $ss->subject_id,
                'code'       => $ss->subject->code ?? '',
                'name'       => $ss->subject->name ?? '',
                'units'      => (float) ($ss->subject->units ?? 0),
                'type'       => $ss->subject->type ?? '',
                'status'     => $ss->status,
                'grade'      => $ss->grade,
            ]);

        $enrolledUnits = $enrolledSubjects->sum('units');

        // Completed subjects (all time)
        $completedSubjectIds = StudentSubject::where('student_id', $student->id)
            ->where('status', 'completed')
            ->pluck('subject_id')
            ->toArray();

        // All completed subject details for the "Completed Subjects" tab
        $completedSubjects = StudentSubject::where('student_id', $student->id)
            ->where('status', 'completed')
            ->with('subject:id,code,name,units,type,year_level_id,semester')
            ->get()
            ->map(fn ($ss) => [
                'id'          => $ss->id,
                'subject_id'  => $ss->subject_id,
                'code'        => $ss->subject->code ?? '',
                'name'        => $ss->subject->name ?? '',
                'units'       => (float) ($ss->subject->units ?? 0),
                'type'        => $ss->subject->type ?? '',
                'school_year' => $ss->school_year,
                'semester'    => $ss->semester,
                'grade'       => $ss->grade,
            ])
            ->sortBy('school_year')
            ->values();

        // Active enrollment request for this semester (if any)
        $activeRequest = EnrollmentRequest::where('student_id', $student->id)
            ->where('school_year', $currentSchoolYear)
            ->where('semester', $activeSemester)
            ->whereNotIn('status', ['rejected_registrar', 'rejected_accounting', 'completed'])
            ->with('subjects:id,code,name,units,type')
            ->first();

        $activeRequestData = null;
        if ($activeRequest) {
            $activeRequestData = [
                'id'                  => $activeRequest->id,
                'status'              => $activeRequest->status,
                'registrar_notes'     => $activeRequest->registrar_notes,
                'accounting_notes'    => $activeRequest->accounting_notes,
                'created_at'          => $activeRequest->created_at,
                'subjects'            => $activeRequest->subjects->map(fn ($s) => [
                    'id'           => $s->id,
                    'code'         => $s->code,
                    'name'         => $s->name,
                    'units'        => (float) $s->units,
                    'type'         => $s->type,
                    'selling_price' => (float) $s->pivot->selling_price,
                ])->values(),
            ];
        }

        // Rejected requests visible to student
        $rejectedRequests = EnrollmentRequest::where('student_id', $student->id)
            ->where('school_year', $currentSchoolYear)
            ->where('semester', $activeSemester)
            ->whereIn('status', ['rejected_registrar', 'rejected_accounting'])
            ->with('subjects:id,code,name,units,type')
            ->latest()
            ->get()
            ->map(fn ($er) => [
                'id'               => $er->id,
                'status'           => $er->status,
                'registrar_notes'  => $er->registrar_notes,
                'accounting_notes' => $er->accounting_notes,
                'created_at'       => $er->created_at,
            ]);

        $semesterLabels = [1 => '1st Semester', 2 => '2nd Semester', 3 => 'Summer'];

        return Inertia::render('student/enrollment/subjects', [
            'student' => [
                'id'                => $student->id,
                'first_name'        => $student->first_name,
                'last_name'         => $student->last_name,
                'lrn'               => $student->lrn,
                'program'           => $student->program,
                'year_level'        => $student->year_level,
                'department_id'     => $student->department_id,
                'enrollment_status' => $student->enrollment_status,
            ],
            'currentSchoolYear'   => $currentSchoolYear,
            'activeSemester'      => $activeSemester,
            'activeSemesterLabel' => $semesterLabels[$activeSemester] ?? "Semester {$activeSemester}",
            'availableSubjects'   => $availableSubjects->values(),
            'enrolledSubjects'    => $enrolledSubjects->values(),
            'completedSubjects'   => $completedSubjects,
            'completedSubjectIds' => $completedSubjectIds,
            'enrolledUnits'       => (float) $enrolledUnits,
            'maxUnits'            => self::MAX_UNITS,
            'minUnits'            => self::MIN_UNITS,
            'idealUnits'          => self::IDEAL_UNITS,
            'activeRequest'       => $activeRequestData,
            'rejectedRequests'    => $rejectedRequests,
        ]);
    }

    /**
     * Create an enrollment request for the selected subjects.
     */
    public function store(Request $request): RedirectResponse
    {
        $user    = Auth::user();
        $student = $user->student;

        if (!$student) {
            return back()->with('error', 'No student record linked to your account.');
        }

        $settings          = AppSetting::current();
        $currentSchoolYear = $settings->school_year ?? date('Y') . '-' . (date('Y') + 1);
        $activeSemester    = (int) ($settings->active_semester ?? 1);

        if ($student->enrollment_status !== 'enrolled') {
            return back()->with('error', 'You must be officially enrolled to enroll in subjects.');
        }

        $classification = $student->resolveDepartmentClassification();
        if (!$settings->isEnrollmentOpen('College') || $classification !== 'College') {
            return back()->with('error', 'College enrollment is currently closed.');
        }

        // Block if active request already exists
        $existing = EnrollmentRequest::where('student_id', $student->id)
            ->where('school_year', $currentSchoolYear)
            ->where('semester', $activeSemester)
            ->whereNotIn('status', ['rejected_registrar', 'rejected_accounting', 'completed'])
            ->exists();

        if ($existing) {
            return back()->with('error', 'You already have a pending enrollment request for this semester.');
        }

        $validated = $request->validate([
            'subject_ids'   => ['required', 'array', 'min:1'],
            'subject_ids.*' => ['integer', 'exists:subjects,id'],
        ]);

        $subjectIds = $validated['subject_ids'];

        // Validate prerequisites + no duplicates
        $completedSubjectIds = StudentSubject::where('student_id', $student->id)
            ->where('status', 'completed')
            ->pluck('subject_id')
            ->toArray();

        $currentlyEnrolledIds = StudentSubject::where('student_id', $student->id)
            ->where('school_year', $currentSchoolYear)
            ->where('semester', $activeSemester)
            ->pluck('subject_id')
            ->toArray();

        $subjectsToEnroll = Subject::with('prerequisites:id,code,name')
            ->where('classification', 'College')
            ->whereIn('id', $subjectIds)
            ->get();

        if ($subjectsToEnroll->count() !== count($subjectIds)) {
            return back()->with('error', 'One or more selected subjects are invalid.');
        }

        foreach ($subjectsToEnroll as $subject) {
            if (in_array($subject->id, $currentlyEnrolledIds)) {
                return back()->with('error', "You are already enrolled in {$subject->name} this semester.");
            }
            if (in_array($subject->id, $completedSubjectIds)) {
                return back()->with('error', "You have already completed {$subject->name}.");
            }

            $prereqIds   = $subject->prerequisites->pluck('id')->toArray();
            $unmetPrereqs = array_diff($prereqIds, $completedSubjectIds);
            if (!empty($unmetPrereqs)) {
                $unmetNames = Subject::whereIn('id', $unmetPrereqs)->pluck('name')->join(', ');
                return back()->with('error', "Cannot enroll in {$subject->name}: prerequisites not completed — {$unmetNames}.");
            }
        }

        // Unit check
        $newUnits = $subjectsToEnroll->sum('units');
        $existingUnits = StudentSubject::where('student_id', $student->id)
            ->where('school_year', $currentSchoolYear)
            ->where('semester', $activeSemester)
            ->where('status', 'enrolled')
            ->join('subjects', 'subjects.id', '=', 'student_subjects.subject_id')
            ->sum('subjects.units');

        if ((float) $existingUnits + (float) $newUnits > self::MAX_UNITS) {
            return back()->with('error', "Total units would exceed the maximum of " . self::MAX_UNITS . " per semester.");
        }

        DB::transaction(function () use ($student, $subjectsToEnroll, $currentSchoolYear, $activeSemester, $user) {
            $enrollmentRequest = EnrollmentRequest::create([
                'student_id'  => $student->id,
                'school_year' => $currentSchoolYear,
                'semester'    => $activeSemester,
                'status'      => 'pending_registrar',
            ]);

            $pivotData = [];
            foreach ($subjectsToEnroll as $subject) {
                $pivotData[$subject->id] = ['selling_price' => $subject->selling_price ?? 0];
            }
            $enrollmentRequest->subjects()->attach($pivotData);

            $names = $subjectsToEnroll->map(fn ($s) => $s->code . ' - ' . $s->name)->join(', ');

            StudentActionLog::create([
                'student_id'   => $student->id,
                'performed_by' => $user->id,
                'action'       => 'Enrollment Request Submitted',
                'action_type'  => 'enrollment',
                'details'      => "Student submitted enrollment request for {$subjectsToEnroll->count()} subject(s): {$names}.",
            ]);
        });

        return back()->with('success', 'Enrollment request submitted. Awaiting registrar review.');
    }

    /**
     * Drop a subject from the student's current semester enrollment.
     */
    public function drop(Request $request, StudentSubject $enrollment): RedirectResponse
    {
        $user    = Auth::user();
        $student = $user->student;

        if (!$student || $enrollment->student_id !== $student->id) {
            return back()->with('error', 'Unauthorized action.');
        }

        $settings       = AppSetting::current();
        $activeSemester = (int) ($settings->active_semester ?? 1);

        if (!$settings->isEnrollmentOpen('College')) {
            return back()->with('error', 'Cannot drop subjects: enrollment period is closed.');
        }

        if ($enrollment->status !== 'enrolled') {
            return back()->with('error', "Cannot drop this subject: status is '{$enrollment->status}'.");
        }

        $subjectName = $enrollment->subject->name ?? 'Unknown';

        $enrollment->delete();

        StudentActionLog::create([
            'student_id'   => $student->id,
            'performed_by' => $user->id,
            'action'       => 'Subject Dropped',
            'action_type'  => 'enrollment',
            'details'      => "Student dropped subject: {$subjectName}.",
        ]);

        return back()->with('success', "Successfully dropped {$subjectName}.");
    }

    private function getAvailableSubjects(
        Student $student,
        int $activeSemester,
        string $currentSchoolYear,
        ?Program $program,
        ?YearLevel $yearLevel
    ) {
        $query = Subject::with([
                'prerequisites:id,code,name',
                'yearLevel:id,name,level_number',
                'programs:id,name',
            ])
            ->where('classification', 'College')
            ->where('is_active', true)
            ->where(function ($q) use ($activeSemester) {
                $q->where('semester', $activeSemester)
                  ->orWhereNull('semester');
            });

        $departmentId = $student->resolveDepartmentId();
        if ($departmentId) {
            $query->where(function ($q) use ($departmentId) {
                $q->where('department_id', $departmentId)
                  ->orWhereHas('departments', fn ($dq) => $dq->where('departments.id', $departmentId));
            });
        }

        if ($program) {
            $query->where(function ($q) use ($program) {
                $q->whereHas('programs', fn ($pq) => $pq->where('programs.id', $program->id))
                  ->orWhereDoesntHave('programs');
            });
        }

        $subjects = $query->orderBy('year_level_id')->orderBy('code')->get();

        $completedIds = StudentSubject::where('student_id', $student->id)
            ->where('status', 'completed')
            ->pluck('subject_id')
            ->toArray();

        $currentlyEnrolledIds = StudentSubject::where('student_id', $student->id)
            ->where('school_year', $currentSchoolYear)
            ->where('semester', $activeSemester)
            ->pluck('subject_id')
            ->toArray();

        // Also exclude subjects in an active pending request
        $pendingRequestSubjectIds = DB::table('enrollment_request_subjects')
            ->whereIn('enrollment_request_id',
                EnrollmentRequest::where('student_id', $student->id)
                    ->where('school_year', $currentSchoolYear)
                    ->where('semester', $activeSemester)
                    ->whereNotIn('status', ['rejected_registrar', 'rejected_accounting', 'completed'])
                    ->pluck('id')
            )
            ->pluck('subject_id')
            ->toArray();

        $excludeIds = array_unique(array_merge($completedIds, $currentlyEnrolledIds, $pendingRequestSubjectIds));

        return $subjects->reject(fn ($s) => in_array($s->id, $excludeIds))
            ->map(function ($subject) use ($completedIds) {
                $prereqIds        = $subject->prerequisites->pluck('id')->toArray();
                $unmetPrereqIds   = array_diff($prereqIds, $completedIds);
                $prerequisitesMet = empty($unmetPrereqIds);

                return [
                    'id'                => $subject->id,
                    'code'              => $subject->code,
                    'name'              => $subject->name,
                    'description'       => $subject->description,
                    'units'             => (float) $subject->units,
                    'type'              => $subject->type,
                    'semester'          => $subject->semester,
                    'hours_per_week'    => $subject->hours_per_week,
                    'selling_price'     => (float) ($subject->selling_price ?? 0),
                    'year_level_name'   => $subject->yearLevel?->name ?? 'General',
                    'level_number'      => $subject->yearLevel?->level_number ?? 0,
                    'prerequisites'     => $subject->prerequisites->map(fn ($p) => [
                        'id'        => $p->id,
                        'code'      => $p->code,
                        'name'      => $p->name,
                        'completed' => in_array($p->id, $completedIds),
                    ])->values(),
                    'prerequisites_met' => $prerequisitesMet,
                    'programs'          => $subject->programs->pluck('name')->values(),
                ];
            });
    }
}
