<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BalanceAdjustment extends Model
{
    protected $fillable = [
        'student_id',
        'student_fee_id',
        'adjusted_by',
        'amount',
        'reason',
        'school_year',
        'notes',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
    ];

    /**
     * Get the student this adjustment belongs to.
     */
    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }

    /**
     * Get the student fee record this adjustment is linked to.
     */
    public function studentFee(): BelongsTo
    {
        return $this->belongsTo(StudentFee::class);
    }

    /**
     * Get the user who made the adjustment.
     */
    public function adjuster(): BelongsTo
    {
        return $this->belongsTo(User::class, 'adjusted_by');
    }