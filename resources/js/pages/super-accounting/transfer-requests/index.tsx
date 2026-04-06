import { Head, router, useForm } from '@inertiajs/react';
import { ChevronRight, Search, ThumbsDown, ThumbsUp } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import SuperAccountingLayout from '@/layouts/super-accounting/super-accounting-layout';

type RequestItem = {
    id: number;
    reason: string;
    new_school_name: string | null;
    new_school_address: string | null;
    receiving_contact_person: string | null;
    receiving_contact_number: string | null;
    months_stayed_enrolled: string | null;
    subjects_completed: string | null;
    incomplete_subjects: string | null;
    has_pending_requirements: boolean;
    pending_requirements_details: string | null;
    requesting_documents: boolean;
    requested_documents: string | null;
    issued_items: string | null;
    status: 'pending' | 'approved' | 'rejected';
    registrar_status: 'pending' | 'approved' | 'rejected';
    accounting_status: 'pending' | 'approved' | 'rejected';
    transfer_fee_amount: number;
    transfer_fee_paid: boolean;
    transfer_fee_or_number: string | null;
    transfer_online_paid_amount: number;
    transfer_balance_due: number;
    student_notes: string | null;
    registrar_remarks: string | null;
    registrar_approved_by: { id: number; name: string; username: string | null } | null;
    accounting_approved_by: { id: number; name: string; username: string | null } | null;
    finalized_by: { id: number; name: string; username: string | null } | null;
    registrar_approved_at: string | null;
    accounting_approved_at: string | null;
    finalized_at: string | null;
    student: {
        full_name: string;
        lrn: string;
        student_photo_url: string | null;
    };
};

type Props = {
    requests: { data: RequestItem[] };
    stats: { pending: number; approved: number; rejected: number };
    tab: string;
    filters: { search?: string };
};

const statusBadge = (status: string) => {
    if (status === 'approved') return <Badge className="bg-green-100 text-green-800 border border-green-200">Approved</Badge>;
    if (status === 'rejected') return <Badge className="bg-red-100 text-red-800 border border-red-200">Rejected</Badge>;
    return <Badge className="bg-amber-100 text-amber-800 border border-amber-200">Pending</Badge>;
};

const currency = (amount: number) => `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const stepLabel = (step: number) => {
    if (step === 1) return 'Submitted';
    if (step === 2) return 'Registrar';
    if (step === 3) return 'Super-Accounting';
    return 'Finalize';
};

const getStepState = (item: RequestItem, step: number) => {
    if (step === 1) return 'done';

    if (step === 2) {
        if (item.registrar_status === 'approved') return 'done';
        if (item.registrar_status === 'rejected') return 'rejected';
        return 'active';
    }

    if (step === 3) {
        if (item.registrar_status !== 'approved') return 'pending';
        if (item.accounting_status === 'approved') return 'done';
        if (item.accounting_status === 'rejected') return 'rejected';
        return 'active';
    }

    if (item.finalized_at) return 'done';
    if (item.status === 'rejected') return 'rejected';
    return 'pending';
};

const stepClass = (state: string) => {
    if (state === 'done') return 'bg-green-100 text-green-700 border-green-300';
    if (state === 'active') return 'bg-blue-100 text-blue-700 border-blue-300';
    if (state === 'rejected') return 'bg-red-100 text-red-700 border-red-300';
    return 'bg-slate-100 text-slate-500 border-slate-300';
};

export default function SuperTransferRequests({ requests, stats, tab, filters }: Props) {
    const [activeTab, setActiveTab] = useState(tab);
    const [search, setSearch] = useState(filters.search || '');
    const [selected, setSelected] = useState<RequestItem | null>(null);
    const [approveOpen, setApproveOpen] = useState(false);
    const [confirmProcessOpen, setConfirmProcessOpen] = useState(false);
    const [rejectOpen, setRejectOpen] = useState(false);
    const [detailsOpen, setDetailsOpen] = useState(false);

    const approveForm = useForm({ accounting_remarks: '', transfer_fee_amount: '', or_number: '' });
    const rejectForm = useForm({ accounting_remarks: '' });

    const onTab = (value: string) => {
        setActiveTab(value);
        router.get('/super-accounting/transfer-requests', { tab: value, search: filters.search }, { preserveState: true, replace: true });
    };

    const onSearch = () => {
        router.get('/super-accounting/transfer-requests', { tab: activeTab, search }, { preserveState: true, replace: true });
    };

    return (
        <SuperAccountingLayout>
            <Head title="Transfer Requests" />
            <div className="p-6 space-y-6 overflow-x-hidden">
                <PageHeader title="Transfer Request Approvals" description="Super accounting oversight for transfer out requests." />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card><CardHeader><CardTitle className="text-sm">Pending</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{stats.pending}</div></CardContent></Card>
                    <Card><CardHeader><CardTitle className="text-sm">Approved</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{stats.approved}</div></CardContent></Card>
                    <Card><CardHeader><CardTitle className="text-sm">Rejected</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{stats.rejected}</div></CardContent></Card>
                </div>

                <Card>
                    <CardContent className="pt-6 space-y-4">
                        <div className="flex gap-2">
                            <div className="relative flex-1 max-w-sm">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && onSearch()} placeholder="Search by student..." />
                            </div>
                            <Button onClick={onSearch}>Search</Button>
                        </div>

                        <Tabs value={activeTab} onValueChange={onTab}>
                            <TabsList>
                                <TabsTrigger value="pending">Pending ({stats.pending})</TabsTrigger>
                                <TabsTrigger value="approved">Approved ({stats.approved})</TabsTrigger>
                                <TabsTrigger value="rejected">Rejected ({stats.rejected})</TabsTrigger>
                            </TabsList>
                            <TabsContent value={activeTab} className="mt-4">
                                <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Student</TableHead>
                                            <TableHead>Reason</TableHead>
                                            <TableHead>Flow</TableHead>
                                            <TableHead>Approvals</TableHead>
                                            <TableHead>Transfer Out Fee</TableHead>
                                            <TableHead>Payment Progress</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {requests.data.length === 0 ? (
                                            <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">No transfer requests found.</TableCell></TableRow>
                                        ) : requests.data.map((item) => (
                                            <TableRow
                                                key={item.id}
                                                className="cursor-pointer hover:bg-muted/40"
                                                onClick={() => {
                                                    setSelected(item);
                                                    setDetailsOpen(true);
                                                }}
                                            >
                                                <TableCell>
                                                    <div className="flex items-center gap-3">
                                                        <Avatar>
                                                            <AvatarImage src={item.student.student_photo_url || undefined} />
                                                            <AvatarFallback>{item.student.full_name.slice(0, 2).toUpperCase()}</AvatarFallback>
                                                        </Avatar>
                                                        <div>
                                                            <div className="font-medium">{item.student.full_name}</div>
                                                            <div className="text-xs text-muted-foreground">{item.student.lrn}</div>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="max-w-[280px] truncate" title={item.reason}>{item.reason}</TableCell>
                                                <TableCell>
                                                    <div className="space-y-2">
                                                        <div className="flex items-center gap-1 text-xs">
                                                            {[1, 2, 3, 4].map((step) => {
                                                                const state = getStepState(item, step);
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
                                                        <div className="text-[11px] text-muted-foreground">
                                                            1 {stepLabel(1)} · 2 {stepLabel(2)} · 3 {stepLabel(3)} · 4 {stepLabel(4)}
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="space-y-1 text-xs">
                                                        <div>
                                                            <span className="font-medium">Registrar:</span>{' '}
                                                            {item.registrar_approved_by?.username || item.registrar_approved_by?.name || '—'}
                                                            {item.registrar_approved_at ? ` (${item.registrar_approved_at})` : ''}
                                                        </div>
                                                        <div>
                                                            <span className="font-medium">Super-Accounting:</span>{' '}
                                                            {item.accounting_approved_by?.username || item.accounting_approved_by?.name || '—'}
                                                            {item.accounting_approved_at ? ` (${item.accounting_approved_at})` : ''}
                                                        </div>
                                                        <div>
                                                            <span className="font-medium">Finalized:</span>{' '}
                                                            {item.finalized_by?.username || item.finalized_by?.name || '—'}
                                                            {item.finalized_at ? ` (${item.finalized_at})` : ''}
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    {item.transfer_fee_amount > 0 ? (
                                                        <div className="space-y-1 text-xs">
                                                            <div className="font-semibold">{currency(item.transfer_fee_amount)}</div>
                                                            <Badge className={item.transfer_fee_paid ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-amber-100 text-amber-800 border border-amber-200'}>
                                                                {item.transfer_fee_paid ? 'Paid' : 'Unpaid'}
                                                            </Badge>
                                                            {item.transfer_fee_or_number && <div>OR: {item.transfer_fee_or_number}</div>}
                                                        </div>
                                                    ) : (
                                                        <span className="text-muted-foreground">Not set</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {item.transfer_fee_amount > 0 ? (
                                                        <div className="space-y-1 text-xs">
                                                            <div>Paid Online: <span className="font-semibold">{currency(item.transfer_online_paid_amount)}</span></div>
                                                            <div>Balance Due: <span className={`font-semibold ${item.transfer_balance_due > 0 ? 'text-amber-700' : 'text-green-700'}`}>{currency(item.transfer_balance_due)}</span></div>
                                                            <Badge className={item.transfer_balance_due <= 0 ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-amber-100 text-amber-800 border border-amber-200'}>
                                                                {item.transfer_balance_due <= 0 ? 'Settled' : 'Awaiting Full Payment'}
                                                            </Badge>
                                                        </div>
                                                    ) : (
                                                        <span className="text-muted-foreground">N/A</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>{statusBadge(item.accounting_status)}</TableCell>
                                                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                                    {item.accounting_status === 'pending' ? (
                                                        <div className="flex justify-end gap-2">
                                                            <Button size="sm" variant="outline" onClick={() => { setSelected(item); approveForm.reset(); setApproveOpen(true); }}><ThumbsUp className="h-4 w-4 text-green-600" /></Button>
                                                            <Button size="sm" variant="outline" onClick={() => { setSelected(item); rejectForm.reset(); setRejectOpen(true); }}><ThumbsDown className="h-4 w-4 text-red-600" /></Button>
                                                        </div>
                                                    ) : item.accounting_status === 'approved' && item.transfer_fee_amount > 0 && item.transfer_balance_due > 0 ? (
                                                        <span className="text-xs text-amber-700">Awaiting full settlement</span>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground">Processed</span>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                                </div>
                            </TabsContent>
                        </Tabs>
                    </CardContent>
                </Card>

                <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
                    <DialogContent className="max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>Transfer Request Details</DialogTitle>
                            <DialogDescription>
                                Student-submitted details for transfer out request.
                            </DialogDescription>
                        </DialogHeader>
                        {selected && (
                            <div className="grid gap-2 text-sm">
                                <div><strong>Reason:</strong> {selected.reason || '—'}</div>
                                <div><strong>New School:</strong> {selected.new_school_name || '—'}</div>
                                <div><strong>New School Address:</strong> {selected.new_school_address || '—'}</div>
                                <div><strong>Receiving Contact Person:</strong> {selected.receiving_contact_person || '—'}</div>
                                <div><strong>Receiving Contact Number:</strong> {selected.receiving_contact_number || '—'}</div>
                                <div><strong>Months Stayed Enrolled:</strong> {selected.months_stayed_enrolled || '—'}</div>
                                <div><strong>Subjects Completed:</strong> {selected.subjects_completed || '—'}</div>
                                <div><strong>Incomplete Subjects:</strong> {selected.incomplete_subjects || '—'}</div>
                                <div><strong>Has Pending Requirements:</strong> {selected.has_pending_requirements ? 'Yes' : 'No'}</div>
                                <div><strong>Pending Requirements Details:</strong> {selected.pending_requirements_details || '—'}</div>
                                <div><strong>Requesting Documents:</strong> {selected.requesting_documents ? 'Yes' : 'No'}</div>
                                <div><strong>Requested Documents:</strong> {selected.requested_documents || '—'}</div>
                                <div><strong>Issued Items:</strong> {selected.issued_items || '—'}</div>
                                <div><strong>Student Notes:</strong> {selected.student_notes || '—'}</div>
                            </div>
                        )}
                    </DialogContent>
                </Dialog>

                <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Process Transfer Request</DialogTitle>
                            <DialogDescription>Set transfer out fee for student payment, then forward to registrar finalization.</DialogDescription>
                        </DialogHeader>
                        {selected && (
                            <div className="space-y-2 text-sm">
                                <div><strong>Student note:</strong> {selected.student_notes || '—'}</div>
                                <div><strong>Registrar remark:</strong> {selected.registrar_remarks || '—'}</div>
                            </div>
                        )}
                        <div className="space-y-2">
                            <Label>Transfer Out Fee Amount</Label>
                            <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={approveForm.data.transfer_fee_amount}
                                onChange={(e) => approveForm.setData('transfer_fee_amount', e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Super-Accounting Remarks (Optional)</Label>
                            <Textarea value={approveForm.data.accounting_remarks} onChange={(e) => approveForm.setData('accounting_remarks', e.target.value)} rows={3} />
                        </div>
                        <div className="space-y-2">
                            <Label>OR Number</Label>
                            <Input value={approveForm.data.or_number} onChange={(e) => approveForm.setData('or_number', e.target.value)} />
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setApproveOpen(false)}>Cancel</Button>
                            <Button onClick={() => {
                                if (!selected) return;

                                const fee = Number(approveForm.data.transfer_fee_amount || 0);
                                if (fee > 0 && !approveForm.data.or_number.trim()) {
                                    alert('OR Number is required when marking transfer fee as paid.');
                                    return;
                                }
                                setConfirmProcessOpen(true);
                            }}>Approve</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <Dialog open={confirmProcessOpen} onOpenChange={setConfirmProcessOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Confirm Payment Processing</DialogTitle>
                            <DialogDescription>
                                Please note that once the payment has been processed, it is final and cannot be undone.
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setConfirmProcessOpen(false)}>Cancel</Button>
                            <Button onClick={() => {
                                if (!selected) return;

                                approveForm.post(`/super-accounting/transfer-requests/${selected.id}/approve`, {
                                    onSuccess: () => {
                                        setConfirmProcessOpen(false);
                                        setApproveOpen(false);
                                    },
                                });
                            }}>Save</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Reject Transfer Request</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-2">
                            <Label>Reason</Label>
                            <Textarea value={rejectForm.data.accounting_remarks} onChange={(e) => rejectForm.setData('accounting_remarks', e.target.value)} rows={3} />
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
                            <Button variant="destructive" onClick={() => selected && rejectForm.post(`/super-accounting/transfer-requests/${selected.id}/reject`, { onSuccess: () => setRejectOpen(false) })}>Reject</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

            </div>
        </SuperAccountingLayout>
    );
}
