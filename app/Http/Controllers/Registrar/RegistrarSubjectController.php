<?php

namespace App\Http\Controllers\Registrar;

use App\Http\Controllers\Controller;
use App\Models\Subject;
use App\Models\Department;
use App\Models\Program;
use App\Models\YearLevel;
use App\Models\Section;
use App\Models\Teacher;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Inertia\Inertia;

class RegistrarSubjectController extends Controller
{
    public function index(Request $request)
    {
        $query = Subject::with(['department', 'yearLevel', 'teachers:id,first_name,last_name']);

        // Search filter
        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where(function ($q) use ($search) {
                $q->where('code', 'like', "%{$search}%")
                    ->orWhere('name', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%");
            });
        }

        // Classification filter
        if ($request->filled('classification') && $request->input('classification') !== 'all') {
            $query->where('classification', $request->input('classification'));
        }

        // Department filter
        if ($request->filled('department_id') && $request->input('department_id') !== 'all') {
            $query->where('department_id', $request->input('department_id'));
        }

        // Type filter
        if ($request->filled('type') && $request->input('type') !== 'all') {
            $query->where('type', $request->input('type'));
        }

        // Status filter
        if ($request->filled('status') && $request->input('status') !== 'all') {
            $isActive = $request->input('status') === 'active';
            $query->where('is_active', $isActive);
        }

        $subjects = $query->latest()->paginate(15)->withQueryString();

        $departments = Department::where('is_active', true)
            ->select('id', 'name', 'classification')
            ->get();

        $programs = Program::where('is_active', true)
            ->select('id', 'name', 'department_id')
            ->orderBy('name')
            ->get();

        $yearLevels = YearLevel::where('is_active', true)
            ->with('department:id,name')
            ->select('id', 'name', 'level_number', 'department_id', 'program_id')
            ->orderBy('department_id')
            ->orderBy('level_number')
            ->get();

        $sections = Section::query()
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'teacher_id']);

        // Show only teachers that have actual login accounts with role=teacher.
        $teachers = User::query()
            ->where('role', User::ROLE_TEACHER)
            ->whereNotNull('teacher_id')
            ->with(['teacher.department:id,name'])
            ->orderBy('name')
            ->get()
            ->map(fn (User $user) => [
                'id' => $user->teacher?->id,
                'full_name' => $user->name,
                'department' => $user->teacher?->department?->name,
                'specialization' => $user->teacher?->specialization,
            ]);

        return Inertia::render('registrar/subjects/index', [
            'subjects' => $subjects,
            'departments' => $departments,
            'programs' => $programs,
            'yearLevels' => $yearLevels,
            'sections' => $sections,
            'teachers' => $teachers,
            'filters' => $request->only(['search', 'classification', 'department_id', 'type', 'status']),
        ]);
    }

    public function storeTeacher(Request $request)
    {
        $validated = $request->validate([
            'first_name' => 'required|string|max:120',
            'middle_name' => 'nullable|string|max:120',
            'last_name' => 'required|string|max:120',
            'email' => 'required|email|max:255|unique:teachers,email|unique:users,email',
            'phone' => 'nullable|string|max:30',
            'address' => 'nullable|string|max:500',
            'gender' => 'nullable|in:male,female,other',
            'department_id' => 'required|exists:departments,id',
            'specialization' => 'nullable|string|max:255',
            'employment_status' => 'required|in:full-time,part-time,contractual',
            'is_active' => 'required|boolean',
            'employee_id' => 'nullable|string|max:50|unique:teachers,employee_id',
            'section_id' => 'nullable|integer|exists:sections,id',
            'subject_ids' => 'nullable|array',
            'subject_ids.*' => 'integer|exists:subjects,id',
        ]);

        if (!empty($validated['section_id'])) {
            $sectionHasAdviser = Section::query()
                ->where('id', (int) $validated['section_id'])
                ->whereNotNull('teacher_id')
                ->exists();

            if ($sectionHasAdviser) {
                return back()->withErrors([
                    'section_id' => 'The selected section already has an assigned adviser.',
                ]);
            }
        }

        $employeeId = $validated['employee_id'] ?? $this->generateTeacherEmployeeId();

        DB::transaction(function () use ($validated, $employeeId): void {
            $teacher = Teacher::create([
                'employee_id' => $employeeId,
                'first_name' => $validated['first_name'],
                'middle_name' => $validated['middle_name'] ?? null,
                'last_name' => $validated['last_name'],
                'email' => $validated['email'],
                'phone' => $validated['phone'] ?? null,
                'gender' => $validated['gender'] ?? null,
                'address' => $validated['address'] ?? null,
                'department_id' => (int) $validated['department_id'],
                'specialization' => $validated['specialization'] ?? null,
                'employment_status' => $validated['employment_status'],
                'hire_date' => now(),
                'is_active' => (bool) $validated['is_active'],
            ]);

            $fullName = trim(implode(' ', array_filter([
                $validated['first_name'],
                $validated['middle_name'] ?? null,
                $validated['last_name'],
            ])));

            User::create([
                'name' => $fullName,
                'email' => $validated['email'],
                'username' => $this->generateUniqueUsername($validated['email']),
                'password' => Hash::make('password'),
                'role' => User::ROLE_TEACHER,
                'teacher_id' => $teacher->id,
                'phone' => $validated['phone'] ?? null,
                'email_verified_at' => now(),
            ]);

            if (!empty($validated['subject_ids'])) {
                $teacher->subjects()->sync($validated['subject_ids']);
            }

            if (!empty($validated['section_id'])) {
                Section::query()
                    ->where('id', (int) $validated['section_id'])
                    ->update(['teacher_id' => $teacher->id]);
            }
        });

        return back()->with('success', 'Teacher account created and assigned successfully.');
    }

    public function assignTeachers(Request $request, Subject $subject)
    {
        $request->validate([
            'teacher_ids' => 'nullable|array',
            'teacher_ids.*' => 'exists:teachers,id',
        ]);

        $subject->teachers()->sync($request->input('teacher_ids', []));

        return redirect()->back()->with('success', 'Teachers assigned successfully.');
    }

    public function store(Request $request)
    {
        $isCollege = $request->input('classification') === 'College';

        $validated = $request->validate([
            'department_id' => 'required|exists:departments,id',
            'code' => 'required|string|max:50|unique:subjects,code',
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'classification' => 'required|in:K-12,College',
            'units' => 'nullable|numeric|min:0|max:10',
            'hours_per_week' => 'nullable|integer|min:1|max:40',
            'type' => 'required|in:core,major,elective,general',
            'year_level_id' => 'nullable|exists:year_levels,id',
            'semester' => 'nullable|in:1,2,summer',
            'cost_price' => $isCollege ? 'nullable|numeric|min:0' : 'prohibited',
            'selling_price' => $isCollege ? 'nullable|numeric|min:0' : 'prohibited',
            'is_active' => 'boolean',
            'prerequisites' => 'nullable|array',
            'prerequisites.*' => 'exists:subjects,id',
        ]);

        // Convert empty year_level_id to null
        if (empty($validated['year_level_id'])) {
            $validated['year_level_id'] = null;
        }

        // Convert empty semester to null
        if (empty($validated['semester'])) {
            $validated['semester'] = null;
        }

        // Non-college subjects have no pricing
        if (!$isCollege) {
            $validated['cost_price'] = null;
            $validated['selling_price'] = null;
        }

        $subject = Subject::create($validated);

        // Attach prerequisites if provided
        if (isset($validated['prerequisites'])) {
            $subject->prerequisites()->attach($validated['prerequisites']);
        }

        return redirect()->back()->with('success', 'Subject created successfully.');
    }

    public function update(Request $request, Subject $subject)
    {
        $isCollege = $request->input('classification') === 'College';

        $validated = $request->validate([
            'department_id' => 'required|exists:departments,id',
            'code' => 'required|string|max:50|unique:subjects,code,' . $subject->id,
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'classification' => 'required|in:K-12,College',
            'units' => 'nullable|numeric|min:0|max:10',
            'hours_per_week' => 'nullable|integer|min:1|max:40',
            'type' => 'required|in:core,major,elective,general',
            'year_level_id' => 'nullable|exists:year_levels,id',
            'semester' => 'nullable|in:1,2,summer',
            'cost_price' => $isCollege ? 'nullable|numeric|min:0' : 'prohibited',
            'selling_price' => $isCollege ? 'nullable|numeric|min:0' : 'prohibited',
            'is_active' => 'boolean',
            'prerequisites' => 'nullable|array',
            'prerequisites.*' => 'exists:subjects,id',
        ]);

        // Convert empty year_level_id to null
        if (empty($validated['year_level_id'])) {
            $validated['year_level_id'] = null;
        }

        // Convert empty semester to null
        if (empty($validated['semester'])) {
            $validated['semester'] = null;
        }

        // Non-college subjects have no pricing
        if (!$isCollege) {
            $validated['cost_price'] = null;
            $validated['selling_price'] = null;
        }

        $subject->update($validated);

        // Sync prerequisites
        if (isset($validated['prerequisites'])) {
            $subject->prerequisites()->sync($validated['prerequisites']);
        } else {
            $subject->prerequisites()->detach();
        }

        return redirect()->back()->with('success', 'Subject updated successfully.');
    }

    public function destroy(Subject $subject)
    {
        $subject->delete();

        return redirect()->back()->with('success', 'Subject deleted successfully.');
    }

    private function generateTeacherEmployeeId(): string
    {
        do {
            $candidate = 'T-' . now()->format('Y') . '-' . str_pad((string) random_int(1, 9999), 4, '0', STR_PAD_LEFT);
        } while (Teacher::query()->where('employee_id', $candidate)->exists());

        return $candidate;
    }

    private function generateUniqueUsername(string $email): string
    {
        $base = Str::slug(Str::before($email, '@'), '.');
        $base = $base !== '' ? $base : 'teacher';
        $candidate = $base;
        $index = 1;

        while (User::query()->where('username', $candidate)->exists()) {
            $index++;
            $candidate = $base . $index;
        }

        return $candidate;
    }
}
