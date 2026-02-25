<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // ── Enrollment period settings for app_settings ───────────────────
        Schema::table('app_settings', function (Blueprint $table) {
            $table->boolean('k12_enrollment_open')->default(false)->after('has_college');
            $table->date('k12_enrollment_start')->nullable()->after('k12_enrollment_open');
            $table->date('k12_enrollment_end')->nullable()->after('k12_enrollment_start');
            $table->boolean('college_enrollment_open')->default(false)->after('k12_enrollment_end');
            $table->date('college_enrollment_start')->nullable()->after('college_enrollment_open');
            $table->date('college_enrollment_end')->nullable()->after('college_enrollment_start');
        });

        // ── Attendance records table ──────────────────────────────────────
        Schema::create('attendances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('student_id')->constrained('students')->cascadeOnDelete();
            $table->foreignId('subject_id')->nullable()->constrained('subjects')->nullOnDelete();
            $table->foreignId('section_id')->nullable()->constrained('sections')->nullOnDelete();
            $table->foreignId('teacher_id')->nullable()->constrained('teachers')->nullOnDelete();
            $table->date('date');
            // present | absent | late | excused
            $table->enum('status', ['present', 'absent', 'late', 'excused'])->default('present');
            $table->time('time_in')->nullable();
            $table->time('time_out')->nullable();
            $table->text('remarks')->nullable();
            $table->string('school_year', 20)->nullable();
            $table->timestamps();

            $table->unique(['student_id', 'subject_id', 'date'], 'attendance_unique');
            $table->index(['student_id', 'date'], 'attendance_student_date_idx');
            $table->index(['section_id', 'date'], 'attendance_section_date_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('attendances');

        Schema::table('app_settings', function (Blueprint $table) {
            $table->dropColumn([
                'k12_enrollment_open',
                'k12_enrollment_start',
                'k12_enrollment_end',
                'college_enrollment_open',
                'college_enrollment_start',
                'college_enrollment_end',
            ]);
        });
    }
};
