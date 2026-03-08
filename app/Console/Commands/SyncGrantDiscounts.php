<?php

namespace App\Console\Commands;

use App\Models\GrantRecipient;
use App\Models\StudentFee;
use Illuminate\Console\Command;

class SyncGrantDiscounts extends Command
{
    protected $signature = 'grants:sync';
    protected $description = 'Sync grant discounts to student fees';

    public function handle()
    {
        $this->info('Syncing grant discounts to student fees...');

        // Step 1: Recalculate and fix discount_amount in grant_recipients from the Grant model
        // This repairs records where discount_amount was incorrectly stored as 0
        $allRecipients = GrantRecipient::where('status', 'active')->with('grant')->get();

        foreach ($allRecipients as $recipient) {
            if (!$recipient->grant) {
                continue;
            }
            $studentFee = StudentFee::where('student_id', $recipient->student_id)
                ->where('school_year', $recipient->school_year)
                ->first();
            $totalAmount = $studentFee ? (float) $studentFee->total_amount : 0;
            $correctDiscount = $recipient->grant->calculateDiscount($totalAmount);
            if ((float) $recipient->discount_amount !== $correctDiscount) {
                $recipient->discount_amount = $correctDiscount;
                $recipient->save();
                $this->info("Fixed recipient {$recipient->id} (student {$recipient->student_id}): discount ₱{$correctDiscount}");
            }
        }

        // Step 2: Apply summed grant discounts to StudentFee records
        $processed = [];
        foreach ($allRecipients as $recipient) {
            $key = $recipient->student_id . '_' . $recipient->school_year;
            if (isset($processed[$key])) {
                continue;
            }
            $processed[$key] = true;

            $studentFee = StudentFee::where('student_id', $recipient->student_id)
                ->where('school_year', $recipient->school_year)
                ->first();

            if ($studentFee) {
                $totalGrants = GrantRecipient::where('student_id', $recipient->student_id)
                    ->where('school_year', $recipient->school_year)
                    ->where('status', 'active')
                    ->sum('discount_amount');

                $studentFee->grant_discount = $totalGrants;
                $studentFee->balance = max(0, (float) $studentFee->total_amount - (float) $studentFee->total_paid - (float) $totalGrants);
                $studentFee->save();

                $this->info("Updated StudentFee for student {$recipient->student_id} ({$recipient->school_year}): grant_discount=₱{$totalGrants}");
            }
        }

        $this->info('Grant discounts synced successfully!');
        return 0;
    }
}
