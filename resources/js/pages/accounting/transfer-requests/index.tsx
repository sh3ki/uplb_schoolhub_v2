import { Head, router, useForm } from '@inertiajs/react';
import { AlertTriangle, CheckCircle2, Clock, Search, ThumbsDown, ThumbsUp, UserRoundX, XCircle } from 'lucide-react';
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
import AccountingLayout from '@/layouts/accounting-layout';

type RequestItem = {
    id: number;
    reason: string;
    accounting_status: 'pending' | 'approved' | 'rejected';
    registrar_status: 'pending' | 'approved' | 'rejected';
    school_year: string | null;
    semester: string | null;
    accounting_remarks: string | null;
    outstanding_balance: number;
    current_outstanding_balance: number;
    balance_override: boolean;
    balance_override_reason: string | null;
    student: {
        id: number;
        full_name: string;
        lrn: string;
        student_photo_url: string | null;
        program: string | null;
        year_level: string | null;
        section: string | null;
    };
};

type Props = {
    requests: { data: RequestItem[] };
    stats: { pending: number; approved: number; rejected: number };
    tab: string;
    filters: { search?: string };
};

const currency = (amount: number) => `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const statusBadge = (status: string) => {
    if (status === 'approved') return <Badge className="bg-green-100 text-green-800 border border-green-200">Approved</Badge>;
    if (status === 'rejected') return <Badge className="bg-red-100 text-red-800 border border-red-200">Rejected</Badge>;
    return <Badge className="bg-amber-100 text-amber-800 border border-amber-200">Pending</Badge>;
};

export default function AccountingTransferRequests({ requests, stats, tab, filters }: Props) {
    const [activeTab, setActiveTab] = useState(tab);
    const [search, setSearch] = useState(filters.search || '');
    const [selected, setSelected] = useState<RequestItem | null>(null);
    const [approveOpen, setApproveOpen] = useState(false);
    const [rejectOpen, setRejectOpen] = useState(false);

    const approveForm = useForm({ accounting_remarks: '', override_with_balance: false, override_reason: '' });
    const rejectForm = useForm({ accounting_remarks: '' });

    const onTab = (value: string) => {
        setActiveTab(value);
        router.get('/accounting/transfer-requests', { tab: value, search: filters.search }, { preserveState: true, replace: true });
    };

    const onSearch = () => {
        router.get('/accounting/transfer-requests', { tab: activeTab, search }, { preserveState: true, replace: true });
    };

    return (
        <AccountingLayout>
            <Head title="Transfer Requests" />
            <div className="p-6 space-y-6">
                <PageHeader title="Transfer Request Approvals" description="Accounting final review for transfer out requests." />

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
                                            <TableHead>Outstanding Balance</TableHead>
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
                                                <TableCell className="max-w-[300px] truncate" title={item.reason}>{item.reason}</TableCell>
                                                <TableCell>
                                                    <div className="text-sm font-medium">{currency(item.current_outstanding_balance)}</div>
                                                    {item.balance_override && <div className="text-xs text-amber-700">Override used</div>}
                                                </TableCell>
                                                <TableCell>{statusBadge(item.accounting_status)}</TableCell>
                                                <TableCell className="text-right">
                                                    {item.accounting_status === 'pending' ? (
                                                        <div className="flex justify-end gap-2">
                                                            <Button size="sm" variant="outline" onClick={() => { setSelected(item); approveForm.reset(); approveForm.setData('override_with_balance', false); setApproveOpen(true); }}><ThumbsUp className="h-4 w-4 text-green-600" /></Button>
                                                            <Button size="sm" variant="outline" onClick={() => { setSelected(item); rejectForm.reset(); setRejectOpen(true); }}><ThumbsDown className="h-4 w-4 text-red-600" /></Button>
                                                        </div>
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
                            <DialogTitle>Approve Transfer Request</DialogTitle>
                            <DialogDescription>Accounting approval forwards this to registrar finalization.</DialogDescription>
                        </DialogHeader>

                        {selected && selected.current_outstanding_balance > 0 && (
                            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 flex gap-2">
                                <AlertTriangle className="h-4 w-4 mt-0.5" />
                                <div>
                                    Student has outstanding balance: <strong>{currency(selected.current_outstanding_balance)}</strong>
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label>Remarks (Optional)</Label>
                            <Textarea value={approveForm.data.accounting_remarks} onChange={(e) => approveForm.setData('accounting_remarks', e.target.value)} rows={3} />
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <Checkbox id="override_with_balance" checked={approveForm.data.override_with_balance} onCheckedChange={(checked) => approveForm.setData('override_with_balance', checked === true)} />
                                <Label htmlFor="override_with_balance">Allow transfer despite outstanding balance</Label>
                            </div>
                            {approveForm.data.override_with_balance && (
                                <Textarea placeholder="Reason for override" value={approveForm.data.override_reason} onChange={(e) => approveForm.setData('override_reason', e.target.value)} rows={3} />
                            )}
                        </div>

                        <DialogFooter>
                            <Button variant="outline" onClick={() => setApproveOpen(false)}>Cancel</Button>
                            <Button onClick={() => selected && approveForm.post(`/accounting/transfer-requests/${selected.id}/approve`, { onSuccess: () => setApproveOpen(false) })}>Approve</Button>
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
                            <Button variant="destructive" onClick={() => selected && rejectForm.post(`/accounting/transfer-requests/${selected.id}/reject`, { onSuccess: () => setRejectOpen(false) })}>Reject</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </AccountingLayout>
    );
}
