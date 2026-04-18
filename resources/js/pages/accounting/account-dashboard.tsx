import { Head, router, usePage } from '@inertiajs/react';
import {
    FileText,
    CreditCard,
    TrendingUp,
    RefreshCw,
    Search,
} from 'lucide-react';
import { useState } from 'react';
import type { DateRange } from 'react-day-picker';
import { ExportButton } from '@/components/export-button';
import { DateRangePicker } from '@/components/filters/date-range-picker';
import { FilterBar } from '@/components/filters/filter-bar';
import { FilterDropdown } from '@/components/filters/filter-dropdown';
import { PhilippinePeso } from '@/components/icons/philippine-peso';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import AccountingLayout from '@/layouts/accounting-layout';
import OwnerLayout from '@/layouts/owner/owner-layout';
import SuperAccountingLayout from '@/layouts/super-accounting/super-accounting-layout';

interface FilterOption {
    value: string;
    label: string;
}

interface Transaction {
    id: number | string;
    date: string;
    time: string;
    type: 'Fee' | 'Document' | 'Drop' | 'Transfer';
    student_name?: string | null;
    or_number: string;
    mode: string;
    reference: string | null;
    amount: number;
    student_id?: number;
    processed_by?: string;
}

interface Stats {
    total_transactions: number;
    fee_transactions: number;
    document_transactions: number;
    collection_rate: number;
    total_fees_processed: number;
    total_document_processed: number;
    total_amount_processed: number;
    overall_amount_processed: number;
}

interface DailyCollection {
    day: number;
    date: string;
    amount: number;
    time: string;
}

interface PaymentSummary {
    cash: number;
    gcash: number;
    bank: number;
}

interface Props {
    stats: Stats;
    transactions: Transaction[];
    dailyCollections: DailyCollection[];
    paymentSummary: PaymentSummary;
    accountingAccounts?: FilterOption[];
    accountingBreakdown?: {
        account_id: string;
        account_name: string;
        total_amount_processed: number;
    }[];
    departments: FilterOption[];
    programs: FilterOption[];
    yearLevels: FilterOption[];
    sections: FilterOption[];
    selectedMonth: number;
    selectedYear: number;
    schoolYears: string[];
    selectedSchoolYear: string;
    months: { value: number; label: string }[];
    years: number[];
    filters: {
        classification?: string;
        department_id?: string;
        program?: string;
        year_level?: string;
        section?: string;
        account_id?: string;
        date_from?: string;
        date_to?: string;
        month?: number;
        year?: number;
        school_year?: string;
    };
}

interface AppSettingsFlags {
    has_k12?: boolean | number | string | null;
    has_college?: boolean | number | string | null;
}

export default function AccountDashboard({
    stats,
    transactions,
    dailyCollections,
    paymentSummary,
    accountingAccounts = [],
    accountingBreakdown = [],
    departments = [],
    programs = [],
    yearLevels = [],
    sections = [],
    selectedMonth,
    selectedYear,
    schoolYears = [],
    selectedSchoolYear,
    months,
    filters,
}: Props) {
    const page = usePage<{ appSettings?: AppSettingsFlags }>();
    const { props } = page;
    const currentPath = page.url || '';
    const routePrefix = currentPath.startsWith('/owner/')
        ? 'owner'
        : currentPath.startsWith('/super-accounting/')
            ? 'super-accounting'
            : 'accounting';
    const basePath = `/${routePrefix}`;
    const paymentsProcessPath = `${basePath}/payments/process`;
    const AccountLayoutComponent = routePrefix === 'owner'
        ? OwnerLayout
        : routePrefix === 'super-accounting'
            ? SuperAccountingLayout
            : AccountingLayout;
    const isAcademicEnabled = (value: AppSettingsFlags['has_k12']) => {
        if (value === undefined || value === null) {
            return true;
        }

        if (typeof value === 'boolean') {
            return value;
        }

        if (typeof value === 'number') {
            return value === 1;
        }

        return value === '1' || value.toLowerCase() === 'true';
    };

    const hasK12 = isAcademicEnabled(props.appSettings?.has_k12);
    const hasCollege = isAcademicEnabled(props.appSettings?.has_college);
    const preferredClassificationOptions = [
        ...(hasK12 ? [{ value: 'K-12', label: 'K-12' }] : []),
        ...(hasCollege ? [{ value: 'College', label: 'College' }] : []),
    ];
    const classificationOptions = preferredClassificationOptions.length > 0
        ? preferredClassificationOptions
        : [
            { value: 'K-12', label: 'K-12' },
            { value: 'College', label: 'College' },
        ];

    const [classification, setClassification] = useState(filters.classification || '');
    const [departmentId, setDepartmentId]     = useState(filters.department_id || '');
    const [program, setProgram]               = useState(filters.program || '');
    const [yearLevel, setYearLevel]           = useState(filters.year_level || '');
    const [section, setSection]               = useState(filters.section || '');
    const [schoolYear, setSchoolYear]         = useState(filters.school_year || selectedSchoolYear || '');
    const [accountId, setAccountId]           = useState(filters.account_id || 'all');
    const [dateRange, setDateRange]           = useState<DateRange | undefined>(
        filters.date_from && filters.date_to
            ? { from: new Date(filters.date_from), to: new Date(filters.date_to) }
            : undefined
    );

    // Transaction History filters (client-side)
    const [txSearch, setTxSearch] = useState('');
    const [txType, setTxType]     = useState('');
    const [txMode, setTxMode]     = useState('');
    const [selectedTransferTx, setSelectedTransferTx] = useState<Transaction | null>(null);

    const filteredTransactions = (transactions || []).filter((tx) => {
        if (txSearch && !tx.or_number?.toLowerCase().includes(txSearch.toLowerCase())) return false;
        if (txType && tx.type !== txType) return false;
        if (txMode && tx.mode !== txMode) return false;
        return true;
    });

    const formatCurrency = (amount: number) => {
        return `₱ ${(amount || 0).toLocaleString('en-PH', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })}`;
    };

    const handleFilter = () => {
        router.get(`${basePath}/account-dashboard`, {
            classification: classification || undefined,
            department_id:  departmentId || undefined,
            program:        program || undefined,
            year_level:     yearLevel || undefined,
            section:        section || undefined,
            school_year:    schoolYear && schoolYear !== 'all' ? schoolYear : undefined,
            account_id:     routePrefix === 'super-accounting' && accountId !== 'all' ? accountId : undefined,
            date_from: dateRange?.from ? dateRange.from.toLocaleDateString('en-CA') : undefined,
            date_to:   dateRange?.to   ? dateRange.to.toLocaleDateString('en-CA')   : undefined,
        }, { preserveState: true, preserveScroll: true });
    };

    const handleReset = () => {
        setClassification('');
        setDepartmentId('');
        setProgram('');
        setYearLevel('');
        setSection('');
        setSchoolYear(selectedSchoolYear || '');
        setAccountId('all');
        setDateRange(undefined);
        router.get(`${basePath}/account-dashboard`);
    };

    // Find max for chart
    const maxAmount = Math.max(...(dailyCollections?.map(d => d.amount) || [1]), 1);

    return (
        <AccountLayoutComponent>
            <Head title="Account Dashboard" />

            <div className="space-y-6 p-6">
                <div className="flex items-center justify-between">
                    <PageHeader
                        title="Account Dashboard"
                        description="Payment transactions across all students for the selected period"
                    />
                    <div className="flex gap-2">
                        <ExportButton
                            exportUrl={`${basePath}/account-dashboard/export`}
                            filters={{
                                classification,
                                department_id: departmentId,
                                program,
                                year_level: yearLevel,
                                section,
                                school_year: schoolYear && schoolYear !== 'all' ? schoolYear : undefined,
                                account_id: routePrefix === 'super-accounting' && accountId !== 'all' ? accountId : undefined,
                                date_from: dateRange?.from ? dateRange.from.toLocaleDateString('en-CA') : undefined,
                                date_to: dateRange?.to ? dateRange.to.toLocaleDateString('en-CA') : undefined,
                            }}
                            buttonText="Export Data"
                        />
                        <Button variant="outline" onClick={() => window.location.reload()}>
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Refresh
                        </Button>
                    </div>
                </div>

                {/* Filters */}
                <FilterBar onReset={handleReset}>
                    <FilterDropdown
                        label="Classification"
                        value={classification || 'all'}
                        options={classificationOptions}
                        onChange={v => setClassification(v === 'all' ? '' : v)}
                        placeholder="All Classifications"
                    />
                    <FilterDropdown
                        label="Department"
                        value={departmentId || 'all'}
                        options={departments}
                        onChange={v => setDepartmentId(v === 'all' ? '' : v)}
                        placeholder="All Departments"
                    />
                    <FilterDropdown
                        label="Program"
                        value={program || 'all'}
                        options={programs}
                        onChange={v => setProgram(v === 'all' ? '' : v)}
                        placeholder="All Programs"
                    />
                    <FilterDropdown
                        label="Year Level"
                        value={yearLevel || 'all'}
                        options={yearLevels}
                        onChange={v => setYearLevel(v === 'all' ? '' : v)}
                        placeholder="All Year Levels"
                    />
                    <FilterDropdown
                        label="Section"
                        value={section || 'all'}
                        options={sections}
                        onChange={v => setSection(v === 'all' ? '' : v)}
                        placeholder="All Sections"
                    />
                    <FilterDropdown
                        label="School Year"
                        value={schoolYear || 'all'}
                        options={schoolYears.map((sy) => ({ value: sy, label: sy }))}
                        onChange={v => setSchoolYear(v === 'all' ? '' : v)}
                        placeholder="All School Years"
                    />
                    {routePrefix === 'super-accounting' && (
                        <FilterDropdown
                            label="Cashier/Account"
                            value={accountId}
                            options={[
                                { value: 'all', label: 'All Accounts' },
                                ...accountingAccounts,
                            ]}
                            onChange={setAccountId}
                            showAll={false}
                        />
                    )}
                    <DateRangePicker
                        label="Date Range"
                        value={dateRange}
                        onChange={setDateRange}
                        placeholder="Pick a date range"
                    />
                    <div className="flex items-end">
                        <Button size="sm" onClick={handleFilter} className="bg-blue-600 hover:bg-blue-700 text-white">
                            Apply Filters
                        </Button>
                    </div>
                </FilterBar>

                {/* Stats Cards — 8 cards in 2 rows of 4 */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Row 1: Counts */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <div className="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center">
                                <CreditCard className="h-6 w-6 text-blue-600" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats?.total_transactions ?? 0}</div>
                            <p className="text-sm text-muted-foreground">Total Transactions</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <div className="h-12 w-12 rounded-lg bg-green-100 flex items-center justify-center">
                                <PhilippinePeso className="h-6 w-6 text-green-600" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats?.fee_transactions ?? 0}</div>
                            <p className="text-sm text-muted-foreground">Fee Transactions</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <div className="h-12 w-12 rounded-lg bg-purple-100 flex items-center justify-center">
                                <FileText className="h-6 w-6 text-purple-600" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats?.document_transactions ?? 0}</div>
                            <p className="text-sm text-muted-foreground">Document Transactions</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <div className="h-12 w-12 rounded-lg bg-yellow-100 flex items-center justify-center">
                                <TrendingUp className="h-6 w-6 text-yellow-600" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-yellow-600">{stats?.collection_rate ?? 0}%</div>
                            <p className="text-sm text-muted-foreground">Collection Rate</p>
                        </CardContent>
                    </Card>

                    {/* Row 2: Amounts */}
                  
               
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <div className="h-12 w-12 rounded-lg bg-teal-100 flex items-center justify-center">
                                <CreditCard className="h-6 w-6 text-teal-600" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{formatCurrency(stats?.total_amount_processed ?? 0)}</div>
                            <p className="text-sm text-muted-foreground">Total Amount Process</p>
                        </CardContent>
                    </Card>
                      <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <div className="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center">
                                <PhilippinePeso className="h-6 w-6 text-blue-600" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{formatCurrency(stats?.total_fees_processed ?? 0)}</div>
                            <p className="text-sm text-muted-foreground">Total Fees Process</p>
                        </CardContent>
                    </Card>
                         <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <div className="h-12 w-12 rounded-lg bg-violet-100 flex items-center justify-center">
                                <FileText className="h-6 w-6 text-violet-600" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{formatCurrency(stats?.total_document_processed ?? 0)}</div>
                            <p className="text-sm text-muted-foreground">Total Document Process</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <div className="h-12 w-12 rounded-lg bg-orange-100 flex items-center justify-center">
                                <TrendingUp className="h-6 w-6 text-orange-600" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{formatCurrency(stats?.overall_amount_processed ?? 0)}</div>
                            <p className="text-sm text-muted-foreground">Overall Amount Process</p>
                        </CardContent>
                    </Card>
                </div>

                {routePrefix === 'super-accounting' && accountingBreakdown.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Processed Amount Per Account</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {accountingBreakdown.map((row) => (
                                    <div key={row.account_id} className="rounded-lg border p-3">
                                        <p className="text-sm text-muted-foreground">{row.account_name}</p>
                                        <p className="text-lg font-semibold text-emerald-600">
                                            {formatCurrency(row.total_amount_processed)}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Daily Collection Chart */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <PhilippinePeso className="h-5 w-5" />
                                Daily Collection (8:00 AM - 5:00 PM)
                            </CardTitle>
                        </div>
                        <span className="text-sm text-muted-foreground">
                            {filters.date_from && filters.date_to
                                ? `${filters.date_from} – ${filters.date_to}`
                                : `${months?.find(m => m.value === selectedMonth)?.label ?? ''} ${selectedYear}`}
                        </span>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-end justify-between gap-1 h-56 pt-4 overflow-x-auto">
                            {(dailyCollections || []).map((day, index) => {
                                const heightPercent = maxAmount > 0 ? (day.amount / maxAmount) * 100 : 0;
                                return (
                                    <div key={index} className="flex flex-col items-center gap-1 min-w-15">
                                        <div 
                                            className="w-10 bg-blue-600 rounded-t-md transition-all hover:bg-blue-700 cursor-pointer min-h-1"
                                            style={{ height: `${Math.max(heightPercent, 2)}%` }}
                                            title={`Day ${day.day}: ${formatCurrency(day.amount)}`}
                                        />
                                        <div className="text-center">
                                            <p className="text-xs font-medium">Day {day.day}</p>
                                            <p className="text-xs text-blue-600">{formatCurrency(day.amount)}</p>
                                            <p className="text-xs text-muted-foreground">({day.time})</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <p className="text-xs text-muted-foreground text-center mt-4">
                            ⏱ Business Hours: 8:00 AM - 5:00 PM
                        </p>
                    </CardContent>
                </Card>

                {/* Transaction History Table */}
                <Card>
                    <CardHeader>
                        <CardTitle>Transaction History</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col md:flex-row gap-3 mb-4">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search by OR number..."
                                    value={txSearch}
                                    onChange={(e) => setTxSearch(e.target.value)}
                                    className="pl-9"
                                />
                            </div>
                            <Select value={txType || 'all'} onValueChange={(v) => setTxType(v === 'all' ? '' : v)}>
                                <SelectTrigger className="w-37.5">
                                    <SelectValue placeholder="All Types" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Types</SelectItem>
                                    <SelectItem value="Fee">Fee</SelectItem>
                                    <SelectItem value="Document">Document</SelectItem>
                                    <SelectItem value="Drop">Drop</SelectItem>
                                    <SelectItem value="Transfer">Transfer</SelectItem>
                                </SelectContent>
                            </Select>
                            <Select value={txMode || 'all'} onValueChange={(v) => setTxMode(v === 'all' ? '' : v)}>
                                <SelectTrigger className="w-37.5">
                                    <SelectValue placeholder="All Modes" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Modes</SelectItem>
                                    <SelectItem value="CASH">CASH</SelectItem>
                                    <SelectItem value="GCASH">GCASH</SelectItem>
                                    <SelectItem value="BANK">BANK</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-slate-800 hover:bg-slate-800">
                                        <TableHead className="text-white">Date & Time</TableHead>
                                        <TableHead className="text-white">Student</TableHead>
                                        <TableHead className="text-white">Type</TableHead>
                                        <TableHead className="text-white">OR No.</TableHead>
                                        <TableHead className="text-white">Mode</TableHead>
                                        <TableHead className="text-white">Reference</TableHead>
                                        <TableHead className="text-white text-right">Amount</TableHead>
                                        <TableHead className="text-white">Processed By</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredTransactions.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                                                No transactions found for the selected period.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredTransactions.map((tx, index) => (
                                            <TableRow
                                                key={tx.id}
                                                className={tx.student_id ? 'cursor-pointer hover:bg-muted/60' : ''}
                                                onClick={() => {
                                                    if (!tx.student_id) {
                                                        return;
                                                    }

                                                    if (tx.type === 'Transfer') {
                                                        setSelectedTransferTx(tx);
                                                        return;
                                                    }

                                                    router.visit(`${paymentsProcessPath}/${tx.student_id}?tab=transactions`);
                                                }}
                                            >
                                                <TableCell>
                                                    #{index + 1} - {tx.date} {tx.time}
                                                </TableCell>
                                                <TableCell>{tx.student_name || 'N/A'}</TableCell>
                                                <TableCell>
                                                    <Badge
                                                        variant={tx.type === 'Fee' ? 'default' : 'secondary'}
                                                        className={`${tx.type === 'Fee' ? 'bg-blue-500 hover:bg-blue-600' : tx.type === 'Drop' ? 'bg-orange-500 hover:bg-orange-600' : tx.type === 'Transfer' ? 'bg-violet-500 hover:bg-violet-600' : 'bg-green-500 hover:bg-green-600'}`}
                                                    >
                                                        {tx.type}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="font-mono">{tx.or_number}</TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className={
                                                        tx.mode === 'CASH' ? 'border-green-500 text-green-600' :
                                                        tx.mode === 'GCASH' ? 'border-blue-500 text-blue-600' :
                                                        'border-purple-500 text-purple-600'
                                                    }>
                                                        {tx.mode}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>{tx.reference || 'N/A'}</TableCell>
                                                <TableCell className="text-right font-semibold">
                                                    {formatCurrency(tx.amount)}
                                                </TableCell>
                                                <TableCell>{tx.processed_by || '—'}</TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>

                <Dialog open={!!selectedTransferTx} onOpenChange={(open) => { if (!open) setSelectedTransferTx(null); }}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Transfer Transaction Details</DialogTitle>
                            <DialogDescription>
                                Transfer-out fee payment details from transaction history.
                            </DialogDescription>
                        </DialogHeader>
                        {selectedTransferTx && (
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between"><span className="text-muted-foreground">Date</span><span className="font-medium">{selectedTransferTx.date}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">Time</span><span className="font-medium">{selectedTransferTx.time}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">Reference No.</span><span className="font-mono">{selectedTransferTx.or_number || 'N/A'}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">Payment Mode</span><span className="font-medium">{selectedTransferTx.mode || 'N/A'}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">Amount</span><span className="font-semibold text-violet-700">{formatCurrency(selectedTransferTx.amount)}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">Processed By</span><span className="font-medium">{selectedTransferTx.processed_by || 'N/A'}</span></div>
                            </div>
                        )}
                    </DialogContent>
                </Dialog>

                {/* Payment Summary by Mode */}
                <Card>
                    <CardHeader>
                        <CardTitle>Payment Summary by Mode</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-wrap gap-8">
                            <div className="flex items-center gap-2">
                                <span className="font-medium">CASH:</span>
                                <span className="text-green-600 font-bold">{formatCurrency(paymentSummary?.cash ?? 0)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="font-medium">GCASH:</span>
                                <span className="text-blue-600 font-bold">{formatCurrency(paymentSummary?.gcash ?? 0)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="font-medium">BANK:</span>
                                <span className="text-purple-600 font-bold">{formatCurrency(paymentSummary?.bank ?? 0)}</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </AccountLayoutComponent>
    );
}
