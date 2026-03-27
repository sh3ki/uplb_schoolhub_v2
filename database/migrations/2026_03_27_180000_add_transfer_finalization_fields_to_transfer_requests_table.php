<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('transfer_requests', function (Blueprint $table) {
            $table->foreignId('finalized_by')->nullable()->after('accounting_approved_by')->constrained('users')->nullOnDelete();
            $table->timestamp('finalized_at')->nullable()->after('accounting_approved_at');
        });

        // Backfill legacy finalized transfer-outs (approved request + currently dropped and inactive student).
        DB::table('transfer_requests as tr')
            ->join('students as s', 's.id', '=', 'tr.student_id')
            ->whereNull('tr.finalized_at')
            ->where('tr.registrar_status', 'approved')
            ->where('tr.accounting_status', 'approved')
            ->where('s.enrollment_status', 'dropped')
            ->where('s.is_active', false)
            ->update([
                'tr.finalized_at' => DB::raw('COALESCE(tr.processed_at, tr.updated_at, tr.created_at)'),
                'tr.finalized_by' => DB::raw('COALESCE(tr.registrar_approved_by, tr.accounting_approved_by, tr.processed_by)'),
            ]);
    }

    public function down(): void
    {
        Schema::table('transfer_requests', function (Blueprint $table) {
            $table->dropConstrainedForeignId('finalized_by');
            $table->dropColumn('finalized_at');
        });
    }
};
