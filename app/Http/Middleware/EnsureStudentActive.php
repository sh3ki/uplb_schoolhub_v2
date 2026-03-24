<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class EnsureStudentActive
{
    /**
     * Handle an incoming request.
     * Block students whose accounts have been deactivated by registrar workflows.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (!$user) {
            return $next($request);
        }

        // Only check for student role
        if ($user->role !== 'student') {
            return $next($request);
        }

        // Check if student exists and is active
        if ($user->student_id) {
            $student = $user->student;
            
            if ($student && !$student->is_active) {
                Auth::logout();
                $request->session()->invalidate();
                $request->session()->regenerateToken();

                return redirect()->route('login')->with('error', 
                    'Your account has been deactivated. Please visit the registrar\'s office for assistance.'
                );
            }
        }

        return $next($request);
    }
}
