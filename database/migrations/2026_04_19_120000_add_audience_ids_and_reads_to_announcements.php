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
            if (!Schema::hasColumn('announcements', 'program_id')) {
                $table->foreignId('program_id')->nullable()->after('classification')->constrained()->nullOnDelete();
            }

            if (!Schema::hasColumn('announcements', 'year_level_id')) {
                $table->foreignId('year_level_id')->nullable()->after('program_id')->constrained()->nullOnDelete();
            }

            if (!Schema::hasColumn('announcements', 'section_id')) {
                $table->foreignId('section_id')->nullable()->after('year_level_id')->constrained()->nullOnDelete();
            }
        });

        if (!Schema::hasTable('announcement_user_reads')) {
            Schema::create('announcement_user_reads', function (Blueprint $table) {
                $table->id();
                $table->foreignId('announcement_id')->constrained()->cascadeOnDelete();
                $table->foreignId('user_id')->constrained()->cascadeOnDelete();
                $table->timestamp('read_at')->nullable();
                $table->timestamps();

                $table->unique(['announcement_id', 'user_id']);
                $table->index(['user_id', 'announcement_id']);
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('announcement_user_reads')) {
            Schema::dropIfExists('announcement_user_reads');
        }

        Schema::table('announcements', function (Blueprint $table) {
            if (Schema::hasColumn('announcements', 'section_id')) {
                $table->dropConstrainedForeignId('section_id');
            }

            if (Schema::hasColumn('announcements', 'year_level_id')) {
                $table->dropConstrainedForeignId('year_level_id');
            }

            if (Schema::hasColumn('announcements', 'program_id')) {
                $table->dropConstrainedForeignId('program_id');
            }
        });
    }
};
