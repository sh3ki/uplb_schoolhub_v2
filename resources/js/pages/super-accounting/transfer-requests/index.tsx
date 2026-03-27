import { Head, router, useForm } from '@inertiajs/react';
import { Search, ThumbsDown, ThumbsUp } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
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
    accounting_status: 'pending' | 'approved' | 'rejected';
    transfer_fee_amount: number;
    transfer_fee_paid: boolean;
    transfer_fee_or_number: string | null;
    student_notes: string | null;
    registrar_remarks: string | null;
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

export default function SuperTransferRequests({ requests, stats, tab, filters }: Props) {
    const [activeTab, setActiveTab] = useState(tab);
    const [search, setSearch] = useState(filters.search || '');
    const [selected, setSelected] = useState<RequestItem | null>(null);
    const [approveOpen, setApproveOpen] = useState(false);
    const [rejectOpen, setRejectOpen] = useState(false);
    const [markPaidOpen, setMarkPaidOpen] = useState(false);

    const approveForm = useForm({ accounting_remarks: '', transfer_fee_amount: '', mark_as_paid: false, or_number: '' });
    const rejectForm = useForm({ accounting_remarks: '' });
    const markPaidForm = useForm({ or_number: '', transfer_fee_amount: '' });

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
            <div className="p-6 space-y-6">
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
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Student</TableHead>
                                            <TableHead>Reason</TableHead>
                                            <TableHead>Transfer Out Fee</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {requests.data.length === 0 ? (
                                            <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground">No transfer requests found.</TableCell></TableRow>
                                        ) : requests.data.map((item) => (
                                            <TableRow key={item.id}>
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
                                                <TableCell>{statusBadge(item.accounting_status)}</TableCell>
                                                <TableCell className="text-right">
                                                    {item.accounting_status === 'pending' ? (
                                                        <div className="flex justify-end gap-2">
                                                            <Button size="sm" variant="outline" onClick={() => { setSelected(item); approveForm.reset(); setApproveOpen(true); }}><ThumbsUp className="h-4 w-4 text-green-600" /></Button>
                                                            <Button size="sm" variant="outline" onClick={() => { setSelected(item); rejectForm.reset(); setRejectOpen(true); }}><ThumbsDown className="h-4 w-4 text-red-600" /></Button>
                                                        </div>
                                                    ) : item.accounting_status === 'approved' && !item.transfer_fee_paid && item.transfer_fee_amount > 0 ? (
                                                        <Button size="sm" variant="outline" onClick={() => { setSelected(item); markPaidForm.reset(); setMarkPaidOpen(true); }}>
                                                            Mark Paid
                                                        </Button>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground">Processed</span>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TabsContent>
                        </Tabs>
                    </CardContent>
                </Card>

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
                            <div className="flex items-center gap-2">
                                <Checkbox id="mark_paid" checked={approveForm.data.mark_as_paid} onCheckedChange={(checked) => approveForm.setData('mark_as_paid', checked === true)} />
                                <Label htmlFor="mark_paid">Mark transfer fee as paid now</Label>
                            </div>
                            {approveForm.data.mark_as_paid && (
                                <div className="space-y-2">
                                    <Label>OR Number</Label>
                                    <Input value={approveForm.data.or_number} onChange={(e) => approveForm.setData('or_number', e.target.value)} />
                                </div>
                            )}
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setApproveOpen(false)}>Cancel</Button>
                            <Button onClick={() => selected && approveForm.post(`/super-accounting/transfer-requests/${selected.id}/approve`, { onSuccess: () => setApproveOpen(false) })}>Approve</Button>
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

                <Dialog open={markPaidOpen} onOpenChange={setMarkPaidOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Mark Transfer Fee as Paid</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-2">
                            <Label>OR Number</Label>
                            <Input value={markPaidForm.data.or_number} onChange={(e) => markPaidForm.setData('or_number', e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Transfer Fee Amount (Optional Override)</Label>
                            <Input type="number" min="0" step="0.01" value={markPaidForm.data.transfer_fee_amount} onChange={(e) => markPaidForm.setData('transfer_fee_amount', e.target.value)} />
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setMarkPaidOpen(false)}>Cancel</Button>
                            <Button onClick={() => selected && markPaidForm.post(`/super-accounting/transfer-requests/${selected.id}/mark-paid`, { onSuccess: () => setMarkPaidOpen(false) })}>Save</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </SuperAccountingLayout>
    );
}
