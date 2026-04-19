<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('learning_materials', function (Blueprint $table) {
            $table->id();
            $table->foreignId('teacher_id')->constrained('teachers')->cascadeOnDelete();
            $table->foreignId('subject_id')->nullable()->constrained('subjects')->nullOnDelete();
            $table->foreignId('section_id')->nullable()->constrained('sections')->nullOnDelete();
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('file_path');
            $table->string('original_filename');
            $table->string('mime_type', 120)->nullable();
            $table->unsignedBigInteger('file_size')->nullable();
            $table->enum('visibility', ['private', 'subject', 'advisory'])->default('private');
            $table->timestamp('sent_at')->nullable();
            $table->timestamps();

            $table->index(['teacher_id', 'visibility']);
            $table->index(['subject_id', 'visibility']);
            $table->index(['section_id', 'visibility']);
            $table->index('sent_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('learning_materials');
    }
};
