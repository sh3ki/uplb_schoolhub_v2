<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Makes students.program nullable since K-12 students don't always have a program.
     */
    public function up(): void
    {
        Schema::table('students', function (Blueprint $table) {
            $table->string('program')->nullable()->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('students', function (Blueprint $table) {
            $table->string('program')->nullable(false)->change();
        });
    }
};
