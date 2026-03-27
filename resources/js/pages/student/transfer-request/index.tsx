import { Head, router, useForm } from '@inertiajs/react';
import { CheckCircle2, ChevronRight, Clock, Plus, Trash2, UserRoundX, XCircle } from 'lucide-react';
import { useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import StudentLayout from '@/layouts/student/student-layout';

type TransferRequest = {
    id: number;
    reason: string;
    new_school_name: string | null;
    new_school_address: string | null;
    receiving_contact_person: string | null;
    receiving_contact_number: string | null;
    months_stayed_enrolled: number | null;
    subjects_completed: boolean | null;
    incomplete_subjects: string | null;
    has_pending_requirements: boolean | null;
    pending_requirements_details: string | null;
    requesting_documents: boolean | null;
    requested_documents: string | null;
    issued_items: string | null;
    student_notes: string | null;
    status: 'pending' | 'approved' | 'rejected';
    registrar_status: string;
    accounting_status: string;
    semester: string | null;
    school_year: string | null;
    registrar_remarks: string | null;
    accounting_remarks: string | null;
    outstanding_balance: number;
    transfer_fee_amount: number;
    transfer_fee_paid: boolean;
    transfer_fee_or_number: string | null;
    balance_override: boolean;
    balance_override_reason: string | null;
    processed_by: string | null;
    processed_at: string | null;
    created_at: string;
};

type Props = {
    requests: TransferRequest[];
    hasPendingRequest: boolean;
    hasApprovedRequest: boolean;
    isTransferredOut: boolean;
    currentSchoolYear: string;
    transferRequestDeadline: string | null;
    deadlinePassed: boolean;
    classification: string;
};

const StatusBadge = ({ status }: { status: string }) => {
    if (status === 'approved') {
        return <Badge className="bg-green-100 text-green-800 border border-green-200"><CheckCircle2 className="h-3 w-3 mr-1" /> Approved</Badge>;
    }
    if (status === 'rejected') {
        return <Badge className="bg-red-100 text-red-800 border border-red-200"><XCircle className="h-3 w-3 mr-1" /> Rejected</Badge>;
    }
    return <Badge className="bg-amber-100 text-amber-800 border border-amber-200"><Clock className="h-3 w-3 mr-1" /> Pending</Badge>;
};

export default function TransferRequestIndex({
    requests,
    hasPendingRequest,
    isTransferredOut,
    currentSchoolYear,
    transferRequestDeadline,
    deadlinePassed,
    classification,
}: Props) {
    const [isOpen, setIsOpen] = useState(false);

    const form = useForm({
        reason: '',
        new_school_name: '',
        new_school_address: '',
        receiving_contact_person: '',
        receiving_contact_number: '',
        months_stayed_enrolled: '',
        subjects_completed: null as boolean | null,
        incomplete_subjects: '',
        has_pending_requirements: null as boolean | null,
        pending_requirements_details: '',
        requesting_documents: null as boolean | null,
        requested_documents: '',
        issued_items: '',
        student_notes: '',
        semester: '',
        school_year: currentSchoolYear,
    });

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        form.post('/student/transfer-request', {
            onSuccess: () => {
                setIsOpen(false);
                form.reset();
            },
        });
    };

    const cancelRequest = (id: number) => {
        if (!confirm('Cancel this transfer request?')) return;
        router.delete(`/student/transfer-request/${id}`);
    };

    const formatCurrency = (amount: number) => {
        return `P${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const getStepState = (request: TransferRequest, step: number) => {
        if (step === 1) {
            return 'done';
        }
        if (step === 2) {
            if (request.registrar_status === 'approved') return 'done';
            if (request.registrar_status === 'rejected') return 'rejected';
            return 'active';
        }
        if (step === 3) {
            if (request.registrar_status !== 'approved') return 'pending';
            if (request.accounting_status === 'approved') return 'done';
            if (request.accounting_status === 'rejected') return 'rejected';
            return 'active';
        }
        if (request.status === 'approved') return 'done';
        if (request.status === 'rejected') return 'rejected';
        return 'pending';
    };

    const stepClass = (state: string) => {
        if (state === 'done') return 'bg-green-100 text-green-700 border-green-300';
        if (state === 'active') return 'bg-blue-100 text-blue-700 border-blue-300';
        if (state === 'rejected') return 'bg-red-100 text-red-700 border-red-300';
        return 'bg-slate-100 text-slate-500 border-slate-300';
    };

    return (
        <StudentLayout>
            <Head title="Transfer Request" />
            <div className="space-y-6 p-6">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold">Transfer Request</h1>
                        <p className="text-muted-foreground text-sm mt-1">Request transfer out from your current enrollment.</p>
                    </div>

                    {!deadlinePassed ? (
                        <Dialog open={isOpen} onOpenChange={setIsOpen}>
                            <DialogTrigger asChild>
                                <Button disabled={hasPendingRequest || isTransferredOut}>
                                    <Plus className="h-4 w-4 mr-2" />
                                    New Transfer Request
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-lg">
                                <form onSubmit={submit}>
                                    <DialogHeader>
                                        <DialogTitle>Submit Transfer Request</DialogTitle>
                                        <DialogDescription>
                                            This follows the transfer-out verification flow: Submitted, Registrar, Super-Accounting, Finalize.
                                        </DialogDescription>
                                    </DialogHeader>
                                        <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-1">
                                        <div className="space-y-2">
                                            <Label htmlFor="school_year">School Year</Label>
                                            <Input id="school_year" value={form.data.school_year} onChange={(e) => form.setData('school_year', e.target.value)} />
                                        </div>

                                        {classification === 'College' && (
                                            <div className="space-y-2">
                                                <Label htmlFor="semester">Semester (Optional)</Label>
                                                <Input id="semester" value={form.data.semester} onChange={(e) => form.setData('semester', e.target.value)} />
                                            </div>
                                        )}

                                        <div className="space-y-2">
                                            <Label htmlFor="new_school_name">New School Name</Label>
                                            <Input id="new_school_name" value={form.data.new_school_name} onChange={(e) => form.setData('new_school_name', e.target.value)} placeholder="Enter receiving school" />
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="new_school_address">New School Address</Label>
                                            <Input id="new_school_address" value={form.data.new_school_address} onChange={(e) => form.setData('new_school_address', e.target.value)} placeholder="Enter receiving school address" />
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <div className="space-y-2">
                                                <Label htmlFor="receiving_contact_person">Receiving School Contact Person</Label>
                                                <Input id="receiving_contact_person" value={form.data.receiving_contact_person} onChange={(e) => form.setData('receiving_contact_person', e.target.value)} />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="receiving_contact_number">Contact Number</Label>
                                                <Input id="receiving_contact_number" value={form.data.receiving_contact_number} onChange={(e) => form.setData('receiving_contact_number', e.target.value)} />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="months_stayed_enrolled">Number of Months Stayed/Enrolled</Label>
                                            <Input
                                                id="months_stayed_enrolled"
                                                type="number"
                                                min={0}
                                                value={form.data.months_stayed_enrolled}
                                                onChange={(e) => form.setData('months_stayed_enrolled', e.target.value)}
                                            />
                                        </div>

                                        <div className="space-y-3 rounded-md border p-3">
                                            <Label>Are all subjects completed?</Label>
                                            <div className="flex items-center gap-4 text-sm">
                                                <label className="flex items-center gap-2"><Checkbox checked={form.data.subjects_completed === true} onCheckedChange={(checked) => form.setData('subjects_completed', checked === true)} /> Yes</label>
                                                <label className="flex items-center gap-2"><Checkbox checked={form.data.subjects_completed === false} onCheckedChange={(checked) => checked === true && form.setData('subjects_completed', false)} /> No</label>
                                            </div>
                                            {form.data.subjects_completed === false && (
                                                <Textarea rows={3} placeholder="Please list incomplete subjects" value={form.data.incomplete_subjects} onChange={(e) => form.setData('incomplete_subjects', e.target.value)} />
                                            )}
                                        </div>

                                        <div className="space-y-3 rounded-md border p-3">
                                            <Label>Are there any pending requirements?</Label>
                                            <div className="flex items-center gap-4 text-sm">
                                                <label className="flex items-center gap-2"><Checkbox checked={form.data.has_pending_requirements === true} onCheckedChange={(checked) => form.setData('has_pending_requirements', checked === true)} /> Yes</label>
                                                <label className="flex items-center gap-2"><Checkbox checked={form.data.has_pending_requirements === false} onCheckedChange={(checked) => checked === true && form.setData('has_pending_requirements', false)} /> No</label>
                                            </div>
                                            {form.data.has_pending_requirements === true && (
                                                <Textarea rows={3} placeholder="Please specify pending requirements" value={form.data.pending_requirements_details} onChange={(e) => form.setData('pending_requirements_details', e.target.value)} />
                                            )}
                                        </div>

                                        <div className="space-y-3 rounded-md border p-3">
                                            <Label>Are you requesting any document?</Label>
                                            <div className="flex items-center gap-4 text-sm">
                                                <label className="flex items-center gap-2"><Checkbox checked={form.data.requesting_documents === true} onCheckedChange={(checked) => form.setData('requesting_documents', checked === true)} /> Yes</label>
                                                <label className="flex items-center gap-2"><Checkbox checked={form.data.requesting_documents === false} onCheckedChange={(checked) => checked === true && form.setData('requesting_documents', false)} /> No</label>
                                            </div>
                                            {form.data.requesting_documents === true && (
                                                <Textarea rows={3} placeholder="Please list needed documents" value={form.data.requested_documents} onChange={(e) => form.setData('requested_documents', e.target.value)} />
                                            )}
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="issued_items">Items issued during enrollment</Label>
                                            <Textarea id="issued_items" rows={3} placeholder="e.g. ID, books, uniforms, equipment" value={form.data.issued_items} onChange={(e) => form.setData('issued_items', e.target.value)} />
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="reason">Reason</Label>
                                            <Textarea
                                                id="reason"
                                                rows={5}
                                                value={form.data.reason}
                                                onChange={(e) => form.setData('reason', e.target.value)}
                                                placeholder="Please provide your reason (minimum 20 characters)."
                                            />
                                            {form.errors.reason && <p className="text-sm text-destructive">{form.errors.reason}</p>}
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="student_notes">Student Notes</Label>
                                            <Textarea id="student_notes" rows={3} placeholder="Additional note for registrar or super-accounting" value={form.data.student_notes} onChange={(e) => form.setData('student_notes', e.target.value)} />
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
                                        <Button type="submit" disabled={form.processing || form.data.reason.length < 20}>Submit</Button>
                                    </DialogFooter>
                                </form>
                            </DialogContent>
                        </Dialog>
                    ) : (
                        <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                            <XCircle className="h-4 w-4" />
                            Submission deadline passed ({transferRequestDeadline})
                        </div>
                    )}
                </div>

                <Alert className="border-amber-200 bg-amber-50">
                    <UserRoundX className="h-4 w-4 text-amber-700" />
                    <AlertTitle className="text-amber-900">Important</AlertTitle>
                    <AlertDescription className="text-amber-800">
                        Once finalized by registrar, your account is deactivated and login access is blocked. Transfer out also requires super-accounting processing for transfer fee payment.
                    </AlertDescription>
                </Alert>

                {isTransferredOut && (
                    <Alert className="border-red-200 bg-red-50">
                        <XCircle className="h-4 w-4 text-red-700" />
                        <AlertTitle className="text-red-900">Transferred Out</AlertTitle>
                        <AlertDescription className="text-red-800">
                            Your account has been transferred out and deactivated.
                        </AlertDescription>
                    </Alert>
                )}

                <Card>
                    <CardHeader>
                        <CardTitle>Request History</CardTitle>
                        <CardDescription>Track submitted details, notes, transfer out fee, and approval progress.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {requests.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No transfer requests yet.</p>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>School Year</TableHead>
                                        <TableHead>Reason</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Flow</TableHead>
                                        <TableHead>Transfer Out Fee</TableHead>
                                        <TableHead>Remarks</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {requests.map((request) => (
                                        <TableRow key={request.id}>
                                            <TableCell>{request.created_at}</TableCell>
                                            <TableCell>{request.school_year || '—'}</TableCell>
                                            <TableCell className="max-w-[280px] truncate" title={request.reason}>{request.reason}</TableCell>
                                            <TableCell><StatusBadge status={request.status} /></TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1 text-xs">
                                                    {[1, 2, 3, 4].map((step) => {
                                                        const state = getStepState(request, step);
                                                        return (
                                                            <div key={step} className="flex items-center gap-1">
                                                                <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full border font-medium ${stepClass(state)}`}>
                                                                    {step}
                                                                </span>
                                                                {step < 4 && <ChevronRight className="h-3 w-3 text-slate-400" />}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {request.transfer_fee_amount > 0 ? (
                                                    <div className="space-y-1 text-xs">
                                                        <div className="font-semibold">{formatCurrency(request.transfer_fee_amount)}</div>
                                                        <Badge className={request.transfer_fee_paid ? 'bg-green-100 text-green-700 border-green-200' : 'bg-amber-100 text-amber-700 border-amber-200'}>
                                                            {request.transfer_fee_paid ? 'Paid' : 'Unpaid'}
                                                        </Badge>
                                                        {request.transfer_fee_or_number && (
                                                            <div className="text-muted-foreground">OR: {request.transfer_fee_or_number}</div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    '—'
                                                )}
                                            </TableCell>
                                            <TableCell className="max-w-[260px] truncate" title={request.accounting_remarks || request.registrar_remarks || ''}>
                                                {request.accounting_remarks || request.registrar_remarks || request.student_notes || '—'}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {request.status === 'pending' && (
                                                    <Button variant="ghost" size="sm" onClick={() => cancelRequest(request.id)}>
                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                    </Button>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            </div>
        </StudentLayout>
    );
}
