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
        Schema::table('drop_requests', function (Blueprint $table) {
            // Dual-approval fields (registrar → accounting)
            $table->enum('registrar_status', ['pending', 'approved', 'rejected'])->default('pending')->after('status');
            $table->foreignId('registrar_approved_by')->nullable()->constrained('users')->nullOnDelete()->after('registrar_status');
            $table->timestamp('registrar_approved_at')->nullable()->after('registrar_approved_by');
            $table->text('registrar_remarks')->nullable()->after('registrar_approved_at');

            $table->enum('accounting_status', ['pending', 'approved', 'rejected'])->default('pending')->after('registrar_remarks');
            $table->foreignId('accounting_approved_by')->nullable()->constrained('users')->nullOnDelete()->after('accounting_status');
            $table->timestamp('accounting_approved_at')->nullable()->after('accounting_approved_by');
            $table->text('accounting_remarks')->nullable()->after('accounting_approved_at');

            // Payment tracking
            $table->decimal('fee_amount', 12, 2)->default(0)->after('accounting_remarks');
            $table->boolean('is_paid')->default(false)->after('fee_amount');
            $table->string('or_number')->nullable()->after('is_paid');

            // Indexes
            $table->index('registrar_status');
            $table->index('accounting_status');
        });

        // Pivot table for drop request fee items
        Schema::create('drop_request_fee_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('drop_request_id')->constrained('drop_requests')->onDelete('cascade');
            $table->foreignId('fee_item_id')->constrained('fee_items')->onDelete('cascade');
            $table->decimal('amount', 12, 2);
            $table->timestamps();

            $table->unique(['drop_request_id', 'fee_item_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('drop_request_fee_items');

        Schema::table('drop_requests', function (Blueprint $table) {
            $table->dropForeign(['registrar_approved_by']);
            $table->dropForeign(['accounting_approved_by']);
            $table->dropIndex(['registrar_status']);
            $table->dropIndex(['accounting_status']);
            $table->dropColumn([
                'registrar_status',
                'registrar_approved_by',
                'registrar_approved_at',
                'registrar_remarks',
                'accounting_status',
                'accounting_approved_by',
                'accounting_approved_at',
                'accounting_remarks',
                'fee_amount',
                'is_paid',
                'or_number',
            ]);
        });
    }
};
