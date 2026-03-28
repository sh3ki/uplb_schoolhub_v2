<?php

namespace App\Http\Controllers\Accounting;

use App\Http\Controllers\Controller;
use App\Models\Department;
use App\Models\FeeItem;
use App\Models\GrantRecipient;
use App\Models\EnrollmentClearance;
use App\Models\Student;
use App\Models\StudentFee;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class StudentClearanceController extends Controller
{
    /**
     * Display a listing of students pending accounting clearance.
     */
    public function index(Request $request)
    {
        $baseQuery = Student::with(['enrollmentClearance', 'fees'])
            ->withoutTransferredOut()
            ->withoutDropped()
            ->whereHas('enrollmentClearance', function ($q) {
                $q->where('registrar_clearance', true);
            })
            ->orderBy('last_name')
            ->orderBy('first_name');

        // Search filter
        if ($request->filled('search')) {
            $search = $request->input('search');
            $baseQuery->where(function ($q) use ($search) {
                $q->where('first_name', 'like', "%{$search}%")
                    ->orWhere('last_name', 'like', "%{$search}%")
                    ->orWhere('middle_name', 'like', "%{$search}%")
                    ->orWhere('lrn', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%");
            });
        }

        // Program filter
        if ($request->filled('program') && $request->input('program') !== 'all') {
            $baseQuery->where('program', $request->input('program'));
        }

        // Year level filter
        if ($request->filled('year_level') && $request->input('year_level') !== 'all') {
            $baseQuery->where('year_level', $request->input('year_level'));
        }

        // Department filter
        if ($departmentId = $request->input('department_id')) {
            $baseQuery->where('department_id', $departmentId);
        }

        // Classification filter
        if ($classification = $request->input('classification')) {
            $baseQuery->whereHas('department', function ($q) use ($classification) {
                $q->where('classification', $classification);
            });
        }

        // Filter by clearance status — default to 'pending'
        $status = $request->filled('status') ? $request->status : 'pending';
        $query = clone $baseQuery;

        if ($status !== 'all') {
            if ($status === 'pending') {
                $query->whereHas('enrollmentClearance', function ($q) {
                    $q->where(function ($q2) {
                        $q2->where('accounting_clearance', false)
                           ->orWhereNull('accounting_clearance');
                    });
                });
            } elseif ($status === 'cleared') {
                $query->whereHas('enrollmentClearance', function ($q) {
                    $q->where('accounting_clearance', true);
                });
            }
        }

        $students = $query->paginate(20)->withQueryString();

        // Calculate balances dynamically from fee_items for each student
        $students->getCollection()->transform(function ($student) {
            $schoolYear = $student->school_year ?? date('Y') . '-' . (date('Y') + 1);

            $enrolledUnits = \App\Models\StudentSubject::where('student_id', $student->id)
                ->where('school_year', $schoolYear)
                ->where('status', 'enrolled')
                ->join('subjects', 'subjects.id', '=', 'student_subjects.subject_id')
                ->sum('subjects.units');

            // Dynamic total from applicable fee items (exclude Drop category)
            // Include assignment-based items by assignment.school_year.
            $totalFees = FeeItem::query()
                ->where('is_active', true)
                ->whereDoesntHave('category', function ($q) {
                    $q->where('name', 'like', '%Drop%');
                })
                ->where(function ($query) use ($student, $schoolYear) {
                    $query->where(function ($scope) use ($student, $schoolYear) {
                            $scope->where('school_year', $schoolYear)
                                ->where(function ($inner) use ($student) {
                                    $inner->where(function ($allScope) {
                                            $allScope->where('assignment_scope', 'all')
                                                ->whereDoesntHave('assignments');
                                        })
                                        ->orWhere(function ($specificScope) use ($student) {
                                            $specificScope->where('assignment_scope', 'specific')
                                                ->where(function ($hasDirectFilters) {
                                                    $hasDirectFilters->whereNotNull('classification')
                                                        ->orWhereNotNull('department_id')
                                                        ->orWhereNotNull('program_id')
                                                        ->orWhereNotNull('year_level_id')
                                                        ->orWhereNotNull('section_id');
                                                });
                                            $this->applyStudentFilters($specificScope, $student);
                                        });
                                });
                        })
                        ->orWhere(function ($scope) use ($student, $schoolYear) {
                            $scope->whereHas('assignments', function ($assignmentQuery) use ($student, $schoolYear) {
                                $this->applyAssignmentFilters($assignmentQuery, $student, $schoolYear);
                            });
                        });
                })
                ->get()
                ->sum(function ($item) use ($enrolledUnits) {
                    if ($item->is_per_unit) {
                        return (float) $enrolledUnits > 0
                            ? (float) $item->unit_price * (float) $enrolledUnits
                            : (float) $item->selling_price;
                    }
                    return (float) $item->selling_price;
                });

            // Grant discount
            $grantDiscount = $this->calculateGrantDiscountForFeeYear($student, $schoolYear, (float) $totalFees);

            // Total paid from student_fees
            $studentFee = StudentFee::where('student_id', $student->id)
                ->where('school_year', $schoolYear)
                ->first();
            $totalPaid = $studentFee ? (float) $studentFee->total_paid : 0;

            $balance = max(0, $totalFees - $grantDiscount - $totalPaid);

            $student->total_fees = $totalFees;
            $student->total_paid = $totalPaid;
            $student->balance = $balance;
            $student->is_fully_paid = $balance <= 0;
            
            return $student;
        });

        // Get filter options
        $programs = Student::select('program')
            ->whereNotNull('program')
            ->where('program', '!=', '')
            ->distinct()
            ->pluck('program')
            ->sort()
            ->values();
            
        $yearLevels = Student::select('year_level')
            ->whereNotNull('year_level')
            ->where('year_level', '!=', '')
            ->distinct()
            ->pluck('year_level')
            ->sort()
            ->values();

        // Get stats
        $stats = [
            'total' => (clone $baseQuery)->count(),
            'pending' => (clone $baseQuery)->whereHas('enrollmentClearance', function ($q) {
                $q->where(function ($q2) {
                    $q2->where('accounting_clearance', false)
                        ->orWhereNull('accounting_clearance');
                });
            })->count(),
            'cleared' => (clone $baseQuery)->whereHas('enrollmentClearance', function ($q) {
                $q->where('accounting_clearance', true);
            })->count(),
        ];

        // Get departments and classifications
        $departments = Department::orderBy('name')->get(['id', 'name', 'code', 'classification']);
        $classifications = Department::distinct()->pluck('classification')->filter()->sort()->values();

        return Inertia::render($this->viewPrefix() . '/clearance/index', [
            'students' => $students,
            'programs' => $programs,
            'yearLevels' => $yearLevels,
            'departments' => $departments,
            'classifications' => $classifications,
            'stats' => $stats,
            'filters' => array_merge(
                $request->only(['search', 'program', 'year_level', 'department_id', 'classification']),
                ['status' => $status]
            ),
        ]);
    }

    /**
     * Show clearance details for a specific student.
     */
    public function show(Student $student)
    {
        if ($student->enrollment_status === 'dropped') {
            abort(404);
        }

        $isTransferredOut = $student->transferRequests()
            ->whereNotNull('finalized_at')
            ->exists();

        if ($isTransferredOut) {
            abort(404);
        }

        $student->load(['enrollmentClearance', 'fees.payments', 'requirements.requirement']);

        $schoolYear = $student->school_year ?? date('Y') . '-' . (date('Y') + 1);

        $enrolledUnits = \App\Models\StudentSubject::where('student_id', $student->id)
            ->where('school_year', $schoolYear)
            ->where('status', 'enrolled')
            ->join('subjects', 'subjects.id', '=', 'student_subjects.subject_id')
            ->sum('subjects.units');

        // Dynamic fee calculation (same as index, excluding Drop fees)
        $totalFees = FeeItem::query()
            ->where('is_active', true)
            ->whereDoesntHave('category', function ($q) {
                $q->where('name', 'like', '%Drop%');
            })
            ->where(function ($query) use ($student, $schoolYear) {
                $query->where(function ($scope) use ($student, $schoolYear) {
                        $scope->where('school_year', $schoolYear)
                            ->where(function ($inner) use ($student) {
                                $inner->where(function ($allScope) {
                                        $allScope->where('assignment_scope', 'all')
                                            ->whereDoesntHave('assignments');
                                    })
                                    ->orWhere(function ($specificScope) use ($student) {
                                        $specificScope->where('assignment_scope', 'specific')
                                            ->where(function ($hasDirectFilters) {
                                                $hasDirectFilters->whereNotNull('classification')
                                                    ->orWhereNotNull('department_id')
                                                    ->orWhereNotNull('program_id')
                                                    ->orWhereNotNull('year_level_id')
                                                    ->orWhereNotNull('section_id');
                                            });
                                        $this->applyStudentFilters($specificScope, $student);
                                    });
                            });
                    })
                    ->orWhere(function ($scope) use ($student, $schoolYear) {
                        $scope->whereHas('assignments', function ($assignmentQuery) use ($student, $schoolYear) {
                            $this->applyAssignmentFilters($assignmentQuery, $student, $schoolYear);
                        });
                    });
            })
            ->get()
            ->sum(function ($item) use ($enrolledUnits) {
                if ($item->is_per_unit) {
                    return (float) $enrolledUnits > 0
                        ? (float) $item->unit_price * (float) $enrolledUnits
                        : (float) $item->selling_price;
                }
                return (float) $item->selling_price;
            });

        $grantDiscount = $this->calculateGrantDiscountForFeeYear($student, $schoolYear, (float) $totalFees);

        $studentFee = StudentFee::where('student_id', $student->id)
            ->where('school_year', $schoolYear)
            ->first();
        $totalPaid = $studentFee ? (float) $studentFee->total_paid : 0;
        $balance = max(0, $totalFees - $grantDiscount - $totalPaid);

        return Inertia::render($this->viewPrefix() . '/clearance/show', [
            'student' => $student,
            'totalFees' => $totalFees,
            'totalPaid' => $totalPaid,
            'balance' => $balance,
            'isFullyPaid' => $balance <= 0,
        ]);
    }

    /**
     * Update accounting clearance status for a student.
     */
    public function updateClearance(Request $request, Student $student)
    {
        $validated = $request->validate([
            'status' => 'required|boolean',
            'notes' => 'nullable|string|max:1000',
        ]);

        $status = $validated['status'];
        
        // Get or create enrollment clearance
        $clearance = EnrollmentClearance::firstOrCreate(['user_id' => $student->user->id]);

        // Update clearance
        $clearance->update([
            'accounting_clearance' => $status,
            'accounting_cleared_at' => $status ? now() : null,
            'accounting_cleared_by' => $status ? Auth::id() : null,
            'accounting_notes' => $validated['notes'] ?? null,
        ]);

        // Update enrollment status based on clearance result.
        // Dropped students follow the drop clearance flow — enrollment_status stays 'dropped'.
        if ($student->enrollment_status !== 'dropped') {
            $freshClearance = $clearance->fresh();
            if ($freshClearance->isFullyCleared()) {
                $clearance->update(['enrollment_status' => 'completed']);
                $student->update(['enrollment_status' => 'enrolled']);
            } elseif ($status) {
                // Accounting cleared but not fully enrolled → pending-enrollment
                $clearance->update(['enrollment_status' => 'in_progress']);
                $student->update(['enrollment_status' => 'pending-enrollment']);
            } else {
                // Accounting clearance revoked → back to pending-accounting
                $clearance->update(['enrollment_status' => 'in_progress']);
                $student->update(['enrollment_status' => 'pending-accounting']);
            }
        }

        return back()->with('success', $status 
            ? 'Student cleared by accounting successfully.' 
            : 'Accounting clearance removed.');
    }

    /**
     * Bulk clear students.
     */
    public function bulkClear(Request $request)
    {
        $validated = $request->validate([
            'student_ids' => 'required|array|min:1',
            'student_ids.*' => 'exists:students,id',
            'status' => 'required|boolean',
        ]);

        $count = 0;
        foreach ($validated['student_ids'] as $studentId) {
            $student = Student::find($studentId);
            if ($student) {
                $clearance = EnrollmentClearance::firstOrCreate(['user_id' => $student->user->id]);
                $clearance->update([
                    'accounting_clearance' => $validated['status'],
                    'accounting_cleared_at' => $validated['status'] ? now() : null,
                    'accounting_cleared_by' => $validated['status'] ? Auth::id() : null,
                ]);

                $freshClearance = $clearance->fresh();
                if ($freshClearance->isFullyCleared()) {
                    $clearance->update(['enrollment_status' => 'completed']);
                    $student->update(['enrollment_status' => 'enrolled']);
                } elseif ($validated['status']) {
                    $clearance->update(['enrollment_status' => 'in_progress']);
                    $student->update(['enrollment_status' => 'pending-enrollment']);
                } else {
                    $clearance->update(['enrollment_status' => 'in_progress']);
                    $student->update(['enrollment_status' => 'pending-accounting']);
                }
                
                $count++;
            }
        }

        return back()->with('success', "{$count} students updated successfully.");
    }

    /**
     * Apply student-specific filters to fee item query.
     */
    private function applyStudentFilters($query, Student $student): void
    {
        if ($student->department) {
            $query->where(function ($sq) use ($student) {
                $sq->whereNull('classification')
                    ->orWhere('classification', $student->department->classification);
            });
        }

        $query->where(function ($sq) use ($student) {
            $sq->whereNull('department_id')
                ->orWhere('department_id', $student->department_id);
        });

        // Note: program_id not filtered — Student model has no program_id FK;
        // department_id provides sufficient program-level scoping for College.

        $resolvedYearLevelId = $this->resolveStudentYearLevelId($student);
        $yearLevelCandidates = $this->buildYearLevelCandidates((string) ($student->year_level ?? ''));
        $query->where(function ($sq) use ($student, $resolvedYearLevelId, $yearLevelCandidates) {
            $sq->whereNull('year_level_id');

            if ($resolvedYearLevelId) {
                $sq->orWhere('year_level_id', $resolvedYearLevelId);
            } elseif (!empty($yearLevelCandidates)) {
                foreach ($yearLevelCandidates as $candidate) {
                    $sq->orWhereRaw('LOWER(TRIM(year_level)) = ?', [strtolower($candidate)]);
                }
            }
        });

        $query->where(function ($sq) use ($student) {
            $sq->whereNull('section_id')
                ->orWhere('section_id', $student->section_id);
        });
    }

    /**
     * Apply assignment-specific filters to fee_item_assignments query.
     */
    private function applyAssignmentFilters($query, Student $student, ?string $schoolYear = null): void
    {
        $query->where('is_active', true);

        if ($schoolYear) {
            $query->where('school_year', $schoolYear);
        }

        if (!$student->department_id) {
            $query->whereRaw('1 = 0');
            return;
        }

        if ($student->department) {
            $query->where('classification', $student->department->classification);
        }

        $query->where('department_id', $student->department_id);

        $resolvedYearLevelId = $this->resolveStudentYearLevelId($student);

        if ($resolvedYearLevelId) {
            $query->where(function ($sq) use ($resolvedYearLevelId) {
                $sq->whereNull('year_level_id')
                    ->orWhere('year_level_id', $resolvedYearLevelId);
            });
        } else {
            $query->whereNull('year_level_id');
        }
    }

    /**
     * Resolve student year level id from either FK or year level text.
     */
    private function resolveStudentYearLevelId(Student $student): ?int
    {
        if ($student->year_level_id) {
            return (int) $student->year_level_id;
        }

        $rawYearLevel = trim((string) ($student->year_level ?? ''));
        if ($rawYearLevel === '' || !$student->department_id) {
            return null;
        }

        $candidates = $this->buildYearLevelCandidates($rawYearLevel);
        if (empty($candidates)) {
            return null;
        }

        $normalizedCandidates = array_values(array_unique(array_filter(array_map(
            fn(string $value) => preg_replace('/[^a-z0-9]/', '', strtolower($value)),
            $candidates
        ))));

        $exact = \App\Models\YearLevel::where('department_id', $student->department_id)
            ->where(function ($query) use ($candidates) {
                foreach ($candidates as $candidate) {
                    $query->orWhereRaw('LOWER(TRIM(name)) = ?', [strtolower($candidate)]);
                }
            })
            ->value('id');

        if ($exact) {
            return (int) $exact;
        }

        $yearLevel = \App\Models\YearLevel::where('department_id', $student->department_id)
            ->get(['id', 'name'])
            ->first(function ($level) use ($normalizedCandidates) {
                $candidate = preg_replace('/[^a-z0-9]/', '', strtolower((string) $level->name));
                if ($candidate === '' || empty($normalizedCandidates)) {
                    return false;
                }

                foreach ($normalizedCandidates as $normalizedCandidate) {
                    if ($normalizedCandidate === '') {
                        continue;
                    }

                    if ($candidate === $normalizedCandidate
                        || str_contains($candidate, $normalizedCandidate)
                        || str_contains($normalizedCandidate, $candidate)) {
                        return true;
                    }
                }

                return false;
            });

        return $yearLevel ? (int) $yearLevel->id : null;
    }

    /**
     * Build candidate year-level strings from student data (e.g. "2nd Year - TBA" -> "2nd Year").
     */
    private function buildYearLevelCandidates(string $rawYearLevel): array
    {
        $rawYearLevel = trim($rawYearLevel);
        if ($rawYearLevel === '') {
            return [];
        }

        $primary = trim((string) preg_replace('/\s*-\s*.*/', '', $rawYearLevel));

        return array_values(array_unique(array_filter([
            $rawYearLevel,
            $primary,
        ], fn($value) => trim((string) $value) !== '')));
    }

    /**
     * Calculate grant discount for a fee year, with fallback to active grants on the student's primary year.
     */
    private function calculateGrantDiscountForFeeYear(Student $student, string $schoolYear, float $totalFees): float
    {
        $baseQuery = GrantRecipient::where('student_id', $student->id)
            ->where('status', 'active')
            ->with('grant');

        $recipients = (clone $baseQuery)
            ->where('school_year', $schoolYear)
            ->get();

        if ($recipients->isEmpty()) {
            $primaryYear = $student->school_year
                ?? \App\Models\AppSetting::current()?->school_year
                ?? $schoolYear;

            if ($schoolYear === $primaryYear) {
                $recipients = $baseQuery->get();
            }
        }

        $discount = 0.0;
        foreach ($recipients as $recipient) {
            if ($recipient->grant) {
                $discount += $recipient->grant->calculateDiscount($totalFees);
            }
        }

        return $discount;
    }
}
