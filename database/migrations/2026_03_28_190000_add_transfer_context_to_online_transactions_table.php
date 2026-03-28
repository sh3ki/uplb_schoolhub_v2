<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('online_transactions', function (Blueprint $table) {
            $table->enum('payment_context', ['tuition', 'transfer_out_fee'])
                ->default('tuition')
                ->after('payment_method');

            $table->foreignId('transfer_request_id')
                ->nullable()
                ->after('student_payment_id')
                ->constrained('transfer_requests')
                ->nullOnDelete();

            $table->index(['payment_context', 'status']);
            $table->index('transfer_request_id');
        });
    }

    public function down(): void
    {
        Schema::table('online_transactions', function (Blueprint $table) {
            $table->dropIndex(['payment_context', 'status']);
            $table->dropIndex(['transfer_request_id']);
            $table->dropConstrainedForeignId('transfer_request_id');
            $table->dropColumn('payment_context');
        });
    }
};
