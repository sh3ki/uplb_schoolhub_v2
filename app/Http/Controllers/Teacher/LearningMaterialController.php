<?php

namespace App\Http\Controllers\Teacher;

use App\Http\Controllers\Controller;
use App\Models\AppSetting;
use App\Models\LearningMaterial;
use App\Models\Section;
use App\Models\Student;
use App\Models\StudentActionLog;
use App\Models\StudentSubject;
use App\Models\Subject;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

class LearningMaterialController extends Controller
{
    public function materials(Request $request): Response
    {
        $teacher = Auth::user()?->teacher;
        abort_if(!$teacher, 403);

        $materials = LearningMaterial::query()
            ->where('teacher_id', $teacher->id)
            ->where('visibility', 'private')
            ->latest()
            ->paginate(12)
            ->withQueryString()
            ->through(fn (LearningMaterial $material) => [
                'id' => $material->id,
                'title' => $material->title,
                'description' => $material->description,
                'original_filename' => $material->original_filename,
                'file_url' => route('storage.show', ['path' => $material->file_path]),
                'file_size_label' => $this->humanFileSize($material->file_size),
                'created_at' => $material->created_at?->format('M d, Y h:i A'),
            ]);

        return Inertia::render('teacher/materials/index', [
            'materials' => $materials,
        ]);
    }

    public function files(Request $request): Response
    {
        $teacher = Auth::user()?->teacher;
        abort_if(!$teacher, 403);

        $sentFiles = LearningMaterial::query()
            ->with(['subject:id,code,name', 'section:id,name'])
            ->where('teacher_id', $teacher->id)
            ->where('visibility', '!=', 'private')
            ->latest('sent_at')
            ->latest()
            ->paginate(12)
            ->withQueryString()
            ->through(fn (LearningMaterial $file) => [
                'id' => $file->id,
                'title' => $file->title,
                'description' => $file->description,
                'original_filename' => $file->original_filename,
                'file_url' => route('storage.show', ['path' => $file->file_path]),
                'target_type' => $file->visibility,
                'target_label' => $file->visibility === 'subject'
                    ? (($file->subject?->code ?? 'Subject') . ' - ' . ($file->subject?->name ?? 'Unknown'))
                    : ($file->section?->name ?? 'Advisory Class'),
                'file_size_label' => $this->humanFileSize($file->file_size),
                'sent_at' => $file->sent_at?->format('M d, Y h:i A'),
            ]);

        $draftMaterials = LearningMaterial::query()
            ->where('teacher_id', $teacher->id)
            ->where('visibility', 'private')
            ->latest()
            ->limit(100)
            ->get(['id', 'title', 'original_filename'])
            ->map(fn (LearningMaterial $material) => [
                'id' => $material->id,
                'title' => $material->title,
                'original_filename' => $material->original_filename,
            ])
            ->values();

        return Inertia::render('teacher/files/index', [
            'sentFiles' => $sentFiles,
            'draftMaterials' => $draftMaterials,
            'subjects' => $this->teacherSubjects($teacher->id),
            'advisorySections' => $this->teacherAdvisorySections($teacher->id),
        ]);
    }

    public function storeMaterial(Request $request): RedirectResponse
    {
        $teacher = Auth::user()?->teacher;
        abort_if(!$teacher, 403);

        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'description' => 'nullable|string|max:2000',
            'attachment' => 'required|file|max:10240',
        ]);

        $file = $request->file('attachment');

        LearningMaterial::create([
            'teacher_id' => $teacher->id,
            'title' => $validated['title'],
            'description' => $validated['description'] ?? null,
            'file_path' => $file->store('elms/materials', 'public'),
            'original_filename' => $file->getClientOriginalName(),
            'mime_type' => $file->getMimeType(),
            'file_size' => $file->getSize(),
            'visibility' => 'private',
        ]);

        return back()->with('success', 'Material uploaded successfully.');
    }

    public function storeFile(Request $request): RedirectResponse
    {
        $teacher = Auth::user()?->teacher;
        abort_if(!$teacher, 403);

        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'description' => 'nullable|string|max:2000',
            'attachment' => 'required|file|max:10240',
            'target_type' => 'required|in:subject,advisory',
            'subject_id' => 'nullable|integer|exists:subjects,id',
            'section_id' => 'nullable|integer|exists:sections,id',
        ]);

        [$subjectId, $sectionId] = $this->resolveTargetIds($teacher->id, $validated);

        $file = $request->file('attachment');

        $material = LearningMaterial::create([
            'teacher_id' => $teacher->id,
            'subject_id' => $subjectId,
            'section_id' => $sectionId,
            'title' => $validated['title'],
            'description' => $validated['description'] ?? null,
            'file_path' => $file->store('elms/files', 'public'),
            'original_filename' => $file->getClientOriginalName(),
            'mime_type' => $file->getMimeType(),
            'file_size' => $file->getSize(),
            'visibility' => $validated['target_type'],
            'sent_at' => now(),
        ]);

        $this->logFileDelivery($teacher->id, $material);

        return back()->with('success', 'File uploaded and sent successfully.');
    }

    public function send(Request $request, LearningMaterial $material): RedirectResponse
    {
        $teacher = Auth::user()?->teacher;
        abort_if(!$teacher, 403);

        abort_unless($material->teacher_id === $teacher->id, 403);

        $validated = $request->validate([
            'target_type' => 'required|in:subject,advisory',
            'subject_id' => 'nullable|integer|exists:subjects,id',
            'section_id' => 'nullable|integer|exists:sections,id',
        ]);

        [$subjectId, $sectionId] = $this->resolveTargetIds($teacher->id, $validated);

        $material->update([
            'visibility' => $validated['target_type'],
            'subject_id' => $subjectId,
            'section_id' => $sectionId,
            'sent_at' => now(),
        ]);

        $this->logFileDelivery($teacher->id, $material);

        return back()->with('success', 'Material sent to students.');
    }

    public function destroy(LearningMaterial $material): RedirectResponse
    {
        $teacher = Auth::user()?->teacher;
        abort_if(!$teacher, 403);

        abort_unless($material->teacher_id === $teacher->id, 403);

        Storage::disk('public')->delete($material->file_path);
        $material->delete();

        return back()->with('success', 'File removed successfully.');
    }

    private function teacherSubjects(int $teacherId)
    {
        return Subject::query()
            ->whereHas('teachers', fn ($query) => $query->where('teachers.id', $teacherId))
            ->orderBy('code')
            ->get(['id', 'code', 'name'])
            ->map(fn (Subject $subject) => [
                'id' => $subject->id,
                'label' => "{$subject->code} - {$subject->name}",
            ])
            ->values();
    }

    private function teacherAdvisorySections(int $teacherId)
    {
        return Section::query()
            ->where('teacher_id', $teacherId)
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name'])
            ->map(fn (Section $section) => [
                'id' => $section->id,
                'label' => $section->name,
            ])
            ->values();
    }

    private function resolveTargetIds(int $teacherId, array $validated): array
    {
        $subjectId = null;
        $sectionId = null;

        if ($validated['target_type'] === 'subject') {
            $subjectId = (int) ($validated['subject_id'] ?? 0);

            $isAllowed = Subject::query()
                ->where('id', $subjectId)
                ->whereHas('teachers', fn ($query) => $query->where('teachers.id', $teacherId))
                ->exists();

            abort_unless($isAllowed, 403, 'You can only send files to your assigned subjects.');
        }

        if ($validated['target_type'] === 'advisory') {
            $sectionId = (int) ($validated['section_id'] ?? 0);

            $isAllowed = Section::query()
                ->where('id', $sectionId)
                ->where('teacher_id', $teacherId)
                ->exists();

            abort_unless($isAllowed, 403, 'You can only send files to your advisory classes.');
        }

        return [$subjectId, $sectionId];
    }

    private function logFileDelivery(int $teacherId, LearningMaterial $material): void
    {
        $settings = AppSetting::current();
        $currentSchoolYear = $settings->school_year ?? (date('Y') . '-' . (date('Y') + 1));

        $studentIds = collect();

        if ($material->visibility === 'subject' && $material->subject_id) {
            $studentIds = StudentSubject::query()
                ->where('subject_id', $material->subject_id)
                ->where('school_year', $currentSchoolYear)
                ->whereHas('student', fn ($query) => $query->where('enrollment_status', 'enrolled'))
                ->pluck('student_id')
                ->unique();
        }

        if ($material->visibility === 'advisory' && $material->section_id) {
            $studentIds = Student::query()
                ->where('section_id', $material->section_id)
                ->where('enrollment_status', 'enrolled')
                ->pluck('id');
        }

        foreach ($studentIds as $studentId) {
            StudentActionLog::log(
                studentId: (int) $studentId,
                action: 'file_sent',
                actionType: 'elms_file',
                details: 'A class file was shared by your teacher.',
                changes: [
                    'title' => $material->title,
                    'visibility' => $material->visibility,
                    'teacher_id' => $teacherId,
                ],
                performedBy: Auth::id()
            );
        }
    }

    private function humanFileSize(?int $bytes): string
    {
        if (!$bytes) {
            return 'N/A';
        }

        $units = ['B', 'KB', 'MB', 'GB'];
        $size = (float) $bytes;
        $index = 0;

        while ($size >= 1024 && $index < count($units) - 1) {
            $size /= 1024;
            $index++;
        }

        return round($size, 2) . ' ' . $units[$index];
    }
}
