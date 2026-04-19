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
        abort_if(!$teacher, 403);

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
        abort_if(!$teacher, 403);

        $validated = $request->validate([
            'student_subject_id' => 'required|integer|exists:student_subjects,id',
            'grade' => 'nullable|numeric|min:0|max:100',
            'notes' => 'nullable|string|max:1000',
            'action' => 'nullable|in:save,post',
            'breakdown' => 'nullable|array',
            'breakdown.written_works' => 'nullable|array',
            'breakdown.written_works.*.title' => 'nullable|string|max:255',
            'breakdown.written_works.*.score' => 'nullable|numeric|min:0|max:100',
            'breakdown.performance_tasks' => 'nullable|array',
            'breakdown.performance_tasks.*.title' => 'nullable|string|max:255',
            'breakdown.performance_tasks.*.score' => 'nullable|numeric|min:0|max:100',
            'breakdown.examinations' => 'nullable|array',
            'breakdown.examinations.*.title' => 'nullable|string|max:255',
            'breakdown.examinations.*.score' => 'nullable|numeric|min:0|max:100',
            'breakdown.weights' => 'nullable|array',
            'breakdown.weights.written_works' => 'nullable|numeric|min:0|max:100',
            'breakdown.weights.performance_tasks' => 'nullable|numeric|min:0|max:100',
            'breakdown.weights.examinations' => 'nullable|numeric|min:0|max:100',
        ]);

        $enrollment = StudentSubject::query()
            ->with(['subject:id,code,name'])
            ->findOrFail((int) $validated['student_subject_id']);

        $isAssigned = Subject::query()
            ->where('id', $enrollment->subject_id)
            ->whereHas('teachers', fn ($query) => $query->where('teachers.id', $teacher->id))
            ->exists();

        abort_unless($isAssigned, 403);

        $action = $validated['action'] ?? 'post';

        [$payload, $finalGrade] = $this->buildGradePayload($validated, $enrollment->draft_breakdown ?? []);

        if ($action === 'save') {
            $enrollment->update([
                'draft_grade' => $finalGrade,
                'draft_breakdown' => $payload,
                'is_grade_posted' => false,
            ]);

            return back()->with('success', 'Grade draft saved successfully.');
        }

        $enrollment->update([
            'grade' => $finalGrade,
            'draft_grade' => $finalGrade,
            'status' => $finalGrade >= 75 ? 'completed' : 'failed',
            'grade_breakdown' => $payload,
            'draft_breakdown' => $payload,
            'is_grade_posted' => true,
            'grade_posted_at' => now(),
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
                'grade' => $finalGrade,
                'status' => $finalGrade >= 75 ? 'completed' : 'failed',
                'school_year' => $enrollment->school_year,
                'breakdown' => $payload,
            ],
            performedBy: Auth::id()
        );

        return back()->with('success', 'Grade posted successfully.');
    }

    private function buildGradePayload(array $validated, array $fallback = []): array
    {
        if (isset($validated['grade']) && !isset($validated['breakdown'])) {
            $grade = round((float) $validated['grade'], 2);

            return [[
                'written_works' => [],
                'performance_tasks' => [],
                'examinations' => [],
                'weights' => [
                    'written_works' => 30,
                    'performance_tasks' => 50,
                    'examinations' => 20,
                ],
                'averages' => [
                    'written_works' => null,
                    'performance_tasks' => null,
                    'examinations' => null,
                ],
                'final_grade' => $grade,
            ], $grade];
        }

        $breakdown = $validated['breakdown'] ?? $fallback;

        $weights = [
            'written_works' => (float) data_get($breakdown, 'weights.written_works', 30),
            'performance_tasks' => (float) data_get($breakdown, 'weights.performance_tasks', 50),
            'examinations' => (float) data_get($breakdown, 'weights.examinations', 20),
        ];

        $totalWeight = array_sum($weights);
        if ($totalWeight <= 0) {
            $weights = ['written_works' => 30, 'performance_tasks' => 50, 'examinations' => 20];
            $totalWeight = 100;
        }

        $writtenWorks = collect((array) data_get($breakdown, 'written_works', []))
            ->map(fn ($row) => [
                'title' => trim((string) data_get($row, 'title', '')),
                'score' => data_get($row, 'score') !== null ? (float) data_get($row, 'score') : null,
            ])
            ->filter(fn ($row) => $row['title'] !== '' || $row['score'] !== null)
            ->values();

        $performanceTasks = collect((array) data_get($breakdown, 'performance_tasks', []))
            ->map(fn ($row) => [
                'title' => trim((string) data_get($row, 'title', '')),
                'score' => data_get($row, 'score') !== null ? (float) data_get($row, 'score') : null,
            ])
            ->filter(fn ($row) => $row['title'] !== '' || $row['score'] !== null)
            ->values();

        $examinations = collect((array) data_get($breakdown, 'examinations', []))
            ->map(fn ($row) => [
                'title' => trim((string) data_get($row, 'title', '')),
                'score' => data_get($row, 'score') !== null ? (float) data_get($row, 'score') : null,
            ])
            ->filter(fn ($row) => $row['title'] !== '' || $row['score'] !== null)
            ->values();

        $average = static function ($rows): ?float {
            $scores = collect($rows)->pluck('score')->filter(fn ($score) => $score !== null)->values();
            if ($scores->isEmpty()) {
                return null;
            }

            return round((float) $scores->avg(), 2);
        };

        $wwAvg = $average($writtenWorks);
        $ptAvg = $average($performanceTasks);
        $examAvg = $average($examinations);

        $wwVal = $wwAvg ?? 0;
        $ptVal = $ptAvg ?? 0;
        $examVal = $examAvg ?? 0;

        $finalGrade = round((
            ($wwVal * $weights['written_works']) +
            ($ptVal * $weights['performance_tasks']) +
            ($examVal * $weights['examinations'])
        ) / $totalWeight, 2);

        return [[
            'written_works' => $writtenWorks,
            'performance_tasks' => $performanceTasks,
            'examinations' => $examinations,
            'weights' => $weights,
            'averages' => [
                'written_works' => $wwAvg,
                'performance_tasks' => $ptAvg,
                'examinations' => $examAvg,
            ],
            'final_grade' => $finalGrade,
        ], $finalGrade];
    }
}
