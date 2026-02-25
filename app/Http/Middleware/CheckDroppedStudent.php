<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class CheckDroppedStudent
{
    /**
     * Handle an incoming request.
     * Block students with 'dropped' enrollment status from accessing the portal.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = Auth::user();

        if ($user && $user->role === 'student' && $user->student_id) {
            $student = \App\Models\Student::find($user->student_id);
            
            if ($student && $student->enrollment_status === 'dropped') {
                Auth::logout();
                $request->session()->invalidate();
                $request->session()->regenerateToken();

                return redirect('/login')->withErrors([
                    'email' => 'Your student account has been dropped. Please contact the Registrar\'s Office for assistance.',
                ]);
            }
        }

        return $next($request);
    }
}
