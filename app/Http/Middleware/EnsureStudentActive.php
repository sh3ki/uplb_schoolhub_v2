<?php

namespace App\Http\Middleware;

use Closure;
use App\Models\Student;
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

        $student = $user->student;

        // Fallback for legacy records where user.student_id may be missing.
        if (!$student && $user->email) {
            $student = Student::where('email', $user->email)->first();
        }

        // Student role must always have an active linked student record.
        if (!$student || !$student->is_active || $student->enrollment_status === 'dropped') {
            Auth::logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();

            return redirect()->route('login')->with('error',
                'Your account has been deactivated. Please visit the registrar\'s office for assistance.'
            );
        }

        // Heal legacy linkage for future requests.
        if ((int) $user->student_id !== (int) $student->id) {
            $user->forceFill(['student_id' => $student->id])->save();
        }

        return $next($request);
    }
}
