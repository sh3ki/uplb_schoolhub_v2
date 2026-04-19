<?php

namespace App\Http\Middleware;

use App\Models\AppSetting;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureElmsEnabled
{
    public function handle(Request $request, Closure $next): Response
    {
        $enabled = (bool) (AppSetting::current()->elms_enabled ?? true);

        if ($enabled) {
            return $next($request);
        }

        if ($request->expectsJson()) {
            abort(403, 'E-LMS module is currently disabled.');
        }

        $role = (string) ($request->user()?->role ?? 'dashboard');

        return redirect("/{$role}/dashboard")
            ->with('warning', 'E-LMS module is currently disabled by the owner.');
    }
}
