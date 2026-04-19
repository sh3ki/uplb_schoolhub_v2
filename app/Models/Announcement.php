<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class Announcement extends Model
{
    use HasFactory, SoftDeletes;

    /**
     * All available target roles for announcements.
     */
    public const AVAILABLE_ROLES = [
        'registrar',
        'accounting',
        'super-accounting',
        'student',
        'teacher',
        'parent',
        'guidance',
        'librarian',
        'clinic',
        'canteen',
    ];

    protected $fillable = [
        'title',
        'content',
        'priority',
        'target_audience',
        'target_roles',
        'department_id',
        'classification',
        'program_id',
        'year_level_id',
        'section_id',
        'program',
        'grade_level',
        'created_by',
        'published_at',
        'expires_at',
        'is_pinned',
        'is_active',
        'attachment_path',
        'attachment_name',
        'attachment_type',
        'image_path',
        'image_name',
        'image_type',
    ];

    protected $casts = [
        'published_at' => 'datetime',
        'expires_at' => 'datetime',
        'is_pinned' => 'boolean',
        'is_active' => 'boolean',
        'target_roles' => 'array',
    ];

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function programModel(): BelongsTo
    {
        return $this->belongsTo(Program::class, 'program_id');
    }

    public function yearLevel(): BelongsTo
    {
        return $this->belongsTo(YearLevel::class);
    }

    public function section(): BelongsTo
    {
        return $this->belongsTo(Section::class);
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true)
            ->where(function ($q) {
                $q->whereNull('expires_at')
                    ->orWhere('expires_at', '>', now());
            });
    }

    public function scopePublished($query)
    {
        return $query->whereNotNull('published_at')
            ->where('published_at', '<=', now());
    }

    public function scopeForAudience($query, string $audience)
    {
        return $query->where(function ($q) use ($audience) {
            $q->where('target_audience', 'all')
                ->orWhere('target_audience', $audience);
        });
    }

    /**
     * Scope to filter announcements by role using target_roles JSON field.
     */
    public function scopeForRole($query, string $role)
    {
        return $query->where(function ($q) use ($role) {
            $q->whereJsonContains('target_roles', $role)
                ->orWhere('target_audience', 'all');
        });
    }

    /**
     * Scope announcements visible to a specific user.
     */
    public function scopeVisibleToUser(Builder $query, User $user): Builder
    {
        $query
            ->where('is_active', true)
            ->where(function ($q) {
                $q->whereNull('published_at')
                    ->orWhere('published_at', '<=', now());
            })
            ->where(function ($q) {
                $q->whereNull('expires_at')
                    ->orWhere('expires_at', '>', now());
            })
            ->forRole($user->role);

        if ($user->role !== User::ROLE_STUDENT || !$user->student_id) {
            return $query;
        }

        $student = $user->student()->with(['sectionModel:id,program_id'])->first();

        if (!$student) {
            return $query
                ->whereNull('department_id')
                ->whereNull('program_id')
                ->whereNull('year_level_id')
                ->whereNull('section_id')
                ->where(function ($q) {
                    $q->whereNull('program')->orWhere('program', '');
                })
                ->where(function ($q) {
                    $q->whereNull('grade_level')->orWhere('grade_level', '');
                });
        }

        $departmentId = $student->resolveDepartmentId();
        $programId = $student->sectionModel?->program_id;

        if (!$programId && $student->program) {
            $programId = Program::where('name', $student->program)->value('id');
        }

        $programName = trim((string) $student->program) ?: null;
        $yearLevelId = $student->year_level_id;
        $yearLevelName = trim((string) $student->year_level) ?: null;
        $sectionId = $student->section_id;

        $query->where(function ($q) use ($departmentId) {
            $q->whereNull('department_id');

            if ($departmentId) {
                $q->orWhere('department_id', $departmentId);
            }
        });

        $query->where(function ($q) use ($programId, $programName) {
            $q->where(function ($all) {
                $all->whereNull('program_id')
                    ->where(function ($legacy) {
                        $legacy->whereNull('program')->orWhere('program', '');
                    });
            });

            if ($programId) {
                $q->orWhere('program_id', $programId);
            }

            if ($programName) {
                $q->orWhere('program', $programName);
            }
        });

        $query->where(function ($q) use ($yearLevelId, $yearLevelName) {
            $q->where(function ($all) {
                $all->whereNull('year_level_id')
                    ->where(function ($legacy) {
                        $legacy->whereNull('grade_level')->orWhere('grade_level', '');
                    });
            });

            if ($yearLevelId) {
                $q->orWhere('year_level_id', $yearLevelId);
            }

            if ($yearLevelName) {
                $q->orWhere('grade_level', $yearLevelName);
            }
        });

        $query->where(function ($q) use ($sectionId) {
            $q->whereNull('section_id');

            if ($sectionId) {
                $q->orWhere('section_id', $sectionId);
            }
        });

        return $query;
    }

    /**
     * Scope announcements that are unread by a specific user.
     */
    public function scopeUnreadForUser(Builder $query, User $user): Builder
    {
        return $query->whereNotExists(function ($subQuery) use ($user) {
            $subQuery
                ->selectRaw('1')
                ->from('announcement_user_reads')
                ->whereColumn('announcement_user_reads.announcement_id', 'announcements.id')
                ->where('announcement_user_reads.user_id', $user->id);
        });
    }

    /**
     * Check if this announcement is targeted at a specific role.
     */
    public function isForRole(string $role): bool
    {
        if ($this->target_audience === 'all') {
            return true;
        }
        
        return in_array($role, $this->target_roles ?? []);
    }
}
