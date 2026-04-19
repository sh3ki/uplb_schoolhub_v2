<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('enrollment_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('student_id')->constrained('students')->cascadeOnDelete();
            $table->string('school_year');
            $table->tinyInteger('semester');
            $table->enum('status', [
                'pending_registrar',
                'pending_accounting',
                'approved_accounting',
                'rejected_registrar',
                'rejected_accounting',
                'completed',
            ])->default('pending_registrar');
            $table->text('registrar_notes')->nullable();
            $table->text('accounting_notes')->nullable();
            $table->foreignId('registrar_reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('accounting_reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('registrar_reviewed_at')->nullable();
            $table->timestamp('accounting_reviewed_at')->nullable();
            $table->foreignId('completed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('completed_at')->nullable();
            $table->decimal('total_amount', 10, 2)->nullable();
            $table->timestamps();
        });

        Schema::create('enrollment_request_subjects', function (Blueprint $table) {
            $table->id();
            $table->foreignId('enrollment_request_id')->constrained('enrollment_requests')->cascadeOnDelete();
            $table->foreignId('subject_id')->constrained('subjects')->cascadeOnDelete();
            $table->decimal('selling_price', 10, 2)->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('enrollment_request_subjects');
        Schema::dropIfExists('enrollment_requests');
    }
};
