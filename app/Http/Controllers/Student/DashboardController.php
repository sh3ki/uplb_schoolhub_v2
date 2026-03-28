<?php

namespace App\Http\Controllers\Student;

use App\Http\Controllers\Controller;
use App\Models\FeeItem;
use App\Models\FeeItemAssignment;
use App\Models\GrantRecipient;
use App\Models\Student;
use App\Models\StudentFee;
use App\Models\StudentPayment;
use App\Models\TransferRequest;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class DashboardController extends Controller
{
    public function index()
    {
        $user = Auth::user();

        // Guard: student_id must be linked to an actual Student record
        if (!$user->student_id) {
            Auth::logout();
            return redirect()->route('login')
                ->with('error', 'Your account is not linked to a student record. Please contact the registrar.');
        }

        $student = Student::with(['requirements.requirement', 'enrollmentClearance'])
            ->find($user->student_id);

        if (!$student) {
            Auth::logout();
            return redirect()->route('login')
                ->with('error', 'Your student record could not be found. Please contact the registrar.');
        }

        // Calculate requirements stats
        $totalRequirements = $student->requirements->count();
        $completedRequirements = $student->requirements->where('status', 'approved')->count();
        $pendingRequirements = $student->requirements->where('status', 'pending')->count();
        $requirementsPercentage = $totalRequirements > 0 ? round(($completedRequirements / $totalRequirements) * 100) : 0;

        // Get current school year
        $activeSchoolYear = \App\Models\AppSetting::current()?->school_year ?? (date('Y') . '-' . (date('Y') + 1));
        $targetSchoolYear = $student->school_year ?: $activeSchoolYear;

        // Get payment info using same logic as online payments
        $paymentInfo = $this->getPaymentSummary($student, $targetSchoolYear);

        // Transfer-out fee state (super-accounting-managed)
        $latestTransferRequest = TransferRequest::where('student_id', $student->id)
            ->whereNull('deleted_at')
            ->orderByDesc('created_at')
            ->first();

        $transferFee = $latestTransferRequest ? [
            'status' => $latestTransferRequest->status,
            'registrar_status' => $latestTransferRequest->registrar_status,
            'accounting_status' => $latestTransferRequest->accounting_status,
            'amount' => (float) $latestTransferRequest->transfer_fee_amount,
            'paid' => (bool) $latestTransferRequest->transfer_fee_paid,
            'or_number' => $latestTransferRequest->transfer_fee_or_number,
            'registrar_remarks' => $latestTransferRequest->registrar_remarks,
            'accounting_remarks' => $latestTransferRequest->accounting_remarks,
        ] : null;

        // Get previous school year balances
        $previousBalances = $this->getPreviousSchoolYearBalances($student, $targetSchoolYear);

        // Check if student has incomplete requirements
        $incompleteRequirements = $student->requirements
            ->whereIn('status', ['pending', 'submitted', 'rejected', 'overdue'])
            ->values()
            ->map(function ($req) {
                return [
                    'id' => $req->id,
                    'name' => $req->requirement->name,
                    'status' => $req->status,
                ];
            });

        return Inertia::render('student/dashboard', [
            'student' => $student,
            'currentSchoolYear' => $targetSchoolYear,
            'stats' => [
                'totalRequirements' => $totalRequirements,
                'completedRequirements' => $completedRequirements,
                'pendingRequirements' => $pendingRequirements,
                'requirementsPercentage' => $requirementsPercentage,
            ],
            'enrollmentClearance' => $student->enrollmentClearance,
            'paymentInfo' => $paymentInfo,
            'transferFee' => $transferFee,
            'previousBalances' => $previousBalances,
            'incompleteRequirements' => $incompleteRequirements,
        ]);
    }

    /**
     * Get payment summary using same logic as accounting payments process.
     */
    private function getPaymentSummary(Student $student, string $targetSchoolYear): ?array
    {
        $targetSchoolYear = trim((string) $targetSchoolYear);

        $feeRecords = StudentFee::query()
            ->where('student_id', $student->id)
            ->orderByDesc('school_year')
            ->orderByDesc('id')
            ->get();

        $feesBySchoolYear = $feeRecords
            ->map(function (StudentFee $fee) {
                return [
                    'school_year' => trim((string) $fee->school_year),
                    'total_amount' => (float) $fee->total_amount,
                    'grant_discount' => (float) $fee->grant_discount,
                    'total_paid' => (float) $fee->total_paid,
                    'balance' => (float) $fee->balance,
                    'due_date' => $fee->due_date,
                ];
            })
            ->filter(fn (array $fee) => $fee['school_year'] !== '')
            ->groupBy('school_year')
            ->map(fn ($rows) => $rows->first())
            ->values();

        $currentFeeRows = StudentFee::query()
            ->with('payments:id,student_fee_id,amount')
            ->where('student_id', $student->id)
            ->whereRaw('TRIM(school_year) = ?', [$targetSchoolYear])
            ->get();

        $totalFees = (float) $currentFeeRows->sum('total_amount');
        $totalDiscount = (float) $currentFeeRows->sum('grant_discount');
        $totalPaid = (float) $currentFeeRows->flatMap->payments->sum('amount');
        $balance = max(0, $totalFees - $totalDiscount - $totalPaid);
        $currentFee = $currentFeeRows->sortByDesc('id')->first();

        // If registrar is already cleared and student_fees has not been fully computed yet,
        // fall back to assignment-based fee calculation to avoid showing all zeros.
        $registrarCleared = (bool) optional($student->enrollmentClearance)->registrar_clearance;
        if ($registrarCleared && ($totalFees <= 0 && $totalDiscount <= 0 && $totalPaid <= 0 && $balance <= 0)) {
            $totalFees = $this->calculateAssignedFeeTotal($student, $targetSchoolYear);
            $totalDiscount = $this->calculateGrantDiscountForSchoolYear($student, $targetSchoolYear, $totalFees);
            $totalPaid = (float) StudentPayment::query()
                ->where('student_id', $student->id)
                ->whereHas('studentFee', function ($q) use ($targetSchoolYear) {
                    $q->whereRaw('TRIM(school_year) = ?', [trim((string) $targetSchoolYear)]);
                })
                ->sum('amount');
            $balance = max(0, $totalFees - $totalDiscount - $totalPaid);
        }

        $previousBalance = (float) $feesBySchoolYear
            ->filter(fn (array $fee) => trim((string) $fee['school_year']) !== trim((string) $targetSchoolYear))
            ->sum('balance');
        $currentFeesBalance = $balance;

        // Get approved promissory notes
        $approvedPromissoryNotes = \App\Models\PromissoryNote::where('student_id', $student->id)
            ->where('status', 'approved')
            ->get();

        $approvedPromissoryAmount = $approvedPromissoryNotes->sum('amount');
        $effectiveBalance = max(0, $balance - $approvedPromissoryAmount);

        // Check if overdue
        $isOverdue = $balance > 0 && !$approvedPromissoryNotes->count() &&
                     !empty($currentFee['due_date']) && now()->gt($currentFee['due_date']);

        // Only fully paid when there are actual billed/payment amounts and balance is zero.
        $hasChargeableFees = $totalFees > 0 || $totalPaid > 0 || $totalDiscount > 0 || $balance > 0 || $previousBalance > 0;
        $isFullyPaid = $hasChargeableFees
            && !is_null($currentFee)
            && $balance <= 0;

        return [
            'total_fees' => $totalFees,
            'discount_amount' => $totalDiscount,
            'total_paid' => $totalPaid,
            'balance' => $balance,
            'effective_balance' => $effectiveBalance,
            'promissory_amount' => $approvedPromissoryAmount,
            'previous_balance' => $previousBalance,
            'current_fees_balance' => $currentFeesBalance > 0 ? $currentFeesBalance : $balance,
            'is_fully_paid' => $isFullyPaid,
            'is_overdue' => $isOverdue,
            'due_date' => $currentFee['due_date'] ?? null,
            'has_promissory' => $approvedPromissoryNotes->count() > 0,
            'has_chargeable_fees' => $hasChargeableFees,
        ];
    }

    /**
     * Get previous school year balances.
     */
    private function getPreviousSchoolYearBalances(Student $student, string $currentSchoolYear): array
    {
        return StudentFee::where('student_id', $student->id)
            ->where('balance', '>', 0)
            ->orderBy('school_year', 'desc')
            ->get()
            ->filter(function (StudentFee $fee) use ($currentSchoolYear) {
                return trim((string) $fee->school_year) !== trim((string) $currentSchoolYear);
            })
            ->map(function ($fee) {
                return [
                    'id' => $fee->id,
                    'school_year' => $fee->school_year,
                    'total_amount' => (float) $fee->total_amount,
                    'total_paid' => (float) $fee->total_paid,
                    'balance' => (float) $fee->balance,
                ];
            })
            ->toArray();
    }

    private function calculateAssignedFeeTotal(Student $student, string $schoolYear): float
    {
        $assignedFeeItemIds = FeeItemAssignment::query()
            ->where('school_year', $schoolYear)
            ->where('is_active', true)
            ->where(function ($query) use ($student) {
                if ($student->department?->classification) {
                    $query->where('classification', $student->department->classification);
                }
                if ($student->department_id) {
                    $query->where('department_id', $student->department_id);
                }
                if ($student->year_level_id) {
                    $query->where('year_level_id', $student->year_level_id);
                }
            })
            ->pluck('fee_item_id')
            ->toArray();

        $allScopeFeeItemIds = FeeItem::query()
            ->where('school_year', $schoolYear)
            ->where('is_active', true)
            ->where('assignment_scope', 'all')
            ->pluck('id')
            ->toArray();

        $feeItemIds = array_values(array_unique(array_merge($assignedFeeItemIds, $allScopeFeeItemIds)));
        if (empty($feeItemIds)) {
            return 0;
        }

        return (float) FeeItem::query()
            ->whereIn('id', $feeItemIds)
            ->where('is_active', true)
            ->sum('selling_price');
    }

    private function calculateGrantDiscountForSchoolYear(Student $student, string $schoolYear, float $totalFees): float
    {
        if ($totalFees <= 0) {
            return 0;
        }

        $grantRecipients = GrantRecipient::where('student_id', $student->id)
            ->where('school_year', $schoolYear)
            ->where('status', 'active')
            ->with('grant')
            ->get();

        if ($grantRecipients->isEmpty()) {
            return 0;
        }

        $discount = 0.0;
        foreach ($grantRecipients as $recipient) {
            if ($recipient->grant) {
                $discount += (float) $recipient->grant->calculateDiscount($totalFees);
            }
        }

        return $discount;
    }

}

