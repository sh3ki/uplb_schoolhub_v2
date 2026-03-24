import { Head, router, useForm } from '@inertiajs/react';
import { CheckCircle2, Clock, Plus, Trash2, UserRoundX, XCircle } from 'lucide-react';
import { useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import StudentLayout from '@/layouts/student/student-layout';

type TransferRequest = {
    id: number;
    reason: string;
    status: 'pending' | 'approved' | 'rejected';
    registrar_status: string;
    accounting_status: string;
    semester: string | null;
    school_year: string | null;
    registrar_remarks: string | null;
    accounting_remarks: string | null;
    outstanding_balance: number;
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
                                            Your request will go through registrar and accounting approval.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-4 py-4">
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
                        Once finalized, your student account will be deactivated and login access will be blocked until reactivated by registrar.
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
                        <CardDescription>Track your transfer request approvals and remarks.</CardDescription>
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
                                            <TableCell className="max-w-[260px] truncate" title={request.accounting_remarks || request.registrar_remarks || ''}>
                                                {request.accounting_remarks || request.registrar_remarks || '—'}
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
