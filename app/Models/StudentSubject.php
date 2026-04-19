<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StudentSubject extends Model
{
    protected $fillable = [
        'student_id',
        'subject_id',
        'school_year',
        'semester',
        'status',
        'grade',
        'draft_grade',
        'draft_breakdown',
        'grade_breakdown',
        'is_grade_posted',
        'grade_posted_at',
    ];

    protected $casts = [
        'grade'    => 'decimal:2',
        'draft_grade' => 'decimal:2',
        'draft_breakdown' => 'array',
        'grade_breakdown' => 'array',
        'is_grade_posted' => 'boolean',
        'grade_posted_at' => 'datetime',
        'semester' => 'integer',
    ];

    // ── Relationships ─────────────────────────────────────────────────────

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }

    public function subject(): BelongsTo
    {
        return $this->belongsTo(Subject::class);
    }
}
