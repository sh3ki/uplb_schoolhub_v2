<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class EnrollmentRequest extends Model
{
    protected $fillable = [
        'student_id',
        'school_year',
        'semester',
        'status',
        'registrar_notes',
        'accounting_notes',
        'registrar_reviewed_by',
        'accounting_reviewed_by',
        'registrar_reviewed_at',
        'accounting_reviewed_at',
        'completed_by',
        'completed_at',
        'total_amount',
    ];

    protected $casts = [
        'registrar_reviewed_at' => 'datetime',
        'accounting_reviewed_at' => 'datetime',
        'completed_at' => 'datetime',
        'total_amount' => 'decimal:2',
    ];

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }

    public function subjects(): BelongsToMany
    {
        return $this->belongsToMany(Subject::class, 'enrollment_request_subjects')
            ->withPivot('selling_price')
            ->withTimestamps();
    }

    public function registrarReviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'registrar_reviewed_by');
    }

    public function accountingReviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'accounting_reviewed_by');
    }

    public function completedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'completed_by');
    }
}
