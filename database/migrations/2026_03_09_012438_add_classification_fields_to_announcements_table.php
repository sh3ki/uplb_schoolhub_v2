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
        Schema::table('announcements', function (Blueprint $table) {
            $table->string('classification')->nullable()->after('department_id');
            $table->string('program')->nullable()->after('classification');
            $table->string('grade_level')->nullable()->after('program');
        });
    }

    public function down(): void
    {
        Schema::table('announcements', function (Blueprint $table) {
            $table->dropColumn(['classification', 'program', 'grade_level']);
        });
    }
};
