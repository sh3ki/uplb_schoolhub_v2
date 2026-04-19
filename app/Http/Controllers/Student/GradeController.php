<?php

namespace App\Http\Controllers\Student;

use App\Http\Controllers\Controller;
use App\Models\AppSetting;
use App\Models\StudentSubject;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

class GradeController extends Controller
{
    /**
     * Display the student's grades.
     */
    public function index(): Response
    {
        $user = Auth::user();
        $student = $user->student;

        $settings = AppSetting::current();
        $currentSchoolYear = $settings->school_year ?? (date('Y') . '-' . (date('Y') + 1));

        // Get all graded subjects for this student
        $grades = StudentSubject::where('student_id', $student->id)
            ->with(['subject:id,code,name,units,type,semester,year_level_id', 'subject.yearLevel:id,name'])
            ->orderBy('school_year', 'desc')
            ->orderBy('semester')
            ->get()
            ->map(function ($enrollment) {
                return [
                    'id'              => $enrollment->id,
                    'subject_code'    => $enrollment->subject?->code ?? 'N/A',
                    'subject_name'    => $enrollment->subject?->name ?? 'Unknown Subject',
                    'units'           => $enrollment->subject?->units ?? 0,
                    'semester'        => $enrollment->semester,
                    'school_year'     => $enrollment->school_year,
                    'year_level'      => $enrollment->subject?->yearLevel?->name ?? 'N/A',
                    'grade'           => $enrollment->is_grade_posted ? $enrollment->grade : null,
                    'status'          => $enrollment->is_grade_posted ? $enrollment->status : 'active',
                    'is_passed'       => $enrollment->is_grade_posted && $enrollment->status === 'completed',
                ];
            });

        // Group by school year
        $gradesByYear = $grades->groupBy('school_year');

        // Calculate GPA summary per school year
        $summaryByYear = [];
        foreach ($gradesByYear as $year => $yearGrades) {
            $gradedSubjects = $yearGrades->filter(fn ($g) => $g['grade'] !== null && $g['status'] !== 'dropped');
            $totalUnits = $gradedSubjects->sum('units');
            $weightedSum = $gradedSubjects->sum(fn ($g) => $g['grade'] * $g['units']);
            
            $summaryByYear[$year] = [
                'total_subjects'   => $yearGrades->count(),
                'graded_subjects'  => $gradedSubjects->count(),
                'total_units'      => $totalUnits,
                'passed_subjects'  => $yearGrades->where('status', 'completed')->count(),
                'failed_subjects'  => $yearGrades->where('status', 'failed')->count(),
                'gwa'              => $totalUnits > 0 ? round($weightedSum / $totalUnits, 2) : null,
            ];
        }

        // Calculate overall summary
        $allGraded = $grades->filter(fn ($g) => $g['grade'] !== null && $g['status'] !== 'dropped');
        $overallUnits = $allGraded->sum('units');
        $overallWeighted = $allGraded->sum(fn ($g) => $g['grade'] * $g['units']);

        $overallSummary = [
            'total_subjects'  => $grades->count(),
            'total_units'     => $overallUnits,
            'passed_subjects' => $grades->where('status', 'completed')->count(),
            'failed_subjects' => $grades->where('status', 'failed')->count(),
            'cumulative_gwa'  => $overallUnits > 0 ? round($overallWeighted / $overallUnits, 2) : null,
        ];

        return Inertia::render('student/grades/index', [
            'student' => [
                'id'         => $student->id,
                'first_name' => $student->first_name,
                'last_name'  => $student->last_name,
                'lrn'        => $student->lrn,
                'program'    => $student->program,
                'year_level' => $student->year_level,
            ],
            'currentSchoolYear' => $currentSchoolYear,
            'gradesByYear'      => $gradesByYear,
            'summaryByYear'     => $summaryByYear,
            'overallSummary'    => $overallSummary,
        ]);
    }
}
