import { Head, router, useForm } from '@inertiajs/react';
import { CalendarDays, CheckCircle2, Clock, Search, ThumbsDown, ThumbsUp, UserRoundX, XCircle } from 'lucide-react';
import { useState } from 'react';
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
import RegistrarLayout from '@/layouts/registrar/registrar-layout';

type RequestItem = {
    id: number;
    reason: string;
    status: 'pending' | 'approved' | 'rejected';
    registrar_status: 'pending' | 'approved' | 'rejected';
    accounting_status: 'pending' | 'approved' | 'rejected';
    school_year: string | null;
    semester: string | null;
    registrar_remarks: string | null;
    accounting_remarks: string | null;
    created_at: string;
    student: {
        id: number;
        full_name: string;
        lrn: string;
        student_photo_url: string | null;
        enrollment_status: string;
        is_active: boolean;
        program: string | null;
        year_level: string | null;
        section: string | null;
    };
};

type Props = {
    requests: {
        data: RequestItem[];
    };
    stats: { pending: number; approved: number; rejected: number };
    tab: string;
    filters: { search?: string };
    transferRequestDeadline: string | null;
};

const statusBadge = (status: string) => {
    if (status === 'approved') return <Badge className="bg-green-100 text-green-800 border border-green-200">Approved</Badge>;
    if (status === 'rejected') return <Badge className="bg-red-100 text-red-800 border border-red-200">Rejected</Badge>;
    return <Badge className="bg-amber-100 text-amber-800 border border-amber-200">Pending</Badge>;
};

export default function RegistrarTransferRequests({ requests, stats, tab, filters, transferRequestDeadline }: Props) {
    const [activeTab, setActiveTab] = useState(tab);
    const [search, setSearch] = useState(filters.search || '');
    const [selected, setSelected] = useState<RequestItem | null>(null);
    const [approveOpen, setApproveOpen] = useState(false);
    const [rejectOpen, setRejectOpen] = useState(false);
    const [deadlineOpen, setDeadlineOpen] = useState(false);

    const approveForm = useForm({ registrar_remarks: '' });
    const rejectForm = useForm({ registrar_remarks: '' });
    const deadlineForm = useForm({ transfer_request_deadline: transferRequestDeadline || '' });

    const onTab = (value: string) => {
        setActiveTab(value);
        router.get('/registrar/transfer-requests', { tab: value, search: filters.search }, { preserveState: true, replace: true });
    };

    const onSearch = () => {
        router.get('/registrar/transfer-requests', { tab: activeTab, search }, { preserveState: true, replace: true });
    };

    const finalize = (requestId: number) => {
        if (!confirm('Finalize this transfer out request? This deactivates student login.')) return;
        router.post(`/registrar/transfer-requests/${requestId}/finalize`);
    };

    const reactivate = (studentId: number) => {
        if (!confirm('Reactivate this student account?')) return;
        router.post(`/registrar/transfer-requests/students/${studentId}/reactivate`);
    };

    return (
        <RegistrarLayout>
            <Head title="Transfer Requests" />
            <div className="space-y-6 p-6">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold">Transfer Requests</h1>
                        <p className="text-muted-foreground text-sm mt-1">Registrar stage for transfer out workflow.</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setDeadlineOpen(true)}>
                        <CalendarDays className="h-4 w-4 mr-2" />
                        {transferRequestDeadline ? 'Edit Deadline' : 'Set Deadline'}
                    </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="cursor-pointer" onClick={() => onTab('pending')}><CardHeader><CardTitle className="text-sm">Pending</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{stats.pending}</div></CardContent></Card>
                    <Card className="cursor-pointer" onClick={() => onTab('approved')}><CardHeader><CardTitle className="text-sm">Approved</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{stats.approved}</div></CardContent></Card>
                    <Card className="cursor-pointer" onClick={() => onTab('rejected')}><CardHeader><CardTitle className="text-sm">Rejected</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{stats.rejected}</div></CardContent></Card>
                </div>

                <div className="flex items-center gap-2">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && onSearch()} placeholder="Search student..." />
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
                        <Card>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Student</TableHead>
                                            <TableHead>Program / Year</TableHead>
                                            <TableHead>Reason</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Accounting</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {requests.data.length === 0 ? (
                                            <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">No transfer requests found.</TableCell></TableRow>
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
                                                <TableCell>
                                                    <div className="text-sm">{item.student.program || '—'}</div>
                                                    <div className="text-xs text-muted-foreground">{[item.student.year_level, item.student.section].filter(Boolean).join(' - ') || '—'}</div>
                                                </TableCell>
                                                <TableCell className="max-w-[280px] truncate" title={item.reason}>{item.reason}</TableCell>
                                                <TableCell>{statusBadge(item.registrar_status)}</TableCell>
                                                <TableCell>{statusBadge(item.accounting_status)}</TableCell>
                                                <TableCell className="text-right">
                                                    {item.registrar_status === 'pending' ? (
                                                        <div className="flex justify-end gap-2">
                                                            <Button size="sm" variant="outline" onClick={() => { setSelected(item); approveForm.reset(); setApproveOpen(true); }}><ThumbsUp className="h-4 w-4 text-green-600" /></Button>
                                                            <Button size="sm" variant="outline" onClick={() => { setSelected(item); rejectForm.reset(); setRejectOpen(true); }}><ThumbsDown className="h-4 w-4 text-red-600" /></Button>
                                                        </div>
                                                    ) : item.accounting_status === 'approved' && item.student.is_active ? (
                                                        <Button size="sm" onClick={() => finalize(item.id)}>Finalize</Button>
                                                    ) : !item.student.is_active ? (
                                                        <Button size="sm" variant="outline" onClick={() => reactivate(item.student.id)}>Reactivate</Button>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground">Processed</span>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>

                <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Approve Transfer Request</DialogTitle>
                            <DialogDescription>This sends the request to accounting for final approval.</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-2">
                            <Label>Remarks (Optional)</Label>
                            <Textarea value={approveForm.data.registrar_remarks} onChange={(e) => approveForm.setData('registrar_remarks', e.target.value)} rows={4} />
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setApproveOpen(false)}>Cancel</Button>
                            <Button onClick={() => selected && approveForm.post(`/registrar/transfer-requests/${selected.id}/approve`, { onSuccess: () => setApproveOpen(false) })}>Approve</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Reject Transfer Request</DialogTitle>
                            <DialogDescription>Provide reason for rejection.</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-2">
                            <Label>Remarks</Label>
                            <Textarea value={rejectForm.data.registrar_remarks} onChange={(e) => rejectForm.setData('registrar_remarks', e.target.value)} rows={4} />
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
                            <Button variant="destructive" onClick={() => selected && rejectForm.post(`/registrar/transfer-requests/${selected.id}/reject`, { onSuccess: () => setRejectOpen(false) })}>Reject</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <Dialog open={deadlineOpen} onOpenChange={setDeadlineOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Transfer Request Deadline</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-2">
                            <Label htmlFor="transfer_request_deadline">Deadline</Label>
                            <Input id="transfer_request_deadline" type="date" value={deadlineForm.data.transfer_request_deadline} onChange={(e) => deadlineForm.setData('transfer_request_deadline', e.target.value)} />
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setDeadlineOpen(false)}>Cancel</Button>
                            <Button variant="outline" onClick={() => {
                                deadlineForm.setData('transfer_request_deadline', '');
                                router.post('/registrar/transfer-requests/set-deadline', {
                                    transfer_request_deadline: '',
                                }, {
                                    onSuccess: () => setDeadlineOpen(false),
                                });
                            }}>Clear</Button>
                            <Button onClick={() => {
                                router.post('/registrar/transfer-requests/set-deadline', {
                                    transfer_request_deadline: deadlineForm.data.transfer_request_deadline || null,
                                }, {
                                    onSuccess: () => setDeadlineOpen(false),
                                });
                            }}>Save</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </RegistrarLayout>
    );
}
