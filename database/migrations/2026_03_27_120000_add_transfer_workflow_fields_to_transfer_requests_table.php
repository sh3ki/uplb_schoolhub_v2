<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('transfer_requests', function (Blueprint $table) {
            $table->string('new_school_name')->nullable()->after('reason');
            $table->string('new_school_address')->nullable()->after('new_school_name');
            $table->string('receiving_contact_person')->nullable()->after('new_school_address');
            $table->string('receiving_contact_number')->nullable()->after('receiving_contact_person');
            $table->unsignedInteger('months_stayed_enrolled')->nullable()->after('receiving_contact_number');
            $table->boolean('subjects_completed')->nullable()->after('months_stayed_enrolled');
            $table->text('incomplete_subjects')->nullable()->after('subjects_completed');
            $table->boolean('has_pending_requirements')->nullable()->after('incomplete_subjects');
            $table->text('pending_requirements_details')->nullable()->after('has_pending_requirements');
            $table->boolean('requesting_documents')->nullable()->after('pending_requirements_details');
            $table->text('requested_documents')->nullable()->after('requesting_documents');
            $table->text('issued_items')->nullable()->after('requested_documents');
            $table->text('student_notes')->nullable()->after('issued_items');

            $table->decimal('transfer_fee_amount', 12, 2)->default(0)->after('outstanding_balance');
            $table->boolean('transfer_fee_paid')->default(false)->after('transfer_fee_amount');
            $table->string('transfer_fee_or_number')->nullable()->after('transfer_fee_paid');
        });
    }

    public function down(): void
    {
        Schema::table('transfer_requests', function (Blueprint $table) {
            $table->dropColumn([
                'new_school_name',
                'new_school_address',
                'receiving_contact_person',
                'receiving_contact_number',
                'months_stayed_enrolled',
                'subjects_completed',
                'incomplete_subjects',
                'has_pending_requirements',
                'pending_requirements_details',
                'requesting_documents',
                'requested_documents',
                'issued_items',
                'student_notes',
                'transfer_fee_amount',
                'transfer_fee_paid',
                'transfer_fee_or_number',
            ]);
        });
    }
};
