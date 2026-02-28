<?php

namespace App\Http\Controllers;

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
}
