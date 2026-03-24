<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('transfer_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('student_id')->constrained('students')->onDelete('cascade');
            $table->text('reason');
            $table->enum('status', ['pending', 'approved', 'rejected'])->default('pending');
            $table->string('semester')->nullable();
            $table->string('school_year')->nullable();

            $table->enum('registrar_status', ['pending', 'approved', 'rejected'])->default('pending');
            $table->foreignId('registrar_approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('registrar_approved_at')->nullable();
            $table->text('registrar_remarks')->nullable();

            $table->enum('accounting_status', ['pending', 'approved', 'rejected'])->default('pending');
            $table->foreignId('accounting_approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('accounting_approved_at')->nullable();
            $table->text('accounting_remarks')->nullable();

            $table->decimal('outstanding_balance', 12, 2)->default(0);
            $table->boolean('balance_override')->default(false);
            $table->text('balance_override_reason')->nullable();

            $table->foreignId('processed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('processed_at')->nullable();

            $table->timestamps();
            $table->softDeletes();

            $table->index(['student_id', 'status']);
            $table->index('registrar_status');
            $table->index('accounting_status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('transfer_requests');
    }
};
