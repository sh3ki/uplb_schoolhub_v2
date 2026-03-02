<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\RequirementCategory;
use App\Models\Requirement;
use App\Models\Student;
use App\Models\StudentRequirement;

class RequirementSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Create Common Requirements Category
        $commonCategory = RequirementCategory::create([
            'name' => 'Common Requirements',
            'slug' => 'common-requirements',
            'description' => 'Standard requirements for all students',
            'order' => 1,
            'is_active' => true,
        ]);

        // Create the 6 standard requirements
        $requirements = [
            [
                'name' => 'Form 138 (Report Card)',
                'description' => 'Original or certified true copy of Form 138 (Report Card)',
                'order' => 1,
            ],
            [
                'name' => 'Birth Certificate',
                'description' => 'NSO/PSA issued Birth Certificate',
                'order' => 2,
            ],
            [
                'name' => 'Medical Records',
                'description' => 'Medical examination results and health records',
                'order' => 3,
            ],
            [
                'name' => 'Good Moral Certificate',
                'description' => 'Certificate of Good Moral Character from previous school',
                'order' => 4,
            ],
            [
                'name' => 'ID Pictures',
                'description' => '2x2 ID pictures (4 copies, white background)',
                'order' => 5,
            ],
            [
                'name' => 'Registration Form',
                'description' => 'Accomplished registration form',
                'order' => 6,
            ],
        ];

        foreach ($requirements as $req) {
            Requirement::create([
                'requirement_category_id' => $commonCategory->id,
                'name' => $req['name'],
                'description' => $req['description'],
                'deadline_type' => 'during_enrollment',
                'applies_to_new_enrollee' => true,
                'applies_to_transferee' => true,
                'applies_to_returning' => true,
                'is_required' => true,
                'order' => $req['order'],
                'is_active' => true,
            ]);
        }

        // ─────────────────────────────────────────────────────────────────
        // K-12 Requirements Category
        // ─────────────────────────────────────────────────────────────────
        $k12Category = RequirementCategory::create([
            'name' => 'K-12 Requirements',
            'slug' => 'k12-requirements',
            'description' => 'Requirements specific to K-12 students (Grades 7–12)',
            'order' => 2,
            'is_active' => true,
        ]);

        $k12Requirements = [
            [
                'name' => 'Form 138 / Report Card (K-12)',
                'description' => 'Original or certified true copy of Form 138 from previous level',
                'order' => 1,
            ],
            [
                'name' => 'PSA Birth Certificate',
                'description' => 'Philippine Statistics Authority (PSA) authenticated Birth Certificate',
                'order' => 2,
            ],
            [
                'name' => 'Barangay Certificate',
                'description' => 'Certificate of residency from the student\'s barangay',
                'order' => 3,
            ],
            [
                'name' => 'ESC / SHS Voucher Application',
                'description' => 'Educational Service Contracting (ESC) certificate or SHS Voucher form (if applicable)',
                'order' => 4,
            ],
            [
                'name' => 'Parent/Guardian Authorization Letter',
                'description' => 'Signed authorization letter from parent or guardian (for minor students)',
                'order' => 5,
            ],
        ];

        foreach ($k12Requirements as $req) {
            Requirement::create([
                'requirement_category_id' => $k12Category->id,
                'name' => $req['name'],
                'description' => $req['description'],
                'deadline_type' => 'during_enrollment',
                'applies_to_new_enrollee' => true,
                'applies_to_transferee' => true,
                'applies_to_returning' => true,
                'is_required' => true,
                'order' => $req['order'],
                'is_active' => true,
            ]);
        }

        // ─────────────────────────────────────────────────────────────────
        // College Requirements Category
        // ─────────────────────────────────────────────────────────────────
        $collegeCategory = RequirementCategory::create([
            'name' => 'College Requirements',
            'slug' => 'college-requirements',
            'description' => 'Requirements specific to college-level students',
            'order' => 3,
            'is_active' => true,
        ]);

        $collegeRequirements = [
            [
                'name' => 'Official Transcript of Records (TOR)',
                'description' => 'Official Transcript of Records from previous school or college',
                'order' => 1,
            ],
            [
                'name' => 'Honorable Dismissal',
                'description' => 'Honorable Dismissal or Transfer Credentials from previous institution',
                'order' => 2,
            ],
            [
                'name' => 'High School Diploma / Senior High Completion',
                'description' => 'Diploma or certificate of completion from Senior High School',
                'order' => 3,
            ],
            [
                'name' => 'NCAE / NSAT Results',
                'description' => 'National Career Assessment Examination or National Secondary Achievement Test results',
                'order' => 4,
            ],
            [
                'name' => 'Certificate of Good Moral Character (College)',
                'description' => 'Certificate of Good Moral Character from previous school signed by principal/registrar',
                'order' => 5,
            ],
            [
                'name' => 'College Entrance Test (CET) Result',
                'description' => 'Copy of Western Colleges entrance exam results or equivalent',
                'order' => 6,
            ],
        ];

        foreach ($collegeRequirements as $req) {
            Requirement::create([
                'requirement_category_id' => $collegeCategory->id,
                'name' => $req['name'],
                'description' => $req['description'],
                'deadline_type' => 'during_enrollment',
                'applies_to_new_enrollee' => true,
                'applies_to_transferee' => true,
                'applies_to_returning' => false,
                'is_required' => true,
                'order' => $req['order'],
                'is_active' => true,
            ]);
        }

        // Assign requirements to all existing students
        $allRequirements = Requirement::all();
        $students = Student::all();

        foreach ($students as $student) {
            foreach ($allRequirements as $requirement) {
                StudentRequirement::create([
                    'student_id' => $student->id,
                    'requirement_id' => $requirement->id,
                    'status' => 'pending',
                ]);
            }
        }
    }
}

