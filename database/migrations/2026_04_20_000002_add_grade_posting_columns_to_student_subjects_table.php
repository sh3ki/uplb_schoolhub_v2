<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('student_subjects', function (Blueprint $table) {
            $table->decimal('draft_grade', 5, 2)->nullable()->after('grade');
            $table->json('draft_breakdown')->nullable()->after('draft_grade');
            $table->json('grade_breakdown')->nullable()->after('draft_breakdown');
            $table->boolean('is_grade_posted')->default(true)->after('grade_breakdown');
            $table->timestamp('grade_posted_at')->nullable()->after('is_grade_posted');

            $table->index(['student_id', 'is_grade_posted'], 'student_subjects_student_posted_idx');
        });
    }

    public function down(): void
    {
        Schema::table('student_subjects', function (Blueprint $table) {
            $table->dropIndex('student_subjects_student_posted_idx');
            $table->dropColumn([
                'draft_grade',
                'draft_breakdown',
                'grade_breakdown',
                'is_grade_posted',
                'grade_posted_at',
            ]);
        });
    }
};
