<?php

namespace App\Http\Controllers\Accounting;

use App\Http\Controllers\Controller;
use App\Models\OnlineTransaction;
use App\Models\TransferRequest;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

class TransferRequestController extends Controller
{
    public function index(Request $request): Response
    {
        $tab = $request->input('tab', 'pending');

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
        ], 'amount')->where('registrar_status', 'approved');

        if ($tab === 'pending') {
            $query->where('accounting_status', 'pending');
        } elseif ($tab === 'approved') {
            $query->where('accounting_status', 'approved');
        } elseif ($tab === 'rejected') {
            $query->where('accounting_status', 'rejected');
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
            $linkedOnlinePaid = (float) ($r->transfer_online_paid_amount ?? 0);
            $fallbackOnlinePaid = (float) OnlineTransaction::query()
                ->where('student_id', $r->student_id)
                ->whereNull('transfer_request_id')
                ->where(function ($q) {
                    $q->where('payment_context', 'transfer_out_fee')
                        ->orWhere('remarks', 'like', '%[PaymentType: transfer_out_fee]%')
                        ->orWhereNull('student_payment_id');
                })
                ->whereIn('status', ['completed', 'verified'])
                ->when($r->accounting_approved_at, fn($q) => $q->where('verified_at', '>=', $r->accounting_approved_at))
                ->sum('amount');

            $onlinePaid = $linkedOnlinePaid + $fallbackOnlinePaid;
            $transferFeeAmount = (float) $r->transfer_fee_amount;
            $transferBalanceDue = max(0, $transferFeeAmount - $onlinePaid);
            $transferFeePaid = (bool) $r->transfer_fee_paid || ($transferFeeAmount > 0 && $transferBalanceDue <= 0);

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
                'transfer_fee_amount' => $transferFeeAmount,
                'transfer_fee_paid' => $transferFeePaid,
                'transfer_fee_or_number' => $r->transfer_fee_or_number,
                'transfer_online_paid_amount' => $onlinePaid,
                'transfer_balance_due' => $transferBalanceDue,
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
                'finalized_at' => $r->finalized_at?->format('M d, Y h:i A'),
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
            'pending' => TransferRequest::where('registrar_status', 'approved')->where('accounting_status', 'pending')->count(),
            'approved' => TransferRequest::where('registrar_status', 'approved')->where('accounting_status', 'approved')->count(),
            'rejected' => TransferRequest::where('registrar_status', 'approved')->where('accounting_status', 'rejected')->count(),
        ];

        return Inertia::render($this->viewPrefix() . '/transfer-requests/index', [
            'requests' => $requests,
            'stats' => $stats,
            'tab' => $tab,
            'filters' => $request->only(['search']),
        ]);
    }

    public function approve(Request $request, TransferRequest $transferRequest): RedirectResponse
    {
        if ($transferRequest->registrar_status !== 'approved') {
            return back()->with('error', 'Transfer request has not been approved by registrar yet.');
        }

        if ($transferRequest->accounting_status !== 'pending') {
            return back()->with('error', 'This transfer request has already been processed.');
        }

        $validated = $request->validate([
            'accounting_remarks' => 'nullable|string|max:1000',
            'transfer_fee_amount' => 'required|numeric|min:0|max:99999999.99',
            'mark_as_paid' => 'nullable|boolean',
            'or_number' => 'nullable|string|max:100',
        ]);

        $transferFeeAmount = (float) $validated['transfer_fee_amount'];
        $markAsPaid = (bool) ($validated['mark_as_paid'] ?? false);

        if ($markAsPaid && $transferFeeAmount > 0 && empty($validated['or_number'])) {
            return back()->with('error', 'OR number is required when marking transfer fee as paid.');
        }

        $transferRequest->approveByAccounting(
            Auth::id(),
            $validated['accounting_remarks'] ?? null,
            $transferFeeAmount,
            $markAsPaid,
            $validated['or_number'] ?? null
        );

        return back()->with('success', 'Transfer request processed by super-accounting. Awaiting registrar finalization.');
    }

    public function reject(Request $request, TransferRequest $transferRequest): RedirectResponse
    {
        if ($transferRequest->registrar_status !== 'approved') {
            return back()->with('error', 'Transfer request has not been approved by registrar yet.');
        }

        if ($transferRequest->accounting_status !== 'pending') {
            return back()->with('error', 'This transfer request has already been processed.');
        }

        $validated = $request->validate([
            'accounting_remarks' => 'required|string|max:1000',
        ]);

        $transferRequest->rejectByAccounting(Auth::id(), $validated['accounting_remarks']);

        return back()->with('success', 'Transfer request rejected.');
    }

    public function markPaid(Request $request, TransferRequest $transferRequest): RedirectResponse
    {
        if ($transferRequest->accounting_status !== 'approved') {
            return back()->with('error', 'Only approved transfer requests can be marked as paid.');
        }

        $validated = $request->validate([
            'or_number' => 'required|string|max:100',
            'transfer_fee_amount' => 'nullable|numeric|min:0|max:99999999.99',
        ]);

        $transferRequest->markTransferFeePaid(
            Auth::id(),
            $validated['or_number'],
            array_key_exists('transfer_fee_amount', $validated) ? (float) $validated['transfer_fee_amount'] : null
        );

        return back()->with('success', 'Transfer out fee marked as paid.');
    }
}
