<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class DropRequest extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'student_id',
        'reason',
        'status',
        'semester',
        'school_year',
        'processed_by',
        'processed_at',
        'registrar_notes',
        'registrar_status',
        'registrar_approved_by',
        'registrar_approved_at',
        'registrar_remarks',
        'accounting_status',
        'accounting_approved_by',
        'accounting_approved_at',
        'accounting_remarks',
        'fee_amount',
        'is_paid',
        'or_number',
    ];

    protected $casts = [
        'processed_at' => 'datetime',
        'registrar_approved_at' => 'datetime',
        'accounting_approved_at' => 'datetime',
        'fee_amount' => 'decimal:2',
        'is_paid' => 'boolean',
    ];

    /**
     * Get the student that owns this drop request.
     */
    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }

    /**
     * Get the user who processed this request.
     */
    public function processedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'processed_by');
    }

    /**
     * Get the user who approved at registrar level.
     */
    public function registrarApprovedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'registrar_approved_by');
    }

    /**
     * Get the user who approved at accounting level.
     */
    public function accountingApprovedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'accounting_approved_by');
    }

    /**
     * Fee items assigned to this drop request.
     */
    public function feeItems(): BelongsToMany
    {
        return $this->belongsToMany(FeeItem::class, 'drop_request_fee_items')
            ->withPivot('amount')
            ->withTimestamps();
    }

    /**
     * Approve by registrar (first stage).
     */
    public function approveByRegistrar(int $userId, ?string $remarks = null): void
    {
        $this->update([
            'registrar_status' => 'approved',
            'registrar_approved_by' => $userId,
            'registrar_approved_at' => now(),
            'registrar_remarks' => $remarks,
            'status' => 'pending', // Still pending accounting approval
        ]);
    }

    /**
     * Reject by registrar (first stage).
     */
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

    /**
     * Approve by accounting (final stage).
     */
    public function approveByAccounting(int $userId, ?string $remarks = null, ?string $orNumber = null): void
    {
        $this->update([
            'accounting_status' => 'approved',
            'accounting_approved_by' => $userId,
            'accounting_approved_at' => now(),
            'accounting_remarks' => $remarks,
            'is_paid' => true,
            'or_number' => $orNumber,
            'status' => 'approved',
            'processed_by' => $userId,
            'processed_at' => now(),
        ]);

        // Update the student's enrollment status and deactivate
        $student = $this->student;
        $student->update([
            'enrollment_status' => 'dropped',
            'is_active' => false,
        ]);
    }

    /**
     * Reject by accounting (final stage).
     */
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

    /**
     * Get the current approval stage.
     */
    public function getApprovalStageAttribute(): string
    {
        if ($this->registrar_status === 'rejected' || $this->accounting_status === 'rejected') {
            return 'rejected';
        }
        if ($this->accounting_status === 'approved') {
            return 'completed';
        }
        if ($this->registrar_status === 'approved') {
            return 'awaiting_accounting';
        }
        return 'awaiting_registrar';
    }

    /**
     * Calculate total fee from assigned fee items.
     */
    public function getTotalFeeAttribute(): float
    {
        return (float) $this->feeItems->sum('pivot.amount');
    }

    /**
     * Scope to get pending requests (awaiting registrar).
     */
    public function scopePending($query)
    {
        return $query->where('registrar_status', 'pending');
    }

    /**
     * Scope to get requests awaiting accounting.
     */
    public function scopeAwaitingAccounting($query)
    {
        return $query->where('registrar_status', 'approved')
            ->where('accounting_status', 'pending');
    }

    /**
     * Scope to get approved requests.
     */
    public function scopeApproved($query)
    {
        return $query->where('status', 'approved');
    }

    /**
     * Scope to get rejected requests.
     */
    public function scopeRejected($query)
    {
        return $query->where('status', 'rejected');
    }
}
