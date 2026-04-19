<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('quizzes', function (Blueprint $table) {
            $table->enum('assessment_type', ['quiz', 'exam', 'long_test', 'activity', 'assignment'])
                ->default('quiz')
                ->after('description');
            $table->foreignId('year_level_id')->nullable()->after('department_id')->constrained()->nullOnDelete();
            $table->foreignId('section_id')->nullable()->after('year_level_id')->constrained()->nullOnDelete();
            $table->string('program')->nullable()->after('section_id');

            $table->index(['assessment_type', 'is_published', 'is_active'], 'quizzes_type_publish_active_idx');
        });
    }

    public function down(): void
    {
        Schema::table('quizzes', function (Blueprint $table) {
            $table->dropIndex('quizzes_type_publish_active_idx');
            $table->dropConstrainedForeignId('section_id');
            $table->dropConstrainedForeignId('year_level_id');
            $table->dropColumn(['assessment_type', 'program']);
        });
    }
};
