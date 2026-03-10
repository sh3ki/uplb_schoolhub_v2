<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('online_transactions', function (Blueprint $table) {
            $table->string('bank_name')->nullable()->after('account_number');
        });
    }

    public function down(): void
    {
        Schema::table('online_transactions', function (Blueprint $table) {
            $table->dropColumn('bank_name');
        });
    }
};
