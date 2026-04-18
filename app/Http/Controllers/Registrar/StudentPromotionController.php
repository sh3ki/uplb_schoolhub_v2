<?php

namespace App\Http\Controllers\Registrar;

use App\Http\Controllers\Controller;
use App\Models\AppSetting;
use App\Models\Department;
use App\Models\EnrollmentClearance;
use App\Models\Program;
use App\Models\Section;
use App\Models\Student;
use App\Models\StudentRequirement;
use App\Models\User;
use App\Models\YearLevel;
use Illuminate\Http\Request;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class StudentPromotionController extends Controller
{
    /**
     * Show the promote-students page.
     */
    public function index(Request $request): Response
    {
        $activeSchoolYear = AppSetting::current()->school_year ?? (date('Y') . '-' . (date('Y') + 1));

        // ── Filters ────────────────────────────────────────────────────────────
        $search         = $request->input('search', '');
        $departmentId   = $request->input('department_id', '');
        $yearLevelId    = $request->input('year_level_id', '');
        $program        = $request->input('program', '');
        $currentSection = $request->input('section_id', '');
        $enrollStatus   = $request->input('enrollment_status', '');
        $schoolYearFilter = $request->input('school_year', 'all');

        // ── Students query — ALL students including archived/inactive ──────────
        $query = Student::withTrashed()
            ->with(['sectionModel.yearLevel', 'sectionModel.program'])
            ->where('enrollment_status', '!=', 'dropped');

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('first_name', 'like', "%{$search}%")
                  ->orWhere('last_name', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%")
                  ->orWhere('lrn', 'like', "%{$search}%");
            });
        }

        if ($departmentId) {
            $query->where('department_id', $departmentId);
        }

        if ($yearLevelId) {
            $query->where('year_level_id', $yearLevelId);
        }

        if ($program) {
            $query->where('program', $program);
        }

        if ($currentSection === '__none__') {
            $query->whereNull('section_id');
        } elseif ($currentSection) {
            $query->where('section_id', $currentSection);
        }

        if ($enrollStatus) {
            $query->where('enrollment_status', $enrollStatus);
        }

        if ($schoolYearFilter && $schoolYearFilter !== 'all') {
            $query->where('school_year', $schoolYearFilter);
        }

        $students = $query->orderBy('last_name')->orderBy('first_name')->paginate(80)->withQueryString();

        // ── Available school years for the tab filter ──────────────────────────
        $schoolYears = Student::withTrashed()
            ->whereNotNull('school_year')
            ->distinct()
            ->orderBy('school_year', 'desc')
            ->pluck('school_year')
            ->values();

        // ── Reference data ─────────────────────────────────────────────────────
        $departments = Department::orderBy('name')->get(['id', 'name', 'classification']);

        $yearLevels = YearLevel::with('department')
            ->orderBy('level_number')
            ->get()
            ->map(fn ($yl) => [
                'id'            => $yl->id,
                'name'          => $yl->name,
                'department_id' => $yl->department_id,
                'level_number'  => $yl->level_number,
                'department'    => ['id' => $yl->department->id, 'name' => $yl->department->name],
            ]);

        $programs = Program::with('department')
            ->orderBy('name')
            ->get()
            ->map(fn ($p) => [
                'id'            => $p->id,
                'name'          => $p->name,
                'department_id' => $p->department_id,
            ]);

        $sections = Section::with(['yearLevel', 'program', 'department'])
            ->where('is_active', true)
            ->orderBy('name')
            ->get()
            ->map(fn ($s) => [
                'id'            => $s->id,
                'name'          => $s->name,
                'year_level_id' => $s->year_level_id,
                'year_level'    => $s->yearLevel ? ['id' => $s->yearLevel->id, 'name' => $s->yearLevel->name] : null,
                'program_id'    => $s->program_id,
                'program'       => $s->program  ? ['id' => $s->program->id,  'name' => $s->program->name]  : null,
                'department_id' => $s->department_id,
                'department'    => $s->department ? ['id' => $s->department->id, 'name' => $s->department->name] : null,
                'capacity'      => $s->capacity,
            ]);

        return Inertia::render('registrar/students/promote', [
            'students'         => $students->through(fn ($s) => [
                'id'                => $s->id,
                'first_name'        => $s->first_name,
                'last_name'         => $s->last_name,
                'middle_name'       => $s->middle_name,
                'suffix'            => $s->suffix,
                'lrn'               => $s->lrn,
                'email'             => $s->email,
                'program'           => $s->program,
                'year_level'        => $s->year_level,
                'year_level_id'     => $s->year_level_id,
                'section'           => $s->section,
                'section_id'        => $s->section_id,
                'department_id'     => $s->department_id,
                'enrollment_status' => $s->enrollment_status,
                'school_year'       => $s->school_year,
                'student_photo_url' => $s->student_photo_url,
                'is_archived'       => $s->deleted_at !== null,
                'is_inactive'       => !$s->is_active && $s->deleted_at === null,
            ]),
            'departments'      => $departments,
            'yearLevels'       => $yearLevels,
            'programs'         => $programs,
            'sections'         => $sections,
            'schoolYears'      => $schoolYears,
            'activeSchoolYear' => $activeSchoolYear,
            'filters'          => [
                'search'            => $search,
                'department_id'     => $departmentId,
                'year_level_id'     => $yearLevelId,
                'program'           => $program,
                'section_id'        => $currentSection,
                'enrollment_status' => $enrollStatus,
                'school_year'       => $schoolYearFilter,
            ],
        ]);
    }

    /**
     * Process the bulk promotion.
     *
     * Expects:
     *  promotions: [
     *    { student_id: 1, section_id: 5 | 'TBA', year_level_id: 3 }   // year_level_id required if TBA
     *  ]
     */
    public function promote(Request $request): RedirectResponse
    {
        $activeSchoolYear = AppSetting::current()->school_year ?? (date('Y') . '-' . (date('Y') + 1));

        $validated = $request->validate([
            'student_ids'         => 'required|array|min:1',
            'student_ids.*'       => 'integer|exists:students,id',
            'target_section_id'   => 'nullable|string',   // section id OR 'TBA'
            'target_year_level_id'=> 'nullable|integer|exists:year_levels,id', // required when TBA
            'target_department_id'=> 'nullable|integer|exists:departments,id',
            'target_program'      => 'nullable|string|max:255',
        ]);

        $studentIds       = $validated['student_ids'];
        $targetSectionId  = $validated['target_section_id'] ?? null;
        $targetYearLevelId= $validated['target_year_level_id'] ?? null;
        $targetDepartmentId = $validated['target_department_id'] ?? null;
        $targetProgram = $validated['target_program'] ?? null;

        $droppedSelectedCount = Student::withTrashed()
            ->whereIn('id', $studentIds)
            ->where('enrollment_status', 'dropped')
            ->count();

        if ($droppedSelectedCount > 0) {
            return back()->withErrors([
                'student_ids' => 'Dropped students cannot be promoted. Please deselect dropped records.',
            ]);
        }

        if (!$targetSectionId) {
            return back()->withErrors(['target_section_id' => 'A target section or TBA is required.']);
        }

        // ── Build update payload ────────────────────────────────────────────────
        if ($targetSectionId === 'TBA') {
            if (!$targetYearLevelId) {
                return back()->withErrors(['target_year_level_id' => 'Year level is required when assigning TBA.']);
            }

            $yearLevel = YearLevel::findOrFail($targetYearLevelId);

            $updateData = [
                'section_id'    => null,
                'section'       => 'TBA',
                'year_level_id' => $yearLevel->id,
                'year_level'    => $yearLevel->name,
                'school_year'   => $activeSchoolYear,
            ];

            if ($targetDepartmentId) {
                $updateData['department_id'] = (int) $targetDepartmentId;
            }

            if ($targetProgram !== null && $targetProgram !== '') {
                $updateData['program'] = $targetProgram;
            }
        } else {
            $section = Section::with(['yearLevel', 'program'])->findOrFail((int) $targetSectionId);

            $updateData = [
                'section_id'    => $section->id,
                'section'       => $section->name,
                'year_level_id' => $section->year_level_id,
                'year_level'    => $section->yearLevel?->name ?? '',
                'department_id' => $section->department_id,
                'school_year'   => $activeSchoolYear,
            ];

            // Update program if section has one
            if ($section->program_id && $section->program) {
                $updateData['program'] = $section->program->name;
            }
        }

        Student::whereIn('id', $studentIds)
            ->where('enrollment_status', '!=', 'dropped')
            ->update(array_merge($updateData, [
            'enrollment_status' => 'not-enrolled',
        ]));

        // Reset student requirements back to initial state for the new promotion cycle.
        StudentRequirement::whereIn('student_id', $studentIds)->update([
            'status' => 'pending',
            'submitted_at' => null,
            'approved_at' => null,
            'approved_by' => null,
            'notes' => null,
            'file_path' => null,
        ]);

        // Reset enrollment clearance checkpoints for promoted students.
        $userIds = User::whereIn('student_id', $studentIds)->pluck('id');
        if ($userIds->isNotEmpty()) {
            EnrollmentClearance::whereIn('user_id', $userIds)->update([
                'requirements_complete_percentage' => 0,
                'requirements_complete' => false,
                'requirements_completed_at' => null,
                'requirements_completed_by' => null,
                'registrar_clearance' => false,
                'registrar_cleared_at' => null,
                'registrar_cleared_by' => null,
                'registrar_notes' => null,
                'accounting_clearance' => false,
                'accounting_cleared_at' => null,
                'accounting_cleared_by' => null,
                'accounting_notes' => null,
                'official_enrollment' => false,
                'officially_enrolled_at' => null,
                'officially_enrolled_by' => null,
                'enrollment_status' => 'pending',
            ]);
        }

        $count = count($studentIds);
        $destination = $targetSectionId === 'TBA'
            ? "TBA ({$updateData['year_level']})"
            : $updateData['section'];

        return redirect()->route('registrar.promote-students.index')
            ->with('success', "{$count} student(s) successfully promoted to {$destination} for school year {$activeSchoolYear}.");
    }

    /**
     * Mark selected students as graduated and archive them.
     */
    public function graduate(Request $request): RedirectResponse
    {
        $activeSchoolYear = AppSetting::current()->school_year ?? (date('Y') . '-' . (date('Y') + 1));

        $validated = $request->validate([
            'student_ids'   => 'required|array|min:1',
            'student_ids.*' => 'integer|exists:students,id',
        ]);

        $studentIds = $validated['student_ids'];

        // Ensure all selected students are active rows before archiving as graduates.
        Student::withTrashed()->whereIn('id', $studentIds)->restore();

        Student::whereIn('id', $studentIds)->update([
            'enrollment_status' => 'graduated',
            'is_active'         => false,
            'school_year'       => $activeSchoolYear,
        ]);

        Student::whereIn('id', $studentIds)->delete();

        $count = count($studentIds);

        return redirect()->route('registrar.promote-students.index')
            ->with('success', "{$count} student(s) marked as graduated and archived.");
    }
}
