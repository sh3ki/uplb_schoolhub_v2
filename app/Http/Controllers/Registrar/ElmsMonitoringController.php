<?php

namespace App\Http\Controllers\Registrar;

use App\Http\Controllers\Controller;
use App\Models\AppSetting;
use App\Models\StudentSubject;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ElmsMonitoringController extends Controller
{
    public function grades(Request $request): Response
    {
        $settings = AppSetting::current();
        $currentSchoolYear = $settings->school_year ?? (date('Y') . '-' . (date('Y') + 1));

        $query = StudentSubject::query()
            ->with([
                'student:id,first_name,last_name,middle_name,suffix,lrn,section,program,year_level',
                'subject:id,code,name',
            ])
            ->where('school_year', $currentSchoolYear)
            ->whereNotNull('grade');

        if ($request->filled('search')) {
            $search = trim((string) $request->input('search'));
            $query->whereHas('student', function ($studentQuery) use ($search) {
                $studentQuery->where('first_name', 'like', "%{$search}%")
                    ->orWhere('last_name', 'like', "%{$search}%")
                    ->orWhere('lrn', 'like', "%{$search}%");
            });
        }

        $postedGrades = $query
            ->latest('updated_at')
            ->paginate(20)
            ->withQueryString()
            ->through(fn (StudentSubject $enrollment) => [
                'id' => $enrollment->id,
                'student_name' => trim(($enrollment->student?->last_name ?? '') . ', ' . ($enrollment->student?->first_name ?? '')),
                'student_number' => $enrollment->student?->lrn,
                'section' => $enrollment->student?->section,
                'program' => $enrollment->student?->program,
                'year_level' => $enrollment->student?->year_level,
                'subject_code' => $enrollment->subject?->code,
                'subject_name' => $enrollment->subject?->name,
                'grade' => $enrollment->grade,
                'status' => $enrollment->status,
                'updated_at' => $enrollment->updated_at?->format('M d, Y h:i A'),
            ]);

        return Inertia::render('registrar/elms/grades', [
            'postedGrades' => $postedGrades,
            'filters' => [
                'search' => (string) $request->input('search', ''),
            ],
            'currentSchoolYear' => $currentSchoolYear,
        ]);
    }
}
