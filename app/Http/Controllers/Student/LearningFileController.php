<?php

namespace App\Http\Controllers\Student;

use App\Http\Controllers\Controller;
use App\Models\AppSetting;
use App\Models\LearningMaterial;
use App\Models\StudentSubject;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use Inertia\Response;

class LearningFileController extends Controller
{
    public function index(): Response
    {
        $student = Auth::user()?->student;
        if (!$student) {
            abort(403);
        }

        $settings = AppSetting::current();
        $currentSchoolYear = $settings->school_year ?? (date('Y') . '-' . (date('Y') + 1));

        $subjectIds = StudentSubject::query()
            ->where('student_id', $student->id)
            ->where('school_year', $currentSchoolYear)
            ->whereIn('status', ['enrolled', 'completed', 'failed'])
            ->pluck('subject_id');

        // Fallback for legacy records that may not have current SY rows in student_subjects.
        if ($subjectIds->isEmpty()) {
            $subjectIds = $student->subjectsQuery()->pluck('subjects.id');
        }

        $subjectIds = $subjectIds->filter()->unique()->values();

        $files = LearningMaterial::query()
            ->with(['teacher:id,first_name,last_name,middle_name,suffix', 'subject:id,code,name', 'section:id,name'])
            ->where(function ($query) use ($subjectIds, $student) {
                $query->where(function ($subjectScope) use ($subjectIds) {
                    $subjectScope->where('visibility', 'subject')
                        ->whereIn('subject_id', $subjectIds);
                });

                if ($student->section_id) {
                    $query->orWhere(function ($advisoryScope) use ($student) {
                        $advisoryScope->where('visibility', 'advisory')
                            ->where('section_id', $student->section_id);
                    });
                }
            })
            ->latest('sent_at')
            ->latest()
            ->paginate(15)
            ->withQueryString()
            ->through(fn (LearningMaterial $file) => [
                'id' => $file->id,
                'title' => $file->title,
                'description' => $file->description,
                'original_filename' => $file->original_filename,
                'file_url' => $this->resolveFileUrl($file->file_path),
                'teacher_name' => $file->teacher?->full_name ?? 'Teacher',
                'target_label' => $file->visibility === 'subject'
                    ? (($file->subject?->code ?? 'Subject') . ' - ' . ($file->subject?->name ?? 'Unknown'))
                    : ($file->section?->name ?? 'Advisory Class'),
                'sent_at' => $file->sent_at?->format('M d, Y h:i A'),
            ]);

        return Inertia::render('student/files/index', [
            'files' => $files,
        ]);
    }

    private function resolveFileUrl(string $path): string
    {
        $normalizedPath = ltrim($path, '/');

        if (Route::has('storage.show')) {
            return route('storage.show', ['path' => $normalizedPath]);
        }

        return url('storage/' . $normalizedPath);
    }
}
