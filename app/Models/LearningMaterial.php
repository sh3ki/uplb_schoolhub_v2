<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LearningMaterial extends Model
{
    protected $fillable = [
        'teacher_id',
        'subject_id',
        'section_id',
        'title',
        'description',
        'file_path',
        'original_filename',
        'mime_type',
        'file_size',
        'visibility',
        'sent_at',
    ];

    protected $casts = [
        'file_size' => 'integer',
        'sent_at' => 'datetime',
    ];

    public function teacher(): BelongsTo
    {
        return $this->belongsTo(Teacher::class);
    }

    public function subject(): BelongsTo
    {
        return $this->belongsTo(Subject::class);
    }

    public function section(): BelongsTo
    {
        return $this->belongsTo(Section::class);
    }
}
