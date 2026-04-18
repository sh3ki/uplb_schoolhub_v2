<?php

namespace App\Http\Controllers;

use Illuminate\Support\Facades\DB;

abstract class Controller
{
    /**
     * Resolve the Inertia view prefix based on the current route.
     * Accounting controllers render 'accounting/...' views by default,
     * but when accessed via super-accounting routes they render 'super-accounting/...' views.
     */
    protected function viewPrefix(): string
    {
        $routeName = request()->route()?->getName() ?? '';

        if (str_starts_with($routeName, 'super-accounting.')) {
            return 'super-accounting';
        }

        return 'accounting';
    }

    protected function normalizeNumericOrNumberInput(?string $value): ?string
    {
        $normalized = trim((string) $value);

        return $normalized !== '' ? $normalized : null;
    }

    protected function normalizeReferenceNumberInput(?string $value): ?string
    {
        $normalized = strtoupper(trim((string) $value));

        return $normalized !== '' ? $normalized : null;
    }

    protected function isOrNumberInUse(string $orNumber, array $ignoreByTable = []): bool
    {
        $tables = [
            ['table' => 'student_payments', 'column' => 'or_number'],
            ['table' => 'transfer_requests', 'column' => 'transfer_fee_or_number'],
            ['table' => 'drop_requests', 'column' => 'or_number'],
            ['table' => 'document_requests', 'column' => 'or_number'],
        ];

        foreach ($tables as $target) {
            $table = $target['table'];
            $column = $target['column'];

            $query = DB::table($table)->where($column, $orNumber);

            if (isset($ignoreByTable[$table])) {
                $query->where('id', '!=', (int) $ignoreByTable[$table]);
            }

            if ($query->exists()) {
                return true;
            }
        }

        return false;
    }
}
