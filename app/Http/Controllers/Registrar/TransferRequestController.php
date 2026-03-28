<?php

namespace App\Http\Controllers\Registrar;

use App\Http\Controllers\Controller;
use App\Models\AppSetting;
use App\Models\OnlineTransaction;
use App\Models\Student;
use App\Models\StudentActionLog;
use App\Models\StudentFee;
use App\Models\StudentPayment;
use App\Models\TransferRequest;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use App\Models\User;
use Inertia\Inertia;
use Inertia\Response;

class TransferRequestController extends Controller
{
    public function index(Request $request): Response
    {
        $tab = $request->input('tab', 'pending');
        $hasFinalizedColumn = Schema::hasColumn('transfer_requests', 'finalized_at');

        $query = TransferRequest::with([
            'student:id,first_name,last_name,middle_name,suffix,lrn,email,program,year_level,section,student_photo_url,enrollment_status,department_id,is_active',
            'student.department:id,name,classification',
            'registrarApprovedBy:id,name,username',
            'accountingApprovedBy:id,name,username',
            'finalizedBy:id,name,username',
        ])->withSum([
            'onlineTransactions as transfer_online_paid_amount' => function ($q) {
                $q->whereIn('status', ['completed', 'verified']);
            }
        ], 'amount');

        if ($tab && $tab !== 'all') {
            if ($tab === 'finalized') {
                if ($hasFinalizedColumn) {
                    $query->where(function ($q) {
                        $q->whereNotNull('finalized_at')
                            ->orWhereHas('student', function ($sq) {
                                $sq->where('enrollment_status', 'dropped')
                                    ->where('is_active', false);
                            });
                    });
                } else {
                    $query->whereHas('student', function ($q) {
                        $q->where('enrollment_status', 'dropped')
                            ->where('is_active', false);
                    });
                }
            } else {
                $query->where('registrar_status', $tab);

                if ($tab === 'approved' && $hasFinalizedColumn) {
                    $query->where(function ($q) {
                        $q->whereNull('finalized_at')
                            ->whereDoesntHave('student', function ($sq) {
                                $sq->where('enrollment_status', 'dropped')
                                    ->where('is_active', false);
                            });
                    });
                }

                if ($tab === 'approved' && !$hasFinalizedColumn) {
                    $query->whereDoesntHave('student', function ($q) {
                        $q->where('enrollment_status', 'dropped')
                            ->where('is_active', false);
                    });
                }
            }
        }

        if ($search = $request->input('search')) {
            $query->whereHas('student', function ($q) use ($search) {
                $q->where('first_name', 'like', "%{$search}%")
                    ->orWhere('last_name', 'like', "%{$search}%")
                    ->orWhere('lrn', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%");
            });
        }

        $requests = $query->latest()->paginate(20)->withQueryString();

        $requests->getCollection()->transform(function ($r) {
            return [
                'id' => $r->id,
                'reason' => $r->reason,
                'new_school_name' => $r->new_school_name,
                'new_school_address' => $r->new_school_address,
                'receiving_contact_person' => $r->receiving_contact_person,
                'receiving_contact_number' => $r->receiving_contact_number,
                'months_stayed_enrolled' => $r->months_stayed_enrolled,
                'subjects_completed' => $r->subjects_completed,
                'incomplete_subjects' => $r->incomplete_subjects,
                'has_pending_requirements' => $r->has_pending_requirements,
                'pending_requirements_details' => $r->pending_requirements_details,
                'requesting_documents' => $r->requesting_documents,
                'requested_documents' => $r->requested_documents,
                'issued_items' => $r->issued_items,
                'student_notes' => $r->student_notes,
                'status' => $r->status,
                'registrar_status' => $r->registrar_status,
                'accounting_status' => $r->accounting_status,
                'semester' => $r->semester,
                'school_year' => $r->school_year,
                'registrar_remarks' => $r->registrar_remarks,
                'accounting_remarks' => $r->accounting_remarks,
                'outstanding_balance' => (float) $r->outstanding_balance,
                'transfer_fee_amount' => (float) $r->transfer_fee_amount,
                'transfer_fee_paid' => (bool) $r->transfer_fee_paid,
                'transfer_fee_or_number' => $r->transfer_fee_or_number,
                'transfer_online_paid_amount' => (float) ($r->transfer_online_paid_amount ?? 0),
                'transfer_balance_due' => max(0, (float) $r->transfer_fee_amount - (float) ($r->transfer_online_paid_amount ?? 0)),
                'balance_override' => (bool) $r->balance_override,
                'balance_override_reason' => $r->balance_override_reason,
                'registrar_approved_by' => $r->registrarApprovedBy ? [
                    'id' => $r->registrarApprovedBy->id,
                    'name' => $r->registrarApprovedBy->name,
                    'username' => $r->registrarApprovedBy->username,
                ] : null,
                'accounting_approved_by' => $r->accountingApprovedBy ? [
                    'id' => $r->accountingApprovedBy->id,
                    'name' => $r->accountingApprovedBy->name,
                    'username' => $r->accountingApprovedBy->username,
                ] : null,
                'finalized_by' => $r->finalizedBy ? [
                    'id' => $r->finalizedBy->id,
                    'name' => $r->finalizedBy->name,
                    'username' => $r->finalizedBy->username,
                ] : null,
                'registrar_approved_at' => $r->registrar_approved_at?->format('M d, Y h:i A'),
                'accounting_approved_at' => $r->accounting_approved_at?->format('M d, Y h:i A'),
                'finalized_at' => $r->finalized_at?->format('M d, Y h:i A')
                    ?? (($r->student && !$r->student->is_active && $r->student->enrollment_status === 'dropped')
                        ? $r->updated_at?->format('M d, Y h:i A')
                        : null),
                'created_at' => $r->created_at->format('M d, Y h:i A'),
                'student' => $r->student ? [
                    'id' => $r->student->id,
                    'full_name' => $r->student->full_name,
                    'lrn' => $r->student->lrn,
                    'email' => $r->student->email,
                    'program' => $r->student->program,
                    'year_level' => $r->student->year_level,
                    'section' => $r->student->section,
                    'student_photo_url' => $r->student->student_photo_url,
                    'enrollment_status' => $r->student->enrollment_status,
                    'is_active' => (bool) $r->student->is_active,
                    'classification' => $r->student->department?->classification,
                ] : null,
            ];
        });

        $stats = [
            'pending' => TransferRequest::where('registrar_status', 'pending')->count(),
            'approved' => $hasFinalizedColumn
                ? TransferRequest::where('registrar_status', 'approved')
                    ->where(function ($q) {
                        $q->whereNull('finalized_at')
                            ->whereDoesntHave('student', function ($sq) {
                                $sq->where('enrollment_status', 'dropped')
                                    ->where('is_active', false);
                            });
                    })->count()
                : TransferRequest::where('registrar_status', 'approved')
                    ->whereDoesntHave('student', function ($q) {
                        $q->where('enrollment_status', 'dropped')
                            ->where('is_active', false);
                    })->count(),
            'rejected' => TransferRequest::where('registrar_status', 'rejected')->count(),
            'finalized' => TransferRequest::where(function ($q) use ($hasFinalizedColumn) {
                if ($hasFinalizedColumn) {
                    $q->whereNotNull('finalized_at');
                }

                $q->orWhereHas('student', function ($sq) {
                    $sq->where('enrollment_status', 'dropped')
                        ->where('is_active', false);
                });
            })->count(),
        ];

        $settings = AppSetting::current();

        $deadline = $settings->transfer_request_deadline ? Carbon::parse($settings->transfer_request_deadline) : null;

        return Inertia::render('registrar/transfer-requests/index', [
            'requests' => $requests,
            'stats' => $stats,
            'tab' => $tab,
            'filters' => $request->only(['search']),
            'transferRequestDeadline' => $deadline?->format('Y-m-d'),
        ]);
    }

    public function setDeadline(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'transfer_request_deadline' => 'nullable|date',
        ]);

        AppSetting::current()->update([
            'transfer_request_deadline' => $validated['transfer_request_deadline'] ?? null,
        ]);

        return back()->with('success', $validated['transfer_request_deadline']
            ? 'Transfer request deadline set to ' . date('M d, Y', strtotime($validated['transfer_request_deadline'])) . '.'
            : 'Transfer request deadline cleared.');
    }

    public function approve(Request $request, TransferRequest $transferRequest): RedirectResponse
    {
        if ($transferRequest->registrar_status !== 'pending') {
            return back()->with('error', 'Only pending requests can be approved.');
        }

        $validated = $request->validate([
            'registrar_remarks' => 'nullable|string|max:1000',
        ]);

        $transferRequest->approveByRegistrar(Auth::id(), $validated['registrar_remarks'] ?? null);

        return back()->with('success', 'Transfer request approved and forwarded to super-accounting.');
    }

    public function reject(Request $request, TransferRequest $transferRequest): RedirectResponse
    {
        if ($transferRequest->registrar_status !== 'pending') {
            return back()->with('error', 'Only pending requests can be rejected.');
        }

        $validated = $request->validate([
            'registrar_remarks' => 'required|string|max:1000',
        ]);

        $transferRequest->rejectByRegistrar(Auth::id(), $validated['registrar_remarks']);

        return back()->with('success', 'Transfer request rejected.');
    }

    public function finalize(TransferRequest $transferRequest): RedirectResponse
    {
        if (Schema::hasColumn('transfer_requests', 'finalized_at') && $transferRequest->finalized_at) {
            return back()->with('error', 'Transfer request is already finalized.');
        }

        if ($transferRequest->accounting_status !== 'approved') {
            return back()->with('error', 'Transfer request must be approved by super-accounting first.');
        }

        if ((float) $transferRequest->transfer_fee_amount > 0 && ! $transferRequest->transfer_fee_paid) {
            return back()->with('error', 'Transfer out fee must be marked as paid before registrar finalization.');
        }

        DB::transaction(function () use ($transferRequest) {
            $transferRequest->finalizeByRegistrar(Auth::id());

            $student = $transferRequest->student;
            if (!$student) {
                return;
            }

            $studentUserIds = User::query()
                ->where('role', 'student')
                ->where(function ($q) use ($student) {
                    $q->where('student_id', $student->id);

                    if (!empty($student->email)) {
                        $q->orWhere('email', $student->email);
                    }
                })
                ->pluck('id');

            if ($studentUserIds->isNotEmpty()) {
                DB::table(config('session.table', 'sessions'))
                    ->whereIn('user_id', $studentUserIds->all())
                    ->delete();

                User::whereIn('id', $studentUserIds->all())->update([
                    'remember_token' => null,
                ]);
            }
        });

        return back()->with('success', 'Student has been officially transferred out and account access is disabled.');
    }

    public function reactivate(Student $student): RedirectResponse
    {
        if ($student->is_active) {
            return back()->with('error', 'Student account is already active.');
        }

        DB::transaction(function () use ($student) {
            $student->update([
                'enrollment_status' => 'not-enrolled',
                'is_active' => true,
            ]);

            if ($student->user) {
                $clearance = \App\Models\EnrollmentClearance::where('user_id', $student->user->id)->first();
                if ($clearance) {
                    $clearance->update([
                        'registrar_clearance' => false,
                        'registrar_cleared_at' => null,
                        'registrar_cleared_by' => null,
                        'accounting_clearance' => false,
                        'accounting_cleared_at' => null,
                        'accounting_cleared_by' => null,
                        'official_enrollment' => false,
                        'officially_enrolled_at' => null,
                        'officially_enrolled_by' => null,
                        'enrollment_status' => 'not_started',
                    ]);
                }
            }

            $this->resetStudentFinancialLedger($student);
        });

        return back()->with('success', 'Student has been reactivated and can log in again.');
    }

    private function resetStudentFinancialLedger(Student $student): void
    {
        $paymentCount = StudentPayment::where('student_id', $student->id)->count();
        $onlineCount = OnlineTransaction::where('student_id', $student->id)->count();

        OnlineTransaction::where('student_id', $student->id)->delete();
        StudentPayment::where('student_id', $student->id)->delete();

        StudentFee::where('student_id', $student->id)
            ->get()
            ->each(function (StudentFee $fee) {
                $fee->update([
                    'total_paid' => 0,
                    'balance' => max(0, (float) $fee->total_amount - (float) $fee->grant_discount),
                ]);
            });

        TransferRequest::where('student_id', $student->id)->update([
            'transfer_fee_paid' => false,
            'transfer_fee_or_number' => null,
        ]);

        StudentActionLog::create([
            'student_id' => $student->id,
            'performed_by' => Auth::id(),
            'action' => 'Financial Ledger Reset on Reactivation',
            'action_type' => 'status_change',
            'details' => "Cleared {$paymentCount} payment(s) and {$onlineCount} online transaction(s) during transfer reactivation.",
            'changes' => [
                'payments_cleared' => $paymentCount,
                'online_transactions_cleared' => $onlineCount,
            ],
        ]);
    }
}
