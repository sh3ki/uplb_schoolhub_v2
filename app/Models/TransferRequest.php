<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Schema;

class TransferRequest extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'student_id',
        'reason',
        'new_school_name',
        'new_school_address',
        'receiving_contact_person',
        'receiving_contact_number',
        'months_stayed_enrolled',
        'subjects_completed',
        'incomplete_subjects',
        'has_pending_requirements',
        'pending_requirements_details',
        'requesting_documents',
        'requested_documents',
        'issued_items',
        'student_notes',
        'status',
        'semester',
        'school_year',
        'registrar_status',
        'registrar_approved_by',
        'registrar_approved_at',
        'registrar_remarks',
        'accounting_status',
        'accounting_approved_by',
        'accounting_approved_at',
        'finalized_by',
        'finalized_at',
        'accounting_remarks',
        'outstanding_balance',
        'transfer_fee_amount',
        'transfer_fee_paid',
        'transfer_fee_or_number',
        'balance_override',
        'balance_override_reason',
        'processed_by',
        'processed_at',
    ];

    protected $casts = [
        'registrar_approved_at' => 'datetime',
        'accounting_approved_at' => 'datetime',
        'finalized_at' => 'datetime',
        'processed_at' => 'datetime',
        'months_stayed_enrolled' => 'integer',
        'subjects_completed' => 'boolean',
        'has_pending_requirements' => 'boolean',
        'requesting_documents' => 'boolean',
        'outstanding_balance' => 'decimal:2',
        'transfer_fee_amount' => 'decimal:2',
        'transfer_fee_paid' => 'boolean',
        'balance_override' => 'boolean',
    ];

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }

    public function processedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'processed_by');
    }

    public function registrarApprovedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'registrar_approved_by');
    }

    public function accountingApprovedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'accounting_approved_by');
    }

    public function finalizedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'finalized_by');
    }

    public function onlineTransactions(): HasMany
    {
        return $this->hasMany(OnlineTransaction::class, 'transfer_request_id');
    }

    public function approveByRegistrar(int $userId, ?string $remarks = null): void
    {
        $this->update([
            'registrar_status' => 'approved',
            'registrar_approved_by' => $userId,
            'registrar_approved_at' => now(),
            'registrar_remarks' => $remarks,
            'status' => 'pending',
        ]);
    }

    public function rejectByRegistrar(int $userId, string $remarks): void
    {
        $this->update([
            'registrar_status' => 'rejected',
            'registrar_approved_by' => $userId,
            'registrar_approved_at' => now(),
            'registrar_remarks' => $remarks,
            'status' => 'rejected',
        ]);
    }

    public function approveByAccounting(
        int $userId,
        ?string $remarks = null,
        float $transferFeeAmount = 0,
        bool $transferFeePaid = false,
        ?string $transferFeeOrNumber = null
    ): void
    {
        $this->update([
            'accounting_status' => 'approved',
            'accounting_approved_by' => $userId,
            'accounting_approved_at' => now(),
            'accounting_remarks' => $remarks,
            'outstanding_balance' => 0,
            'transfer_fee_amount' => max(0, $transferFeeAmount),
            'transfer_fee_paid' => $transferFeePaid,
            'transfer_fee_or_number' => $transferFeePaid ? $transferFeeOrNumber : null,
            'balance_override' => false,
            'balance_override_reason' => null,
            'status' => 'approved',
            'processed_by' => $userId,
            'processed_at' => now(),
        ]);
    }

    public function markTransferFeePaid(int $userId, string $orNumber, ?float $transferFeeAmount = null): void
    {
        $this->update([
            'transfer_fee_paid' => true,
            'transfer_fee_or_number' => $orNumber,
            'transfer_fee_amount' => $transferFeeAmount !== null ? max(0, $transferFeeAmount) : $this->transfer_fee_amount,
            'processed_by' => $userId,
            'processed_at' => now(),
        ]);
    }

    public function rejectByAccounting(int $userId, string $remarks): void
    {
        $this->update([
            'accounting_status' => 'rejected',
            'accounting_approved_by' => $userId,
            'accounting_approved_at' => now(),
            'accounting_remarks' => $remarks,
            'status' => 'rejected',
        ]);
    }

    public function finalizeByRegistrar(int $userId): void
    {
        $finalizeUpdate = [];

        if (Schema::hasColumn($this->getTable(), 'finalized_by')) {
            $finalizeUpdate['finalized_by'] = $userId;
        }

        if (Schema::hasColumn($this->getTable(), 'finalized_at')) {
            $finalizeUpdate['finalized_at'] = now();
        }

        if (!empty($finalizeUpdate)) {
            $this->update($finalizeUpdate);
        }

        $student = $this->student;
        $student->update([
            'enrollment_status' => 'dropped',
            'is_active' => false,
        ]);
    }
}
