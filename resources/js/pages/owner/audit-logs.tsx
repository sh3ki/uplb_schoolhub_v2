import { Head, router } from '@inertiajs/react';
import { useState } from 'react';
import OwnerLayout from '@/layouts/owner/owner-layout';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
    Receipt,
    Search,
    Filter,
    TrendingUp,
    Users,
    CalendarDays,
    Eye,
    X,
} from 'lucide-react';

interface StudentInfo {
    id: number;
    full_name: string;
    lrn: string;
    program: string | null;
    year_level: string | null;
}

interface CashierInfo {
    name: string;
    role: string;
}

interface Payment {
    id: number;
    student: StudentInfo | null;
    cashier: CashierInfo | null;
    amount: number;
    or_number: string | null;
    payment_method: string | null;
    payment_mode: string | null;
    payment_for: string | null;
    reference_number: string | null;
    notes: string | null;
    school_year: string | null;
    payment_date: string | null;
    created_at: string;
}

interface PaginatedData<T> {
    data: T[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    links: { url: string | null; label: string; active: boolean }[];
}

interface Props {
    payments: PaginatedData<Payment>;
    filters: {
        search?: string;
        school_year?: string;
        date_from?: string;
        date_to?: string;
    };
    schoolYears: string[];
    stats: {
        total_payments: number;
        total_collected: number;
        cashiers_count: number;
        today_count: number;
    };
}

function formatCurrency(amount: number | null): string {
    if (amount === null || amount === undefined) return 'N/A';
    return `₱${amount.toLocaleString('en-PH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

function formatMethod(method: string | null): string {
    if (!method) return '—';
    const map: Record<string, string> = {
        cash: 'Cash',
        gcash: 'GCash',
        bank: 'Bank Transfer',
        other: 'Other',
    };
    return map[method] ?? method;
}

export default function AuditLogs({ payments, filters, schoolYears, stats }: Props) {
    const [search, setSearch] = useState(filters.search || '');
    const [schoolYear, setSchoolYear] = useState(filters.school_year || 'all');
    const [dateFrom, setDateFrom] = useState(filters.date_from || '');
    const [dateTo, setDateTo] = useState(filters.date_to || '');

    const handleSearch = () => {
        router.get('/owner/audit-logs', {
            search: search || undefined,
            school_year: schoolYear !== 'all' ? schoolYear : undefined,
            date_from: dateFrom || undefined,
            date_to: dateTo || undefined,
        }, {
            preserveState: true,
            preserveScroll: true,
        });
    };

    const handleReset = () => {
        setSearch('');
        setSchoolYear('all');
        setDateFrom('');
        setDateTo('');
        router.get('/owner/audit-logs', {}, { preserveState: true });
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSearch();
    };

    return (
        <OwnerLayout>
            <Head title="Audit Logs - Payment Transactions" />

            <div className="space-y-6 p-6">
                <PageHeader
                    title="Audit Logs"
                    description="Monitor all cashier payment transactions. Every payment recorded by accounting staff appears here."
                />

                <div className="grid gap-4 md:grid-cols-4">
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-3">
                                <div className="rounded-lg bg-amber-100 p-2.5">
                                    <Receipt className="h-5 w-5 text-amber-700" />
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Total Transactions</p>
                                    <p className="text-2xl font-bold">{stats.total_payments}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-3">
                                <div className="rounded-lg bg-green-100 p-2.5">
                                    <TrendingUp className="h-5 w-5 text-green-700" />
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Total Collected</p>
                                    <p className="text-2xl font-bold text-green-600">{formatCurrency(stats.total_collected)}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-3">
                                <div className="rounded-lg bg-blue-100 p-2.5">
                                    <Users className="h-5 w-5 text-blue-700" />
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Cashiers Active</p>
                                    <p className="text-2xl font-bold">{stats.cashiers_count}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-3">
                                <div className="rounded-lg bg-purple-100 p-2.5">
                                    <CalendarDays className="h-5 w-5 text-purple-700" />
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Today</p>
                                    <p className="text-2xl font-bold">{stats.today_count}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <Card>
                    <CardContent className="pt-6">
                        <div className="flex flex-wrap items-end gap-4">
                            <div className="flex-1 min-w-[200px]">
                                <Label className="text-xs text-muted-foreground">Search</Label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        placeholder="Student name, LRN, OR number, or cashier name..."
                                        className="pl-9"
                                    />
                                </div>
                            </div>

                            <div className="w-40">
                                <Label className="text-xs text-muted-foreground">School Year</Label>
                                <Select value={schoolYear} onValueChange={setSchoolYear}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="All" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Years</SelectItem>
                                        {schoolYears.map((sy) => (
                                            <SelectItem key={sy} value={sy}>{sy}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="w-40">
                                <Label className="text-xs text-muted-foreground">From</Label>
                                <Input
                                    type="date"
                                    value={dateFrom}
                                    onChange={(e) => setDateFrom(e.target.value)}
                                />
                            </div>

                            <div className="w-40">
                                <Label className="text-xs text-muted-foreground">To</Label>
                                <Input
                                    type="date"
                                    value={dateTo}
                                    onChange={(e) => setDateTo(e.target.value)}
                                />
                            </div>

                            <Button onClick={handleSearch} size="sm">
                                <Filter className="h-4 w-4 mr-1" />
                                Filter
                            </Button>

                            {(filters.search || filters.school_year || filters.date_from || filters.date_to) && (
                                <Button variant="ghost" size="sm" onClick={handleReset}>
                                    <X className="h-4 w-4 mr-1" />
                                    Reset
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Receipt className="h-5 w-5 text-amber-600" />
                            Payment Transaction Logs
                        </CardTitle>
                        <CardDescription>
                            All payments recorded by accounting/cashier staff. Showing {payments.data.length} of {payments.total} records.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {payments.data.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground">
                                <Receipt className="h-12 w-12 mx-auto mb-4 text-muted-foreground/40" />
                                <p className="text-lg font-medium">No transactions found</p>
                                <p className="text-sm">Payment transactions recorded by cashiers will appear here.</p>
                            </div>
                        ) : (
                            <>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Date</TableHead>
                                            <TableHead>Student</TableHead>
                                            <TableHead>School Year</TableHead>
                                            <TableHead>OR #</TableHead>
                                            <TableHead className="text-right">Amount</TableHead>
                                            <TableHead>Method</TableHead>
                                            <TableHead>Cashier</TableHead>
                                            <TableHead className="text-center">Details</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {payments.data.map((payment) => (
                                            <TableRow key={payment.id} className="hover:bg-muted/50">
                                                <TableCell className="text-sm whitespace-nowrap">
                                                    {payment.payment_date || payment.created_at}
                                                </TableCell>
                                                <TableCell>
                                                    {payment.student ? (
                                                        <div>
                                                            <p className="font-medium">{payment.student.full_name}</p>
                                                            <p className="text-xs text-muted-foreground font-mono">{payment.student.lrn}</p>
                                                        </div>
                                                    ) : (
                                                        <span className="text-muted-foreground">—</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline">{payment.school_year || '—'}</Badge>
                                                </TableCell>
                                                <TableCell className="font-mono text-sm">
                                                    {payment.or_number || '—'}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <span className="font-semibold text-green-600">{formatCurrency(payment.amount)}</span>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="secondary">{formatMethod(payment.payment_method)}</Badge>
                                                </TableCell>
                                                <TableCell>
                                                    {payment.cashier ? (
                                                        <div>
                                                            <p className="text-sm font-medium">{payment.cashier.name}</p>
                                                            <Badge variant="outline" className="text-xs">{payment.cashier.role}</Badge>
                                                        </div>
                                                    ) : (
                                                        <span className="text-muted-foreground">—</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Dialog>
                                                        <DialogTrigger>
                                                            <Button variant="ghost" size="sm">
                                                                <Eye className="h-4 w-4" />
                                                            </Button>
                                                        </DialogTrigger>
                                                        <DialogContent className="sm:max-w-[480px]">
                                                            <DialogHeader>
                                                                <DialogTitle>Payment Transaction Details</DialogTitle>
                                                                <DialogDescription>
                                                                    Full details for this payment record.
                                                                </DialogDescription>
                                                            </DialogHeader>
                                                            <div className="space-y-4 py-4">
                                                                <div className="grid grid-cols-2 gap-4">
                                                                    <div>
                                                                        <p className="text-xs text-muted-foreground">Student</p>
                                                                        <p className="font-medium">{payment.student?.full_name || '—'}</p>
                                                                        <p className="text-xs text-muted-foreground font-mono">{payment.student?.lrn}</p>
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-xs text-muted-foreground">Program / Year</p>
                                                                        <p className="text-sm">{payment.student?.program || '—'}</p>
                                                                        <p className="text-xs text-muted-foreground">{payment.student?.year_level}</p>
                                                                    </div>
                                                                </div>
                                                                <div className="grid grid-cols-2 gap-4">
                                                                    <div>
                                                                        <p className="text-xs text-muted-foreground">Amount Paid</p>
                                                                        <p className="text-xl font-bold text-green-600">{formatCurrency(payment.amount)}</p>
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-xs text-muted-foreground">School Year</p>
                                                                        <p className="font-medium">{payment.school_year || '—'}</p>
                                                                    </div>
                                                                </div>
                                                                <div className="grid grid-cols-2 gap-4">
                                                                    <div>
                                                                        <p className="text-xs text-muted-foreground">OR Number</p>
                                                                        <p className="font-mono font-medium">{payment.or_number || '—'}</p>
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-xs text-muted-foreground">Payment Method</p>
                                                                        <Badge variant="secondary">{formatMethod(payment.payment_method)}</Badge>
                                                                    </div>
                                                                </div>
                                                                {payment.reference_number && (
                                                                    <div>
                                                                        <p className="text-xs text-muted-foreground">Reference Number</p>
                                                                        <p className="font-mono text-sm">{payment.reference_number}</p>
                                                                    </div>
                                                                )}
                                                                {payment.payment_for && (
                                                                    <div>
                                                                        <p className="text-xs text-muted-foreground">Payment For</p>
                                                                        <p className="text-sm bg-muted rounded-md p-2.5">{payment.payment_for}</p>
                                                                    </div>
                                                                )}
                                                                {payment.notes && (
                                                                    <div>
                                                                        <p className="text-xs text-muted-foreground">Notes</p>
                                                                        <p className="text-sm bg-muted rounded-md p-2.5">{payment.notes}</p>
                                                                    </div>
                                                                )}
                                                                <div className="border-t pt-3">
                                                                    <div className="grid grid-cols-2 gap-4">
                                                                        <div>
                                                                            <p className="text-xs text-muted-foreground">Recorded By</p>
                                                                            <p className="font-medium">{payment.cashier?.name || '—'}</p>
                                                                            {payment.cashier && <Badge variant="secondary" className="text-xs mt-1">{payment.cashier.role}</Badge>}
                                                                        </div>
                                                                        <div>
                                                                            <p className="text-xs text-muted-foreground">Payment Date</p>
                                                                            <p className="text-sm">{payment.payment_date}</p>
                                                                            <p className="text-xs text-muted-foreground">Logged: {payment.created_at}</p>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </DialogContent>
                                                    </Dialog>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>

                                {payments.last_page > 1 && (
                                    <div className="flex items-center justify-between pt-4 border-t mt-4">
                                        <p className="text-sm text-muted-foreground">
                                            Page {payments.current_page} of {payments.last_page}
                                        </p>
                                        <div className="flex gap-1">
                                            {payments.links.map((link, i) => (
                                                <Button
                                                    key={i}
                                                    variant={link.active ? 'default' : 'outline'}
                                                    size="sm"
                                                    disabled={!link.url}
                                                    onClick={() => {
                                                        if (link.url) {
                                                            router.get(link.url, {}, { preserveState: true, preserveScroll: true });
                                                        }
                                                    }}
                                                    dangerouslySetInnerHTML={{ __html: link.label }}
                                                    className="min-w-[36px]"
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>
        </OwnerLayout>
    );
}
