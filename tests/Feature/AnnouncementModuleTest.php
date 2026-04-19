<?php

use App\Models\Announcement;
use App\Models\Department;
use App\Models\Program;
use App\Models\Section;
use App\Models\Student;
use App\Models\User;
use App\Models\YearLevel;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;

function makeDepartment(string $name, string $classification = 'College'): Department
{
    return Department::create([
        'name' => $name,
        'classification' => $classification,
        'level' => $classification === 'College' ? 'college' : 'senior_high',
        'description' => "{$name} description",
        'code' => Str::upper(Str::substr(str_replace(' ', '', $name), 0, 4)) . '_' . uniqid(),
        'is_active' => true,
    ]);
}

test('student only sees announcements for their department targeting', function () {
    $departmentA = makeDepartment('College of Computing');
    $departmentB = makeDepartment('College of Business');

    $programA = Program::create([
        'department_id' => $departmentA->id,
        'name' => 'BS Computer Science',
        'description' => 'CS Program',
        'duration_years' => 4,
        'is_active' => true,
    ]);

    $yearLevelA = YearLevel::create([
        'department_id' => $departmentA->id,
        'program_id' => $programA->id,
        'classification' => 'College',
        'name' => '1st Year',
        'level_number' => 1,
        'is_active' => true,
    ]);

    $sectionA = Section::create([
        'department_id' => $departmentA->id,
        'year_level_id' => $yearLevelA->id,
        'program_id' => $programA->id,
        'name' => 'Section A',
        'code' => 'SEC-A',
        'capacity' => 40,
        'is_active' => true,
    ]);

    $student = Student::factory()->create([
        'department_id' => $departmentA->id,
        'year_level_id' => $yearLevelA->id,
        'section_id' => $sectionA->id,
        'program' => $programA->name,
        'year_level' => $yearLevelA->name,
        'section' => $sectionA->name,
    ]);

    $studentUser = User::factory()->create([
        'role' => User::ROLE_STUDENT,
        'student_id' => $student->id,
        'email_verified_at' => now(),
    ]);

    $creator = User::factory()->create([
        'role' => User::ROLE_REGISTRAR,
    ]);

    Announcement::create([
        'title' => 'For Department A',
        'content' => 'Visible to Department A student only.',
        'priority' => 'urgent',
        'target_audience' => 'custom',
        'target_roles' => ['student'],
        'department_id' => $departmentA->id,
        'created_by' => $creator->id,
        'published_at' => now()->subMinute(),
        'is_active' => true,
    ]);

    Announcement::create([
        'title' => 'For Department B',
        'content' => 'Must not be visible to Department A student.',
        'priority' => 'high',
        'target_audience' => 'custom',
        'target_roles' => ['student'],
        'department_id' => $departmentB->id,
        'created_by' => $creator->id,
        'published_at' => now()->subMinute(),
        'is_active' => true,
    ]);

    $response = $this->actingAs($studentUser)->get(route('student.announcements.index'));

    $response->assertOk();
    $response->assertInertia(fn (Assert $page) => $page
        ->component('student/announcements/index')
        ->has('announcements.data', 1)
        ->where('announcements.data.0.title', 'For Department A')
    );
});

test('mark all as read creates read records and removes items from default unread view', function () {
    $registrar = User::factory()->create([
        'role' => User::ROLE_REGISTRAR,
    ]);

    $announcement = Announcement::create([
        'title' => 'Registrar Notice',
        'content' => 'Unread notice for registrar.',
        'priority' => 'normal',
        'target_audience' => 'custom',
        'target_roles' => ['registrar'],
        'created_by' => $registrar->id,
        'published_at' => now()->subMinute(),
        'is_active' => true,
    ]);

    $this->actingAs($registrar)
        ->post(route('registrar.announcements.mark-read'))
        ->assertRedirect();

    $this->assertDatabaseHas('announcement_user_reads', [
        'announcement_id' => $announcement->id,
        'user_id' => $registrar->id,
    ]);

    $response = $this->actingAs($registrar)->get(route('registrar.announcements.index'));

    $response->assertOk();
    $response->assertInertia(fn (Assert $page) => $page
        ->component('registrar/announcements/index')
        ->has('announcements.data', 0)
    );
});

test('only creator can edit an announcement in shared announcement module', function () {
    $creator = User::factory()->create([
        'role' => User::ROLE_REGISTRAR,
    ]);

    $otherRegistrar = User::factory()->create([
        'role' => User::ROLE_REGISTRAR,
    ]);

    $announcement = Announcement::create([
        'title' => 'Original Title',
        'content' => 'Original content',
        'priority' => 'normal',
        'target_audience' => 'custom',
        'target_roles' => ['registrar'],
        'created_by' => $creator->id,
        'published_at' => now()->subMinute(),
        'is_active' => true,
    ]);

    $this->actingAs($creator)
        ->patch(route('registrar.announcements.update', $announcement), [
            'title' => 'Updated Title',
            'content' => 'Updated content',
            'priority' => 'high',
            'target_roles' => ['registrar'],
            'is_pinned' => true,
        ])
        ->assertRedirect();

    $this->assertDatabaseHas('announcements', [
        'id' => $announcement->id,
        'title' => 'Updated Title',
        'priority' => 'high',
        'is_pinned' => true,
    ]);

    $this->actingAs($otherRegistrar)
        ->patch(route('registrar.announcements.update', $announcement), [
            'title' => 'Should Fail',
            'content' => 'Not allowed',
            'priority' => 'low',
            'target_roles' => ['registrar'],
        ])
        ->assertForbidden();
});
