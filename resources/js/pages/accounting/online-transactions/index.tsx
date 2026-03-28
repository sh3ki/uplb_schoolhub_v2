import { Head, router } from '@inertiajs/react';
import {
    Check,
    Circle,
    Clock,
    Globe,
    MoreHorizontal,
    X,
    AlertTriangle,
    Undo2,
    ExternalLink,
    Eye,
} from 'lucide-react';
import { useState } from 'react';
import { FilterBar } from '@/components/filters/filter-bar';
import { FilterDropdown } from '@/components/filters/filter-dropdown';
import { SearchBar } from '@/components/filters/search-bar';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Pagination } from '@/components/ui/pagination';
import { PdfViewer } from '@/components/ui/pdf-viewer';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import AccountingLayout from '@/layouts/accounting-layout';

interface Student {
    id: number;
    full_name: string;
    lrn: string;
    email?: string;
}

interface OnlineTransaction {
    id: number;
    student_id: number;
    transaction_reference: string;
    payment_provider: string;
    amount: string;
    fee: string;
    net_amount: string;
    status: 'pending' | 'verified' | 'completed' | 'failed' | 'refunded';
    provider_reference?: string;
    provider_status?: string;
    payment_details?: Record<string, any>;
    payment_proof_url?: string;
    verified_at?: string;
    failed_at?: string;
    refunded_at?: string;
    failure_reason?: string;
    remarks?: string;
    or_number?: string;
    payment_context?: 'tuition' | 'transfer_out_fee';
    created_at: string;
    student: Student;
    verified_by?: { name: string };
}

interface PaginatedTransactions {
    data: OnlineTransaction[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    links: { url: string | null; label: string; active: boolean }[];
}

interface Props {
    transactions: PaginatedTransactions;
    providers: Record<string, string>;
    stats: {
        pending: number;
        verified: number;
        total_pending_amount: string;
        total_verified_today: string;
    };
    filters: {
        search?: string;
        status?: string;
        payment_method?: string;
        date_from?: string;
        date_to?: string;
    };
}

export default function OnlineTransactionsIndex({
    transactions,
    providers,
    stats,
    filters,
}: Props) {
    const [search, setSearch] = useState(filters.search || '');
    const [activeTab, setActiveTab] = useState((filters.status === 'completed' ? 'verified' : (filters.status || 'all')));
    const [provider, setProvider] = useState(filters.payment_method || 'all');

    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [selectedTransaction, setSelectedTransaction] = useState<OnlineTransaction | null>(null);
    const [isProofViewerOpen, setIsProofViewerOpen] = useState(false);
    const [proofViewerPath, setProofViewerPath] = useState<string | null>(null);
    const [proofViewerTitle, setProofViewerTitle] = useState('Payment Proof');

    const openProofViewer = (transaction: OnlineTransaction) => {
        if (!transaction.payment_proof_url) {
            return;
        }

        setProofViewerPath(transaction.payment_proof_url);
        setProofViewerTitle(`Payment Proof - ${transaction.transaction_reference}`);
        setIsProofViewerOpen(true);
    };

    const handleFilter = () => {
        router.get('/accounting/online-transactions', {
            search: search || undefined,
            status: activeTab !== 'all' ? activeTab : undefined,
            payment_method: provider !== 'all' ? provider : undefined,
        }, {
            preserveState: true,
            preserveScroll: true,
        });
    };

    const handleTabChange = (value: string) => {
        setActiveTab(value);
        router.get('/accounting/online-transactions', {
            search: search || undefined,
            status: value !== 'all' ? value : undefined,
            payment_method: provider !== 'all' ? provider : undefined,
        }, {
            preserveState: true,
            preserveScroll: true,
        });
    };

    const handleReset = () => {
        setSearch('');
        setActiveTab('all');
        setProvider('all');
        router.get('/accounting/online-transactions');
    };

    const handleVerify = (id: number) => {
        const orNumber = prompt('Enter OR number (leave blank to auto-generate):');
        if (orNumber !== null) {
            router.post(`/accounting/online-transactions/${id}/verify`, {
                or_number: orNumber || undefined,
            });
        }
    };

    const handleMarkFailed = (id: number) => {
        const reason = prompt('Enter failure reason:');
        if (reason) {
            router.post(`/accounting/online-transactions/${id}/failed`, {
                remarks: reason,
            });
        }
    };

    const formatCurrency = (amount: string | number) => {
        return `₱${parseFloat(amount.toString()).toLocaleString('en-PH', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })}`;
    };

    const formatDateTime = (dateString?: string) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleString('en-PH', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'pending':
                return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
            case 'verified':
            case 'completed':
                return <Badge className="bg-green-500"><Check className="h-3 w-3 mr-1" />Verified</Badge>;
            case 'failed':
                return <Badge variant="destructive"><X className="h-3 w-3 mr-1" />Failed</Badge>;
            case 'refunded':
                return <Badge className="bg-purple-500"><Undo2 className="h-3 w-3 mr-1" />Refunded</Badge>;
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    const getProviderIcon = (provider: string) => {
        switch (provider.toLowerCase()) {
            case 'gcash':
                return '';
            case 'bpi':
            case 'bdo':
            case 'metrobank':
            case 'bank':
                return '';
            default:
                return '';
        }
    };

    const statusOptions = [
        { value: 'pending', label: 'Pending' },
        { value: 'verified', label: 'Verified' },
        { value: 'failed', label: 'Failed' },
        { value: 'refunded', label: 'Refunded' },
    ];

    const providerOptions = providers ? Object.entries(providers).map(([value, label]) => ({ value, label })) : [];

    return (
        <AccountingLayout>
            <Head title="Online Transactions" />

            <div className="space-y-6 p-6">
                <PageHeader
                    title="Online Transactions"
                    description="Quick overview of online payments - verify, track, and manage digital transactions"
                />

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
                            <Clock className="h-4 w-4 text-yellow-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.pending}</div>
                            <p className="text-xs text-muted-foreground">Transactions awaiting verification</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Pending Amount</CardTitle>
                            <AlertTriangle className="h-4 w-4 text-orange-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-orange-600">{formatCurrency(stats.total_pending_amount)}</div>
                            <p className="text-xs text-muted-foreground">To be verified</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Verified Today</CardTitle>
                            <Check className="h-4 w-4 text-green-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-green-600">{formatCurrency(stats.total_verified_today)}</div>
                            <p className="text-xs text-muted-foreground">Successfully processed</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
                            <Globe className="h-4 w-4 text-blue-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {stats.pending + stats.verified > 0
                                    ? Math.round((stats.verified / (stats.pending + stats.verified)) * 100)
                                    : 100}%
                            </div>
                            <p className="text-xs text-muted-foreground">Verification rate</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Filters */}
                <FilterBar onReset={handleReset}>
                    <SearchBar
                        value={search}
                        onChange={(value) => {
                            setSearch(value);
                            if (value === '') handleFilter();
                        }}
                        placeholder="Search by student, reference..."
                    />
                    <FilterDropdown
                        label="Provider"
                        value={provider}
                        options={providerOptions}
                        onChange={(value) => {
                            setProvider(value);
                            setTimeout(handleFilter, 0);
                        }}
                    />
                    <Button onClick={handleFilter} className="mt-auto">
                        Apply Filters
                    </Button>
                </FilterBar>

                {/* Tabs */}
                <Tabs value={activeTab} onValueChange={handleTabChange}>
                    <TabsList>
                        <TabsTrigger value="all">All</TabsTrigger>
                        <TabsTrigger value="pending">Pending</TabsTrigger>
                        <TabsTrigger value="verified">Verified</TabsTrigger>
                        <TabsTrigger value="failed">Failed</TabsTrigger>
                        <TabsTrigger value="refunded">Refunded</TabsTrigger>
                    </TabsList>

                    <TabsContent value={activeTab} className="mt-6">
                        {/* Table */}
                        <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Reference</TableHead>
                                <TableHead>Student</TableHead>
                                <TableHead>Provider</TableHead>
                                <TableHead>Payment For</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {transactions.data.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                                        No online transactions found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                transactions.data.map((transaction) => (
                                    <TableRow
                                        key={transaction.id}
                                        className={`cursor-pointer hover:bg-muted/50 ${transaction.status === 'pending' ? 'bg-yellow-50/50' : ''}`}
                                        onClick={() => router.visit(`/accounting/payments/process/${transaction.student_id}?tab=transactions`)}
                                    >
                                        <TableCell>
                                            <div className="font-mono text-sm">{transaction.transaction_reference}</div>
                                            {transaction.provider_reference && (
                                                <div className="text-xs text-muted-foreground">
                                                    Provider: {transaction.provider_reference}
                                                </div>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <div>
                                                <div className="font-medium">{transaction.student.full_name}</div>
                                                <div className="text-sm text-muted-foreground">{transaction.student.lrn}</div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <span>{getProviderIcon(transaction.payment_provider)}</span>
                                                <span>{providers?.[transaction.payment_provider] || transaction.payment_provider}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="secondary" className={transaction.payment_context === 'transfer_out_fee' ? 'bg-violet-100 text-violet-800 border border-violet-200' : ''}>
                                                {transaction.payment_context === 'transfer_out_fee' ? 'Transfer Out Fee' : 'Tuition'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right font-medium">{formatCurrency(transaction.amount)}</TableCell>
                                        <TableCell>{getStatusBadge(transaction.status)}</TableCell>
                                        <TableCell>{formatDateTime(transaction.created_at)}</TableCell>
                                        <TableCell className="text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="sm" onClick={(e) => e.stopPropagation()}>
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={(e) => {
                                                        e.stopPropagation();
                                                        router.visit(`/accounting/payments/process/${transaction.student_id}?tab=transactions`);
                                                    }}>
                                                        <ExternalLink className="h-4 w-4 mr-2" />
                                                        View Account
                                                    </DropdownMenuItem>
                                                    {transaction.payment_proof_url && (
                                                        <DropdownMenuItem
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                openProofViewer(transaction);
                                                            }}
                                                        >
                                                            <Eye className="h-4 w-4 mr-2" />
                                                            View Uploaded File
                                                        </DropdownMenuItem>
                                                    )}
                                                    {transaction.status === 'pending' && (
                                                        <>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleVerify(transaction.id);
                                                                }}
                                                                className="text-green-600"
                                                            >
                                                                <Check className="h-4 w-4 mr-2" />
                                                                Verify
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleMarkFailed(transaction.id);
                                                                }}
                                                                className="text-red-600"
                                                            >
                                                                <X className="h-4 w-4 mr-2" />
                                                                Mark Failed
                                                            </DropdownMenuItem>
                                                        </>
                                                    )}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>

                {/* Pagination */}
                <Pagination 
                    data={{
                        ...transactions,
                        from: (transactions.current_page - 1) * transactions.per_page + 1,
                        to: Math.min(transactions.current_page * transactions.per_page, transactions.total),
                    }} 
                />
                    </TabsContent>
                </Tabs>
            </div>

            {/* Transaction Detail Modal */}
            <Dialog open={isDetailModalOpen} onOpenChange={(open) => {
                setIsDetailModalOpen(open);
                if (!open) setSelectedTransaction(null);
            }}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Transaction Details</DialogTitle>
                        <DialogDescription>
                            Full details of the online transaction
                        </DialogDescription>
                    </DialogHeader>
                    {selectedTransaction && (
                        <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <p className="text-muted-foreground">Reference</p>
                                    <p className="font-mono font-medium">{selectedTransaction.transaction_reference}</p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground">Provider Reference</p>
                                    <p className="font-mono">{selectedTransaction.provider_reference || '-'}</p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground">Student</p>
                                    <p className="font-medium">{selectedTransaction.student.full_name}</p>
                                    <p className="text-xs text-muted-foreground">{selectedTransaction.student.lrn}</p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground">Provider</p>
                                    <p className="flex items-center gap-2">
                                        {getProviderIcon(selectedTransaction.payment_provider)}
                                        {providers?.[selectedTransaction.payment_provider] || selectedTransaction.payment_provider}
                                    </p>
                                </div>
                            </div>

                            <div className="rounded-lg bg-muted p-4 space-y-2">
                                <div className="flex justify-between font-semibold">
                                    <span>Amount</span>
                                    <span className="text-lg">{formatCurrency(selectedTransaction.amount)}</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <p className="text-muted-foreground">Status</p>
                                    <div className="mt-1">{getStatusBadge(selectedTransaction.status)}</div>
                                </div>
                                <div>
                                    <p className="text-muted-foreground">Created</p>
                                    <p>{formatDateTime(selectedTransaction.created_at)}</p>
                                </div>
                                {selectedTransaction.verified_at && (
                                    <>
                                        <div>
                                            <p className="text-muted-foreground">Verified</p>
                                            <p>{formatDateTime(selectedTransaction.verified_at)}</p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground">Verified By</p>
                                            <p>{selectedTransaction.verified_by?.name || '-'}</p>
                                        </div>
                                        {selectedTransaction.or_number && (
                                            <div className="col-span-2">
                                                <p className="text-muted-foreground">OR Number</p>
                                                <p className="font-mono font-medium">{selectedTransaction.or_number}</p>
                                            </div>
                                        )}
                                    </>
                                )}
                                {selectedTransaction.failed_at && (
                                    <div className="col-span-2">
                                        <p className="text-muted-foreground">Failed</p>
                                        <p>{formatDateTime(selectedTransaction.failed_at)}</p>
                                        {selectedTransaction.failure_reason && (
                                            <p className="text-red-600 text-xs mt-1">{selectedTransaction.failure_reason}</p>
                                        )}
                                    </div>
                                )}
                                {selectedTransaction.refunded_at && (
                                    <div className="col-span-2">
                                        <p className="text-muted-foreground">Refunded</p>
                                        <p>{formatDateTime(selectedTransaction.refunded_at)}</p>
                                    </div>
                                )}
                            </div>

                            {selectedTransaction.remarks && (
                                <div className="text-sm">
                                    <p className="text-muted-foreground">Remarks</p>
                                    <p>{selectedTransaction.remarks}</p>
                                </div>
                            )}

                            {selectedTransaction.payment_proof_url && (
                                <div>
                                    <p className="text-muted-foreground text-sm mb-2">Payment Proof / Receipt Screenshot</p>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => openProofViewer(selectedTransaction)}
                                    >
                                        <Eye className="h-4 w-4 mr-2" />
                                        Open Uploaded File
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDetailModalOpen(false)}>
                            Close
                        </Button>
                        {selectedTransaction?.status === 'pending' && (
                            <>
                                <Button
                                    onClick={() => {
                                        handleVerify(selectedTransaction.id);
                                        setIsDetailModalOpen(false);
                                    }}
                                >
                                    <Check className="h-4 w-4 mr-2" />
                                    Verify
                                </Button>
                            </>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {proofViewerPath && (
                <PdfViewer
                    open={isProofViewerOpen}
                    onOpenChange={setIsProofViewerOpen}
                    title={proofViewerTitle}
                    filePath={proofViewerPath}
                />
            )}
        </AccountingLayout>
    );
}
