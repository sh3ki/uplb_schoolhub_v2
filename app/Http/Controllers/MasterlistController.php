<?php

namespace App\Http\Controllers;

use App\Models\Student;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Inertia\Inertia;
use Inertia\Response;

class MasterlistController extends Controller
{
    public function index(Request $request): Response|JsonResponse
    {
        $routeName = $request->route()?->getName() ?? '';
        $rolePrefix = 'accounting';

        if (str_starts_with($routeName, 'super-accounting.')) {
            $rolePrefix = 'super-accounting';
        } elseif (str_starts_with($routeName, 'registrar.')) {
            $rolePrefix = 'registrar';
        } elseif (str_starts_with($routeName, 'owner.')) {
            $rolePrefix = 'owner';
        }

        $studentsQuery = Student::query()
            ->with('departmentModel:id,name,classification')
            ->whereNull('deleted_at')
            ->orderBy('last_name')
            ->orderBy('first_name');

        if ($rolePrefix === 'super-accounting') {
            $studentsQuery->withoutTransferredOut();
        }

        $students = $studentsQuery->get([
                'id',
                'first_name',
                'last_name',
                'middle_name',
                'gender',
                'lrn',
                'year_level',
                'department_id',
                'program',
                'student_photo_url',
            ]);

        $k12 = $students
            ->filter(fn ($student) => ($student->departmentModel?->classification ?? null) === 'K-12')
            ->groupBy(fn ($student) => $student->year_level ?: 'Unassigned Grade')
            ->map(function ($rows, $grade) {
                $male = $rows->filter(fn ($row) => strtolower((string) $row->gender) === 'male')->values();
                $female = $rows->filter(fn ($row) => strtolower((string) $row->gender) === 'female')->values();

                return [
                    'group' => (string) $grade,
                    'male' => $male->map(fn ($student) => [
                        'id' => $student->id,
                        'name' => $student->last_name . ', ' . $student->first_name,
                        'lrn' => $student->lrn,
                    ])->values(),
                    'female' => $female->map(fn ($student) => [
                        'id' => $student->id,
                        'name' => $student->last_name . ', ' . $student->first_name,
                        'lrn' => $student->lrn,
                    ])->values(),
                ];
            })
            ->values();

        $college = $students
            ->filter(fn ($student) => ($student->departmentModel?->classification ?? null) === 'College')
            ->groupBy(fn ($student) => $student->departmentModel?->name ?: 'Unassigned Department')
            ->map(function ($rows, $department) {
                $male = $rows->filter(fn ($row) => strtolower((string) $row->gender) === 'male')->values();
                $female = $rows->filter(fn ($row) => strtolower((string) $row->gender) === 'female')->values();

                return [
                    'group' => (string) $department,
                    'male' => $male->map(fn ($student) => [
                        'id' => $student->id,
                        'name' => $student->last_name . ', ' . $student->first_name,
                        'lrn' => $student->lrn,
                    ])->values(),
                    'female' => $female->map(fn ($student) => [
                        'id' => $student->id,
                        'name' => $student->last_name . ', ' . $student->first_name,
                        'lrn' => $student->lrn,
                    ])->values(),
                ];
            })
            ->values();

        $payload = [
            'rolePrefix' => $rolePrefix,
            'k12Groups' => $k12,
            'collegeGroups' => $college,
        ];

        if ($request->boolean('json')) {
            return response()->json($payload);
        }

        return Inertia::render('shared/masterlist', $payload);
    }
}
