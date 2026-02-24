<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

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
    ];

    protected $casts = [
        'processed_at' => 'datetime',
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
     * Scope to get pending requests.
     */
    public function scopePending($query)
    {
        return $query->where('status', 'pending');
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
