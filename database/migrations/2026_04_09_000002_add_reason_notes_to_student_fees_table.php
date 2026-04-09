<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('student_fees', function (Blueprint $table) {
            if (!Schema::hasColumn('student_fees', 'reason')) {
                $table->string('reason')->nullable()->after('processed_at');
            }

            if (!Schema::hasColumn('student_fees', 'notes')) {
                $table->text('notes')->nullable()->after('reason');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('student_fees', function (Blueprint $table) {
            if (Schema::hasColumn('student_fees', 'notes')) {
                $table->dropColumn('notes');
            }

            if (Schema::hasColumn('student_fees', 'reason')) {
                $table->dropColumn('reason');
            }
        });
    }
};
