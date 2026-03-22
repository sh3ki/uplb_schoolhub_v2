<?php

namespace App\Http\Controllers\Owner;

use App\Http\Controllers\Controller;
use App\Models\AcademicDeadline;
use App\Models\Requirement;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class CalendarController extends Controller
{
    public function index(Request $request): Response
    {
        $month = $request->get('month', Carbon::now()->month);
        $year = $request->get('year', Carbon::now()->year);
        $rolePrefix = $this->resolveRolePrefix($request->path());
        
        $startDate = Carbon::create($year, $month, 1)->startOfMonth();
        $endDate = Carbon::create($year, $month, 1)->endOfMonth();

        // Academic deadlines configured from the registrar deadlines module.
        $deadlines = AcademicDeadline::with('requirements')
            ->where('is_active', true)
            ->whereBetween('deadline_date', [$startDate, $endDate])
            ->get()
            ->map(function ($deadline) {
                return [
                    'id' => $deadline->id,
                    'title' => $deadline->name,
                    'date' => $deadline->deadline_date->toDateString(),
                    'type' => 'deadline',
                    'classification' => $deadline->classification ?? 'All',
                    'requirements_count' => $deadline->requirements->count(),
                    'description' => $deadline->description ?? 'No description',
                ];
            });

        // Requirement-level deadlines configured from the registrar requirements module.
        $requirementDeadlines = Requirement::with(['category:id,name'])
            ->where('is_active', true)
            ->where('deadline_type', 'custom')
            ->whereNotNull('custom_deadline')
            ->whereBetween('custom_deadline', [$startDate, $endDate])
            ->get()
            ->map(function ($requirement) {
                return [
                    'id' => 'req-' . $requirement->id,
                    'title' => $requirement->name,
                    'date' => $requirement->custom_deadline?->toDateString(),
                    'type' => 'requirement',
                    'classification' => 'All',
                    'requirements_count' => 1,
                    'description' => $requirement->category?->name
                        ? 'Requirement Category: ' . $requirement->category->name
                        : ($requirement->description ?? 'Requirement deadline'),
                ];
            });

        return Inertia::render('shared/calendar-view', [
            'events' => $deadlines->concat($requirementDeadlines)->values(),
            'currentMonth' => $month,
            'currentYear' => $year,
            'monthName' => Carbon::create($year, $month, 1)->format('F Y'),
            'rolePrefix' => $rolePrefix,
        ]);
    }

    protected function resolveRolePrefix(string $path): string
    {
        $firstSegment = explode('/', trim($path, '/'))[0] ?? 'owner';

        return in_array($firstSegment, ['owner', 'registrar', 'accounting', 'super-accounting'], true)
            ? $firstSegment
            : 'owner';
    }
}
