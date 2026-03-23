<?php

namespace App\Http\Controllers\Accounting;

use App\Http\Controllers\Controller;
use App\Models\Department;
use App\Models\Grant;
use App\Models\GrantRecipient;
use App\Models\Student;
use App\Models\StudentFee;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class GrantController extends Controller
{
    /**
     * Display grant library and recipients.
     */
    public function index(Request $request): Response
    {
        $rolePrefix = $this->resolveRolePrefix($request);
        $tab = $request->input('tab', 'recipients');

        // Get all grants for library tab
        $grants = Grant::withCount(['recipients', 'activeRecipients'])
            ->orderBy('name')
            ->get()
            ->map(function ($grant) {
                return [
                    'id' => $grant->id,
                    'name' => $grant->name,
                    'code' => $grant->code,
                    'description' => $grant->description,
                    'type' => $grant->type,
                    'value' => $grant->value,
                    'formatted_value' => $grant->formatted_value,
                    'school_year' => $grant->school_year,
                    'is_active' => $grant->is_active,
                    'recipients_count' => $grant->recipients_count,
                    'active_recipients_count' => $grant->active_recipients_count,
                ];
            });

        // Get recipients for recipients tab
        $recipientsQuery = GrantRecipient::with(['student', 'grant', 'assignedBy']);

        if ($search = $request->input('search')) {
            $recipientsQuery->whereHas('student', function ($q) use ($search) {
                $q->where('first_name', 'like', "%{$search}%")
                  ->orWhere('last_name', 'like', "%{$search}%")
                  ->orWhere('lrn', 'like', "%{$search}%");
            });
        }

        if ($grantId = $request->input('grant_id')) {
            $recipientsQuery->where('grant_id', $grantId);
        }

        if ($schoolYear = $request->input('school_year')) {
            $recipientsQuery->where('school_year', $schoolYear);
        }

        if ($status = $request->input('status')) {
            $recipientsQuery->where('status', $status);
        }

        if ($classification = $request->input('classification')) {
            $recipientsQuery->whereHas('student.department', function ($q) use ($classification) {
                $q->where('classification', $classification);
            });
        }

        if ($departmentId = $request->input('department_id')) {
            $recipientsQuery->whereHas('student', function ($q) use ($departmentId) {
                $q->where('department_id', $departmentId);
            });
        }

        if ($yearLevel = $request->input('year_level')) {
            $recipientsQuery->whereHas('student', function ($q) use ($yearLevel) {
                $q->where('year_level', $yearLevel);
            });
        }

        if ($program = $request->input('program')) {
            $recipientsQuery->whereHas('student', function ($q) use ($program) {
                $q->where('program', $program);
            });
        }

        $recipients = $recipientsQuery->latest()->paginate(20)->withQueryString();

        // Get students for assignment dropdown
        $students = Student::orderBy('last_name')->orderBy('first_name')
            ->get()
            ->map(function ($student) {
                return [
                    'id' => $student->id,
                    'first_name' => $student->first_name,
                    'last_name' => $student->last_name,
                    'lrn' => $student->lrn,
                    'full_name' => $student->full_name,
                    'program' => $student->program,
                    'year_level' => $student->year_level,
                    'student_photo_url' => $student->student_photo_url,
                ];
            });

        $schoolYears = GrantRecipient::distinct()->pluck('school_year')->sort()->values();
        $currentSchoolYear = \App\Models\AppSetting::current()?->school_year ?? '';
        $departments = Department::where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'classification']);
        $classifications = Department::where('is_active', true)
            ->distinct()
            ->pluck('classification')
            ->filter()
            ->values();
        $yearLevels = Student::whereNotNull('year_level')
            ->where('year_level', '!=', '')
            ->distinct()
            ->orderBy('year_level')
            ->pluck('year_level')
            ->values();
        $programs = Student::whereNotNull('program')
            ->where('program', '!=', '')
            ->distinct()
            ->orderBy('program')
            ->pluck('program')
            ->values();

        $grantsStats = [
            'total_grants' => Grant::count(),
            'active_grants' => Grant::where('is_active', true)->count(),
            'total_recipients' => GrantRecipient::distinct('student_id')->count('student_id'),
            'active_recipients' => GrantRecipient::where('status', 'active')->distinct('student_id')->count('student_id'),
            'total_discount_amount' => (float) GrantRecipient::sum('discount_amount'),
        ];

        return Inertia::render($this->resolveGrantsView($rolePrefix), [
            'tab' => $tab,
            'rolePrefix' => $rolePrefix,
            'grants' => $grants,
            'recipients' => $recipients,
            'students' => $students,
            'schoolYears' => $schoolYears,
            'currentSchoolYear' => $currentSchoolYear,
            'departments' => $departments,
            'classifications' => $classifications,
            'yearLevels' => $yearLevels,
            'programs' => $programs,
            'grantsStats' => $grantsStats,
            'filters' => $request->only(['search', 'grant_id', 'school_year', 'status', 'classification', 'department_id', 'year_level', 'program']),
        ]);
    }

    private function resolveRolePrefix(Request $request): string
    {
        $routeName = $request->route()?->getName() ?? '';

        if (str_starts_with($routeName, 'registrar.')) {
            return 'registrar';
        }

        if (str_starts_with($routeName, 'super-accounting.')) {
            return 'super-accounting';
        }

        return 'accounting';
    }

    private function resolveGrantsView(string $rolePrefix): string
    {
        if ($rolePrefix === 'super-accounting') {
            return 'super-accounting/grants/index';
        }

        return 'accounting/grants/index';
    }

    /**
     * Store a new grant.
     */
    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'code' => 'nullable|string|max:50|unique:grants',
            'description' => 'nullable|string',
            'type' => 'required|in:fixed,percentage',
            'value' => 'required|numeric|min:0',
            'school_year' => 'nullable|string',
            'is_active' => 'boolean',
        ]);

        Grant::create($validated);

        return redirect()->back()->with('success', 'Grant created successfully.');
    }

    /**
     * Update a grant.
     */
    public function update(Request $request, Grant $grant): RedirectResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'code' => 'nullable|string|max:50|unique:grants,code,' . $grant->id,
            'description' => 'nullable|string',
            'type' => 'required|in:fixed,percentage',
            'value' => 'required|numeric|min:0',
            'school_year' => 'nullable|string',
            'is_active' => 'boolean',
        ]);

        $grant->update($validated);

        return redirect()->back()->with('success', 'Grant updated successfully.');
    }

    /**
     * Delete a grant.
     */
    public function destroy(Grant $grant): RedirectResponse
    {
        $grant->delete();

        return redirect()->back()->with('success', 'Grant deleted successfully.');
    }

    /**
     * Assign a grant to a student.
     */
    public function assignRecipient(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'student_id' => 'required|exists:students,id',
            'grant_id' => 'required|exists:grants,id',
            'school_year' => 'required|string',
            'notes' => 'nullable|string',
        ]);

        $grant = Grant::findOrFail($validated['grant_id']);

        // Calculate discount amount based on student's fee.
        // Fall back to latest student_fee if none matches the submitted school_year
        // (the form default can differ from the school_year on fee_items).
        $studentFee = StudentFee::where('student_id', $validated['student_id'])
            ->where('school_year', $validated['school_year'])
            ->first()
            ?? StudentFee::where('student_id', $validated['student_id'])
                ->orderBy('school_year', 'desc')
                ->first();

        if ($studentFee) {
            $discountAmount = $grant->calculateDiscount((float) $studentFee->total_amount);
        } else {
            // No fee record yet — for fixed grants use the grant value directly;
            // percentage grants need a total to calculate against, so store 0 for now
            $discountAmount = $grant->type === 'fixed' ? (float) $grant->value : 0;
        }

        // Check if grant already assigned for this student and school year
        $existingRecipient = GrantRecipient::where('student_id', $validated['student_id'])
            ->where('grant_id', $validated['grant_id'])
            ->where('school_year', $validated['school_year'])
            ->first();

        if ($existingRecipient) {
            return redirect()->back()->withErrors([
                'error' => 'This grant is already assigned to the student for the selected school year.'
            ]);
        }

        GrantRecipient::create([
            ...$validated,
            'discount_amount' => $discountAmount,
            'status' => 'active',
            'assigned_by' => auth()->id(),
            'assigned_at' => now(),
        ]);

        // Update student fee grant discount using fresh Grant model values (not stale sum)
        if ($studentFee) {
            $allActive = GrantRecipient::where('student_id', $studentFee->student_id)
                ->where('status', 'active')
                ->with('grant')
                ->get();
            $totalDiscount = 0.0;
            foreach ($allActive as $r) {
                if ($r->grant) {
                    $totalDiscount += $r->grant->calculateDiscount((float) $studentFee->total_amount);
                }
            }
            $studentFee->applyGrantDiscount($totalDiscount);
        }

        return redirect()->back()->with('success', 'Grant assigned successfully.');
    }

    /**
     * Update a recipient's status.
     */
    public function updateRecipient(Request $request, GrantRecipient $recipient): RedirectResponse
    {
        $validated = $request->validate([
            'status' => 'required|in:active,inactive,graduated,withdrawn',
            'notes' => 'nullable|string',
        ]);

        $recipient->update($validated);

        return redirect()->back()->with('success', 'Recipient updated successfully.');
    }

    /**
     * Remove a recipient.
     */
    public function removeRecipient(GrantRecipient $recipient): RedirectResponse
    {
        $studentId = $recipient->student_id;
        $schoolYear = $recipient->school_year;
        
        $recipient->delete();

        // Recalculate student fee grant discount using fresh Grant model values (not stale sum)
        $studentFee = StudentFee::where('student_id', $studentId)
            ->where('school_year', $schoolYear)
            ->first()
            ?? StudentFee::where('student_id', $studentId)
                ->orderBy('school_year', 'desc')
                ->first();

        if ($studentFee) {
            $allActive = GrantRecipient::where('student_id', $studentFee->student_id)
                ->where('status', 'active')
                ->with('grant')
                ->get();
            $totalDiscount = 0.0;
            foreach ($allActive as $r) {
                if ($r->grant) {
                    $totalDiscount += $r->grant->calculateDiscount((float) $studentFee->total_amount);
                }
            }
            $studentFee->applyGrantDiscount($totalDiscount);
        }

        return redirect()->back()->with('success', 'Recipient removed successfully.');
    }
}
