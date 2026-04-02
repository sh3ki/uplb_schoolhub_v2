<?php

namespace App\Http\Controllers\Registrar;

use App\Http\Controllers\Controller;
use App\Models\AppSetting;
use App\Models\Student;
use App\Models\StudentFee;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ExamApprovalController extends Controller
{
    /**
     * Display students eligible for exam (read-only registrar view).
     */
    public function index(Request $request): Response
    {
        $requestedSchoolYear = $request->input('school_year');

        $selectedSchoolYear = $requestedSchoolYear
            ?: AppSetting::current()?->school_year
            ?: now()->format('Y') . '-' . (now()->year + 1);

        StudentFee::syncOverdueByDueDate($selectedSchoolYear);

        $search = $request->input('search');

        // Mirror accounting exam-approval derivation to keep both pages consistent:
        // resolve fee row per student year, compute paid from payments relation,
        // then exclude overdue/unpaid students.
        $appSchoolYear = AppSetting::current()?->school_year
            ?: now()->format('Y') . '-' . (now()->year + 1);

        $studentsQuery = Student::whereNull('deleted_at')
            ->withoutTransferredOut()
            ->withoutDropped()
            ->whereHas('enrollmentClearance', function ($q) {
                $q->where('registrar_clearance', true);
            })
            ->whereNotIn('enrollment_status', ['not-enrolled', 'pending-registrar'])
            ->with([
                'fees' => fn($q) => $q->with('payments')->orderByDesc('school_year'),
                'departmentModel',
            ]);

        if ($search) {
            $studentsQuery->where(function ($q) use ($search) {
                $q->where('first_name', 'like', "%{$search}%")
                  ->orWhere('last_name', 'like', "%{$search}%")
                  ->orWhere('lrn', 'like', "%{$search}%");
            });
        }

        $allExamStudents = $studentsQuery
            ->orderBy('last_name')
            ->orderBy('first_name')
            ->get()
            ->map(function ($student) use ($requestedSchoolYear, $appSchoolYear) {
                $targetSchoolYear = $requestedSchoolYear
                    ?: ($student->school_year ?: $appSchoolYear);

                $fee = $student->fees->firstWhere('school_year', $targetSchoolYear)
                    ?: $student->fees->sortByDesc('school_year', SORT_NATURAL)->first();

                $totalAmount = (float) ($fee?->total_amount ?? 0);
                $totalPaid = (float) ($fee?->total_paid ?? 0);
                $currentBalance = (float) ($fee?->balance ?? 0);
                $previousBalance = (float) $student->fees
                    ->filter(fn ($row) => trim((string) $row->school_year) !== trim((string) ($fee?->school_year ?? $targetSchoolYear)))
                    ->sum('balance');
                $totalBalance = $currentBalance + $previousBalance;
                $isOverdue = (bool) ($fee?->is_overdue ?? false) && $currentBalance > 0;

                $paymentStatus = 'unpaid';
                if ($isOverdue) {
                    $paymentStatus = 'overdue';
                } elseif ($totalAmount > 0 && $currentBalance <= 0) {
                    $paymentStatus = 'paid';
                } elseif ($totalPaid > 0) {
                    $paymentStatus = 'partial';
                }

                return [
                    'id'                => $student->id,
                    'full_name'         => $student->full_name,
                    'first_name'        => $student->first_name,
                    'last_name'         => $student->last_name,
                    'lrn'               => $student->lrn,
                    'gender'            => strtolower($student->gender ?? ''),
                    'classification'    => $student->student_type ?? 'new',
                    'department'        => $student->departmentModel?->name ?? null,
                    'program'           => $student->program,
                    'year_level'        => $student->year_level,
                    'section'           => $student->section,
                    'student_photo_url' => $student->student_photo_url,
                    'total_amount'      => $totalAmount,
                    'total_paid'        => $totalPaid,
                    'balance'           => $currentBalance,
                    'total_balance'     => $totalBalance,
                    'payment_status'    => $paymentStatus,
                    'school_year'       => $fee?->school_year ?? $targetSchoolYear,
                ];
            })
            ->values();

        $fullyPaidMale   = $allExamStudents->where('gender', 'male')->values();
        $fullyPaidFemale = $allExamStudents->where('gender', 'female')->values();

        return Inertia::render('accounting/exam-approval/index', [
            'fullyPaidMale'   => $fullyPaidMale,
            'fullyPaidFemale' => $fullyPaidFemale,
            'filters'         => $request->only(['search']),
        ]);
    }
}
