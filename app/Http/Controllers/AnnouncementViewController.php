<?php

namespace App\Http\Controllers;

use App\Models\Announcement;
use App\Models\Department;
use App\Models\Program;
use App\Models\Section;
use App\Models\User;
use App\Models\YearLevel;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class AnnouncementViewController extends Controller
{
    // Roles that can create announcements
    private const CAN_CREATE_ROLES = ['owner', 'registrar', 'accounting', 'super-accounting', 'teacher'];

    /**
     * Display announcements for the current user's role.
     */
    public function index(Request $request): Response
    {
        $user = $request->user();
        $role = $user->role;
        $sortBy = $request->input('sort_by', 'priority');
        $sortBy = in_array($sortBy, ['priority', 'date'], true) ? $sortBy : 'priority';
        $readStatus = $request->input('read_status', 'unread');
        $readStatus = in_array($readStatus, ['read', 'unread', 'all'], true) ? $readStatus : 'unread';

        $query = $this->visibleQueryForUser($user)
            ->with(['creator:id,name', 'department:id,name,classification', 'programModel:id,name', 'yearLevel:id,name', 'section:id,name']);

        // Apply filters
        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                    ->orWhere('content', 'like', "%{$search}%");
            });
        }

        if ($readStatus === 'read') {
            $query->whereExists(function ($subQuery) use ($user) {
                $subQuery
                    ->selectRaw('1')
                    ->from('announcement_user_reads')
                    ->whereColumn('announcement_user_reads.announcement_id', 'announcements.id')
                    ->where('announcement_user_reads.user_id', $user->id);
            });
        } elseif ($readStatus === 'unread') {
            $query->unreadForUser($user);
        }

        $query->orderByDesc('is_pinned');

        if ($sortBy === 'date') {
            $query->orderByDesc('created_at');
        } else {
            $query
                ->orderByRaw("CASE priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 WHEN 'low' THEN 4 ELSE 5 END")
                ->orderByDesc('created_at');
        }

        $announcements = $query
            ->paginate(10)
            ->withQueryString();

        $readRows = DB::table('announcement_user_reads')
            ->where('user_id', $user->id)
            ->whereIn('announcement_id', $announcements->getCollection()->pluck('id'))
            ->pluck('read_at', 'announcement_id');

        $announcements->getCollection()->transform(function (Announcement $announcement) use ($readRows, $user) {
            $readAt = $readRows[$announcement->id] ?? null;

            $announcement->setAttribute('is_read', !is_null($readAt));
            $announcement->setAttribute('read_at', $readAt);
            $announcement->setAttribute('can_edit', (int) $announcement->created_by === (int) $user->id);

            return $announcement;
        });

        $canCreate = in_array($role, self::CAN_CREATE_ROLES);

        return Inertia::render("{$role}/announcements/index", [
            'announcements' => $announcements,
            'filters' => [
                'search' => $request->input('search'),
                'sort_by' => $sortBy,
                'read_status' => $readStatus,
            ],
            'role' => $role,
            'canCreate' => $canCreate,
            'departments' => $canCreate
                ? Department::where('is_active', true)->orderBy('name')->get(['id', 'name', 'classification'])
                : [],
            'programs' => $canCreate
                ? Program::where('is_active', true)->orderBy('name')->get(['id', 'department_id', 'name'])
                : [],
            'yearLevels' => $canCreate
                ? YearLevel::where('is_active', true)->orderBy('level_number')->get(['id', 'department_id', 'program_id', 'classification', 'name'])
                : [],
            'sections' => $canCreate
                ? Section::where('is_active', true)->orderBy('name')->get(['id', 'department_id', 'program_id', 'year_level_id', 'name'])
                : [],
        ]);
    }

    /**
     * Store a newly created announcement.
     */
    public function store(Request $request): RedirectResponse
    {
        $user = $request->user();
        $role = $user->role;

        // Only allowed roles can create
        if (!in_array($role, self::CAN_CREATE_ROLES)) {
            abort(403, 'Unauthorized');
        }

        $validated = $this->validateAnnouncement($request);
        $validated = $this->normalizeAudienceFilters($validated);

        $validated['created_by'] = $user->id;
        $validated['published_at'] = now();
        $validated['is_active'] = true;
        $validated['target_audience'] = 'custom';

        Announcement::create($validated);

        return redirect()->back()->with('success', 'Announcement created successfully!');
    }

    /**
     * Update an existing announcement by its creator.
     */
    public function update(Request $request, Announcement $announcement): RedirectResponse
    {
        $user = $request->user();

        if ((int) $announcement->created_by !== (int) $user->id) {
            abort(403, 'Only the announcement creator can edit this announcement.');
        }

        $validated = $this->validateAnnouncement($request);
        $validated = $this->normalizeAudienceFilters($validated);
        $validated['target_audience'] = 'custom';

        $announcement->update($validated);

        return redirect()->back()->with('success', 'Announcement updated successfully!');
    }

    /**
     * Mark all unread announcements visible to the current user as read.
     */
    public function markRead(Request $request): RedirectResponse
    {
        $user = $request->user();

        if (!$user) {
            abort(401);
        }

        $announcementIds = $this->visibleQueryForUser($user)
            ->unreadForUser($user)
            ->pluck('announcements.id');

        $this->markAnnouncementIdsAsRead($announcementIds, $user->id);

        $user->forceFill([
            'announcements_read_at' => now(),
        ])->save();

        return redirect()->back()->with('success', 'All unread announcements were marked as read.');
    }

    /**
     * Mark a specific announcement as read for the current user.
     */
    public function markSingleRead(Request $request, Announcement $announcement): RedirectResponse
    {
        $user = $request->user();

        if (!$user) {
            abort(401);
        }

        $isVisible = $this->visibleQueryForUser($user)
            ->where('announcements.id', $announcement->id)
            ->exists();

        if (!$isVisible) {
            abort(404);
        }

        $this->markAnnouncementIdsAsRead(collect([$announcement->id]), $user->id);

        return redirect()->back()->with('success', 'Announcement marked as read.');
    }

    /**
     * Validate create/update payload.
     */
    private function validateAnnouncement(Request $request): array
    {
        return $request->validate([
            'title'          => 'required|string|max:255',
            'content'        => 'required|string',
            'priority'       => 'required|in:low,normal,high,urgent',
            'target_roles'   => 'required|array|min:1',
            'target_roles.*' => 'in:' . implode(',', Announcement::AVAILABLE_ROLES),
            'department_id'  => 'nullable|exists:departments,id',
            'program_id'     => 'nullable|exists:programs,id',
            'year_level_id'  => 'nullable|exists:year_levels,id',
            'section_id'     => 'nullable|exists:sections,id',
            'classification' => 'nullable|in:K-12,College,All',
            'program'        => 'nullable|string|max:255',
            'grade_level'    => 'nullable|string|max:255',
            'is_pinned'      => 'boolean',
        ]);
    }

    /**
     * Normalize department/program/year/section targeting fields.
     */
    private function normalizeAudienceFilters(array $validated): array
    {
        $validated['department_id'] = $validated['department_id'] ?: null;
        $validated['program_id'] = $validated['program_id'] ?: null;
        $validated['year_level_id'] = $validated['year_level_id'] ?: null;
        $validated['section_id'] = $validated['section_id'] ?: null;

        $section = $validated['section_id'] ? Section::find($validated['section_id']) : null;
        $yearLevel = $validated['year_level_id'] ? YearLevel::find($validated['year_level_id']) : null;
        $program = $validated['program_id'] ? Program::find($validated['program_id']) : null;

        if ($section) {
            $validated['year_level_id'] = $validated['year_level_id'] ?? $section->year_level_id;
            $validated['department_id'] = $validated['department_id'] ?? $section->department_id;
            if (!$validated['program_id'] && $section->program_id) {
                $validated['program_id'] = $section->program_id;
            }
        }

        if ($yearLevel) {
            $validated['department_id'] = $validated['department_id'] ?? $yearLevel->department_id;
            if (!$validated['program_id'] && $yearLevel->program_id) {
                $validated['program_id'] = $yearLevel->program_id;
            }
        }

        if ($program) {
            $validated['department_id'] = $validated['department_id'] ?? $program->department_id;
        }

        $department = $validated['department_id'] ? Department::find($validated['department_id']) : null;
        $program = $validated['program_id'] ? Program::find($validated['program_id']) : null;
        $yearLevel = $validated['year_level_id'] ? YearLevel::find($validated['year_level_id']) : null;

        $validated['classification'] = $department?->classification;
        $validated['program'] = $program?->name;
        $validated['grade_level'] = $yearLevel?->name;

        return $validated;
    }

    /**
     * Query announcements visible to a user.
     */
    private function visibleQueryForUser(User $user): Builder
    {
        return Announcement::query()->visibleToUser($user);
    }

    /**
     * Upsert announcement read records.
     */
    private function markAnnouncementIdsAsRead(Collection $announcementIds, int $userId): void
    {
        if ($announcementIds->isEmpty()) {
            return;
        }

        $now = now();
        $rows = $announcementIds
            ->unique()
            ->map(fn ($announcementId) => [
                'announcement_id' => $announcementId,
                'user_id' => $userId,
                'read_at' => $now,
                'created_at' => $now,
                'updated_at' => $now,
            ])
            ->values()
            ->all();

        DB::table('announcement_user_reads')->upsert(
            $rows,
            ['announcement_id', 'user_id'],
            ['read_at', 'updated_at']
        );
    }
}
