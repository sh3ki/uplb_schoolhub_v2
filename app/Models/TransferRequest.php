<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TransferRequest extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'student_id',
        'reason',
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
        'accounting_remarks',
        'outstanding_balance',
        'balance_override',
        'balance_override_reason',
        'processed_by',
        'processed_at',
    ];

    protected $casts = [
        'registrar_approved_at' => 'datetime',
        'accounting_approved_at' => 'datetime',
        'processed_at' => 'datetime',
        'outstanding_balance' => 'decimal:2',
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

    public function approveByAccounting(int $userId, ?string $remarks = null, bool $override = false, ?string $overrideReason = null, float $outstandingBalance = 0): void
    {
        $this->update([
            'accounting_status' => 'approved',
            'accounting_approved_by' => $userId,
            'accounting_approved_at' => now(),
            'accounting_remarks' => $remarks,
            'outstanding_balance' => $outstandingBalance,
            'balance_override' => $override,
            'balance_override_reason' => $overrideReason,
            'status' => 'approved',
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

    public function finalizeByRegistrar(): void
    {
        $student = $this->student;
        $student->update([
            'enrollment_status' => 'dropped',
            'is_active' => false,
        ]);
    }
}
