import { Head } from '@inertiajs/react';
import {
    Download,
    TrendingUp,
    Users,
    Wallet,
    DollarSign,
    Building2,
    CreditCard,
    BarChart3,
    FileText,
    Receipt,
    Clock,
    AlertCircle,
} from 'lucide-react';
import { useState } from 'react';
import { ReportsPageShell } from '@/components/reports/reports-page-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import OwnerLayout from '@/layouts/owner/owner-layout';
import type { BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Reports & Analytics', href: '/owner/reports' },
];

interface Summary {
    total_students: number;
    total_revenue: number;
    total_expected: number;
    total_balance: number;
    collection_rate: number;
}

interface FeeReportCategory {
    category: string;
    items: {
        name: string;
        selling_price: number;
        profit: number;
        students_availed: number;
        total_revenue: number;
        total_income: number;
    }[];
    total_revenue: number;
    total_income: number;
    total_assigned: number;
    total_collected: number;
}

interface DocumentFeeCategory {
    category: string;
    items: { name: string; price: number; students_availed: number; total_revenue: number }[];
    total_revenue: number;
}

interface DepartmentRow {
    department_id?: number;
    department: string;
    students: number;
    billed: number;
    collected: number;
    balance: number;
    collection_rate: number;
}

interface CashierRow {
    cashier: string;
    transaction_count: number;
    total_amount: number;
    cash_total: number;
    gcash_total: number;
    bank_total: number;
}

interface Transaction {
    id: number;
    or_number: string;
    date: string;
    student: string;
    amount: number;
    method: string;
    payment_for: string;
    cashier: string;
}

interface MonthlyPoint {
    month: string;
    amount: number;
}

interface ReportsProps {
    summary: Summary;
    school_year: string;
    feeReport: FeeReportCategory[];
    documentFeeReport: DocumentFeeCategory[];
    departmentAnalysis: DepartmentRow[];
    cashierSummary: CashierRow[];
    recentTransactions: Transaction[];
    monthlyTrend: MonthlyPoint[];
}

const fmt = (n: number) =>
    new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(n);

const pct = (val: number) => `${val.toFixed(1)}%`;

const methodColor: Record<string, string> = {
    cash: 'bg-green-100 text-green-700',
    gcash: 'bg-blue-100 text-blue-700',
    bank: 'bg-purple-100 text-purple-700',
};

function RateBar({ rate }: { rate: number }) {
    const color = rate >= 80 ? 'bg-green-500' : rate >= 50 ? 'bg-yellow-500' : 'bg-red-500';

    return (
        <div className="flex items-center gap-2">
            <div className="h-2 w-24 rounded-full bg-muted overflow-hidden">
                <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(rate, 100)}%` }} />
            </div>
            <span className="text-xs font-medium tabular-nums">{pct(rate)}</span>
        </div>
    );
}

export default function OwnerReports({
    summary,
    school_year,
    feeReport = [],
    documentFeeReport = [],
    departmentAnalysis = [],
    cashierSummary = [],
    recentTransactions = [],
    monthlyTrend = [],
}: ReportsProps) {
    const [txSearch, setTxSearch] = useState('');

    const navigateToDepartmentAccounts = (departmentId?: number) => {
        if (!departmentId) {
            return;
        }

        window.location.href = `/owner/account-dashboard?department_id=${departmentId}`;
    };

    const filteredTx = txSearch.trim()
        ? recentTransactions.filter(
              (transaction) =>
                  transaction.student.toLowerCase().includes(txSearch.toLowerCase()) ||
                  transaction.or_number.toLowerCase().includes(txSearch.toLowerCase()) ||
                  transaction.cashier.toLowerCase().includes(txSearch.toLowerCase()),
          )
        : recentTransactions;

    const maxMonthly = Math.max(...monthlyTrend.map((point) => point.amount), 1);
    const totalFeeRevenue = feeReport.reduce((sum, category) => sum + (category.total_collected ?? 0), 0);
    const totalFeeIncome = feeReport.reduce((sum, category) => sum + category.total_income, 0);
    const totalDocRevenue = documentFeeReport.reduce((sum, category) => sum + category.total_revenue, 0);
    const grandCollected = totalFeeRevenue + totalDocRevenue;

    return (
        <OwnerLayout breadcrumbs={breadcrumbs}>
            <Head title="Reports & Analytics" />

            <ReportsPageShell
                title="Reports & Analytics"
                description={`School Year ${school_year} - comprehensive financial overview`}
                action={
                    <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => (window.location.href = '/owner/reports/export/financial?format=csv')}>
                            <Download className="mr-2 h-4 w-4" /> Export Financial CSV
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => (window.location.href = '/owner/reports/export/students?format=csv')}>
                            <Download className="mr-2 h-4 w-4" /> Export Students CSV
                        </Button>
                    </div>
                }
            >

                <div className="grid gap-4 sm:grid-cols-3">
                    <a href="/owner/income/today" className="block">
                        <Card className="cursor-pointer border-l-4 border-l-green-500 transition-colors hover:bg-accent/40">
                            <CardContent className="flex items-center gap-4 p-4">
                                <div className="rounded-full bg-green-100 p-3">
                                    <Clock className="h-5 w-5 text-green-600" />
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">Today's Income</p>
                                    <p className="text-sm font-semibold">View real-time data -&gt;</p>
                                </div>
                            </CardContent>
                        </Card>
                    </a>
                    <a href="/owner/income/overall" className="block">
                        <Card className="cursor-pointer border-l-4 border-l-blue-500 transition-colors hover:bg-accent/40">
                            <CardContent className="flex items-center gap-4 p-4">
                                <div className="rounded-full bg-blue-100 p-3">
                                    <BarChart3 className="h-5 w-5 text-blue-600" />
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">Overall Income</p>
                                    <p className="text-sm font-semibold">All-time breakdown -&gt;</p>
                                </div>
                            </CardContent>
                        </Card>
                    </a>
                    <a href="/owner/income/expected" className="block">
                        <Card className="cursor-pointer border-l-4 border-l-orange-500 transition-colors hover:bg-accent/40">
                            <CardContent className="flex items-center gap-4 p-4">
                                <div className="rounded-full bg-orange-100 p-3">
                                    <TrendingUp className="h-5 w-5 text-orange-600" />
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">Expected Income</p>
                                    <p className="text-sm font-semibold">Projections &amp; targets -&gt;</p>
                                </div>
                            </CardContent>
                        </Card>
                    </a>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">Total Students</CardTitle>
                            <Users className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{summary.total_students.toLocaleString()}</div>
                            <p className="mt-1 text-xs text-muted-foreground">Enrolled this school year</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">Total Collected</CardTitle>
                            <Wallet className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-green-600">{fmt(summary.total_revenue)}</div>
                            <p className="mt-1 text-xs text-muted-foreground">All payment receipts</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">Collection Rate</CardTitle>
                            <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{pct(summary.collection_rate)}</div>
                            <Progress value={summary.collection_rate} className="mt-2 h-1.5" />
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">Outstanding Balance</CardTitle>
                            <AlertCircle className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-red-500">{fmt(summary.total_balance)}</div>
                            <p className="mt-1 text-xs text-muted-foreground">Pending student payments</p>
                        </CardContent>
                    </Card>
                </div>

                <Tabs defaultValue="dashboard">
                    <TabsList className="mb-2 flex h-auto flex-wrap gap-1">
                        <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
                        <TabsTrigger value="department">Department Analysis</TabsTrigger>
                        <TabsTrigger value="fee-income">Fee Income</TabsTrigger>
                        <TabsTrigger value="cashier">Cashier Transactions</TabsTrigger>
                        <TabsTrigger value="exports">Exports</TabsTrigger>
                    </TabsList>

                    <TabsContent value="dashboard" className="mt-4 space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <BarChart3 className="h-5 w-5 text-blue-600" />
                                    Monthly Collection Trend ({new Date().getFullYear()})
                                </CardTitle>
                                <CardDescription>Total payments received per month</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {monthlyTrend.every((point) => point.amount === 0) ? (
                                    <p className="py-6 text-center text-sm text-muted-foreground">No payment data available yet.</p>
                                ) : (
                                    <div className="space-y-2">
                                        {monthlyTrend.map((point) => (
                                            <div key={point.month} className="flex items-center gap-3">
                                                <span className="w-8 shrink-0 text-xs font-medium text-muted-foreground">{point.month}</span>
                                                <div className="h-6 flex-1 overflow-hidden rounded-full bg-muted">
                                                    <div className="flex h-full items-center rounded-full bg-blue-500 px-2 transition-all" style={{ width: `${(point.amount / maxMonthly) * 100}%`, minWidth: point.amount > 0 ? '3rem' : '0' }}>
                                                        {point.amount > 0 && <span className="truncate text-xs font-medium text-white">{fmt(point.amount)}</span>}
                                                    </div>
                                                </div>
                                                {point.amount === 0 && <span className="text-xs text-muted-foreground">-</span>}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <div className="grid gap-4 sm:grid-cols-3">
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm">Fee Collections</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-1">
                                    <div className="text-xl font-bold text-green-600">{fmt(totalFeeRevenue)}</div>
                                    <p className="text-xs text-muted-foreground">Collected from tuition / misc fees</p>
                                    <Separator className="my-2" />
                                    <p className="text-xs text-muted-foreground">Profit income: <span className="font-medium text-foreground">{fmt(totalFeeIncome)}</span></p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm">Document Fees</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-1">
                                    <div className="text-xl font-bold text-blue-600">{fmt(totalDocRevenue)}</div>
                                    <p className="text-xs text-muted-foreground">From approved document requests</p>
                                    <Separator className="my-2" />
                                    <p className="text-xs text-muted-foreground">{documentFeeReport.reduce((sum, category) => sum + category.items.reduce((innerSum, item) => innerSum + item.students_availed, 0), 0)} requests fulfilled</p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm">Grand Total Collected</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-1">
                                    <div className="text-xl font-bold">{fmt(grandCollected)}</div>
                                    <p className="text-xs text-muted-foreground">Fees + Document fees</p>
                                    <Separator className="my-2" />
                                    <p className="text-xs text-muted-foreground">Expected: <span className="font-medium text-foreground">{fmt(summary.total_expected)}</span></p>
                                </CardContent>
                            </Card>
                        </div>

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Building2 className="h-5 w-5 text-purple-600" />
                                    Department Collection Snapshot
                                </CardTitle>
                                <CardDescription>Top departments by amount collected</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {departmentAnalysis.length === 0 ? (
                                    <p className="py-6 text-center text-sm text-muted-foreground">No department data available.</p>
                                ) : (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Department</TableHead>
                                                <TableHead className="text-right">Students</TableHead>
                                                <TableHead className="text-right">Collected</TableHead>
                                                <TableHead className="text-right">Balance</TableHead>
                                                <TableHead>Rate</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {departmentAnalysis.slice(0, 6).map((department) => (
                                                <TableRow
                                                    key={department.department}
                                                    className={department.department_id ? 'cursor-pointer hover:bg-muted/50' : ''}
                                                    onClick={() => navigateToDepartmentAccounts(department.department_id)}
                                                >
                                                    <TableCell className="font-medium">{department.department}</TableCell>
                                                    <TableCell className="text-right">{department.students.toLocaleString()}</TableCell>
                                                    <TableCell className="text-right font-medium text-green-600">{fmt(department.collected)}</TableCell>
                                                    <TableCell className="text-right text-red-500">{fmt(department.balance)}</TableCell>
                                                    <TableCell><RateBar rate={department.collection_rate} /></TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="department" className="mt-4 space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Building2 className="h-5 w-5 text-purple-600" />
                                    Department Financial Summary
                                </CardTitle>
                                <CardDescription>Fee billing, collections, and outstanding balances per department</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {departmentAnalysis.length === 0 ? (
                                    <p className="py-8 text-center text-sm text-muted-foreground">No department data available.</p>
                                ) : (
                                    <>
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Department</TableHead>
                                                    <TableHead className="text-right">Students</TableHead>
                                                    <TableHead className="text-right">Total Billed</TableHead>
                                                    <TableHead className="text-right">Collected</TableHead>
                                                    <TableHead className="text-right">Outstanding</TableHead>
                                                    <TableHead>Collection Rate</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {departmentAnalysis.map((department) => (
                                                    <TableRow
                                                        key={department.department}
                                                        className={department.department_id ? 'cursor-pointer hover:bg-muted/50' : ''}
                                                        onClick={() => navigateToDepartmentAccounts(department.department_id)}
                                                    >
                                                        <TableCell className="font-medium">{department.department}</TableCell>
                                                        <TableCell className="text-right">{department.students.toLocaleString()}</TableCell>
                                                        <TableCell className="text-right">{fmt(department.billed)}</TableCell>
                                                        <TableCell className="text-right font-semibold text-green-600">{fmt(department.collected)}</TableCell>
                                                        <TableCell className="text-right"><span className={department.balance > 0 ? 'font-semibold text-red-500' : 'text-muted-foreground'}>{fmt(department.balance)}</span></TableCell>
                                                        <TableCell><RateBar rate={department.collection_rate} /></TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                        <div className="mt-4 flex flex-wrap justify-end gap-6 rounded-lg bg-muted p-3 text-sm font-semibold">
                                            <span>Billed: <span className="text-foreground">{fmt(departmentAnalysis.reduce((sum, department) => sum + department.billed, 0))}</span></span>
                                            <span>Collected: <span className="text-green-600">{fmt(departmentAnalysis.reduce((sum, department) => sum + department.collected, 0))}</span></span>
                                            <span>Outstanding: <span className="text-red-500">{fmt(departmentAnalysis.reduce((sum, department) => sum + department.balance, 0))}</span></span>
                                        </div>
                                    </>
                                )}
                            </CardContent>
                        </Card>

                        {departmentAnalysis.length > 0 && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Collection Rate by Department</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    {departmentAnalysis.map((department) => {
                                        const color = department.collection_rate >= 80 ? 'bg-green-500' : department.collection_rate >= 50 ? 'bg-yellow-500' : 'bg-red-500';
                                        return (
                                            <div key={department.department} className="space-y-1">
                                                <div className="flex justify-between text-sm">
                                                    <span className="max-w-sm truncate font-medium">{department.department}</span>
                                                    <span className="ml-2 shrink-0 tabular-nums text-muted-foreground">{pct(department.collection_rate)}</span>
                                                </div>
                                                <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
                                                    <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.min(department.collection_rate, 100)}%` }} />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </CardContent>
                            </Card>
                        )}
                    </TabsContent>

                    <TabsContent value="fee-income" className="mt-4 space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <DollarSign className="h-5 w-5 text-green-600" />
                                    General Fee Income
                                </CardTitle>
                                <CardDescription>Revenue and projected income per fee category</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-5">
                                {feeReport.length === 0 ? (
                                    <p className="py-6 text-center text-sm text-muted-foreground">No active fee categories found.</p>
                                ) : (
                                    <>
                                        {feeReport.map((category) => (
                                            <div key={category.category} className="space-y-2">
                                                <div className="flex flex-wrap items-center justify-between gap-2">
                                                    <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{category.category}</h3>
                                                    <div className="flex flex-wrap gap-3 text-xs font-medium">
                                                        <span>Assigned: <span className="text-foreground">{fmt(category.total_assigned ?? category.total_revenue)}</span></span>
                                                        <span className="text-blue-600">Collected: {fmt(category.total_collected ?? 0)}</span>
                                                        <span className="text-green-600">Income: {fmt(category.total_income)}</span>
                                                    </div>
                                                </div>
                                                <div className="overflow-hidden rounded border">
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow>
                                                                <TableHead>Fee Item</TableHead>
                                                                <TableHead className="text-right">Price</TableHead>
                                                                <TableHead className="text-right">Availed</TableHead>
                                                                <TableHead className="text-right">Revenue</TableHead>
                                                                <TableHead className="text-right">Income</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {category.items.length === 0 ? (
                                                                <TableRow>
                                                                    <TableCell colSpan={5} className="py-4 text-center text-sm text-muted-foreground">No fee items in this category.</TableCell>
                                                                </TableRow>
                                                            ) : (
                                                                category.items.map((item) => (
                                                                    <TableRow key={item.name}>
                                                                        <TableCell>{item.name}</TableCell>
                                                                        <TableCell className="text-right">{fmt(item.selling_price)}</TableCell>
                                                                        <TableCell className="text-right">{item.students_availed.toLocaleString()}</TableCell>
                                                                        <TableCell className="text-right text-blue-600">{fmt(item.total_revenue)}</TableCell>
                                                                        <TableCell className="text-right font-semibold text-green-600">{fmt(item.total_income)}</TableCell>
                                                                    </TableRow>
                                                                ))
                                                            )}
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            </div>
                                        ))}
                                        <div className="flex flex-wrap justify-end gap-6 rounded-lg bg-muted p-3 text-sm font-semibold">
                                            <span>Assigned: <span className="text-muted-foreground">{fmt(feeReport.reduce((sum, category) => sum + (category.total_assigned ?? category.total_revenue), 0))}</span></span>
                                            <span>Collected: <span className="text-blue-600">{fmt(feeReport.reduce((sum, category) => sum + (category.total_collected ?? 0), 0))}</span></span>
                                            <span>Income: <span className="text-green-600">{fmt(feeReport.reduce((sum, category) => sum + category.total_income, 0))}</span></span>
                                        </div>
                                    </>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <FileText className="h-5 w-5 text-blue-600" />
                                    Document Fee Income
                                </CardTitle>
                                <CardDescription>Revenue from approved document requests</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-5">
                                {documentFeeReport.length === 0 ? (
                                    <p className="py-6 text-center text-sm text-muted-foreground">No document fee data found.</p>
                                ) : (
                                    <>
                                        {documentFeeReport.map((category) => (
                                            <div key={category.category} className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{category.category}</h3>
                                                    <span className="text-xs font-medium text-blue-600">Revenue: {fmt(category.total_revenue)}</span>
                                                </div>
                                                <div className="overflow-hidden rounded border">
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow>
                                                                <TableHead>Document</TableHead>
                                                                <TableHead className="text-right">Price</TableHead>
                                                                <TableHead className="text-right">Requests</TableHead>
                                                                <TableHead className="text-right">Revenue</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {category.items.map((item) => (
                                                                <TableRow key={item.name}>
                                                                    <TableCell>{item.name}</TableCell>
                                                                    <TableCell className="text-right">{fmt(item.price)}</TableCell>
                                                                    <TableCell className="text-right">{item.students_availed.toLocaleString()}</TableCell>
                                                                    <TableCell className="text-right font-semibold text-blue-600">{fmt(item.total_revenue)}</TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            </div>
                                        ))}
                                        <div className="flex justify-end rounded-lg bg-muted p-3 text-sm font-semibold">Total Revenue: <span className="ml-1 text-blue-600">{fmt(totalDocRevenue)}</span></div>
                                    </>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="cashier" className="mt-4 space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <CreditCard className="h-5 w-5 text-indigo-600" />
                                    Cashier Transaction Summary
                                </CardTitle>
                                <CardDescription>Total collections per accounting staff member</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {cashierSummary.length === 0 ? (
                                    <p className="py-6 text-center text-sm text-muted-foreground">No cashier data available.</p>
                                ) : (
                                    <>
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Cashier</TableHead>
                                                    <TableHead className="text-right">Transactions</TableHead>
                                                    <TableHead className="text-right">Total Collected</TableHead>
                                                    <TableHead className="text-right">Cash</TableHead>
                                                    <TableHead className="text-right">GCash</TableHead>
                                                    <TableHead className="text-right">Bank</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {cashierSummary.map((cashier) => (
                                                    <TableRow key={cashier.cashier}>
                                                        <TableCell className="font-medium">{cashier.cashier}</TableCell>
                                                        <TableCell className="text-right">{cashier.transaction_count.toLocaleString()}</TableCell>
                                                        <TableCell className="text-right font-semibold text-green-600">{fmt(cashier.total_amount)}</TableCell>
                                                        <TableCell className="text-right text-sm">{fmt(cashier.cash_total)}</TableCell>
                                                        <TableCell className="text-right text-sm">{fmt(cashier.gcash_total)}</TableCell>
                                                        <TableCell className="text-right text-sm">{fmt(cashier.bank_total)}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                        <div className="mt-4 flex flex-wrap justify-end gap-6 rounded-lg bg-muted p-3 text-sm font-semibold">
                                            <span>Transactions: <span className="text-foreground">{cashierSummary.reduce((sum, cashier) => sum + cashier.transaction_count, 0).toLocaleString()}</span></span>
                                            <span>Total: <span className="text-green-600">{fmt(cashierSummary.reduce((sum, cashier) => sum + cashier.total_amount, 0))}</span></span>
                                        </div>
                                    </>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <CardTitle className="flex items-center gap-2">
                                            <Receipt className="h-5 w-5 text-gray-600" />
                                            Recent Transactions
                                        </CardTitle>
                                        <CardDescription>Last 50 payment records</CardDescription>
                                    </div>
                                    <input type="search" placeholder="Search student / OR / cashier..." value={txSearch} onChange={(event) => setTxSearch(event.target.value)} className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring sm:w-64" />
                                </div>
                            </CardHeader>
                            <CardContent>
                                {filteredTx.length === 0 ? (
                                    <p className="py-6 text-center text-sm text-muted-foreground">{txSearch ? 'No transactions match your search.' : 'No transactions found.'}</p>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>OR #</TableHead>
                                                    <TableHead>Date</TableHead>
                                                    <TableHead>Student</TableHead>
                                                    <TableHead className="text-right">Amount</TableHead>
                                                    <TableHead>Method</TableHead>
                                                    <TableHead>For</TableHead>
                                                    <TableHead>Cashier</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {filteredTx.map((transaction) => (
                                                    <TableRow key={transaction.id}>
                                                        <TableCell className="font-mono text-xs">{transaction.or_number}</TableCell>
                                                        <TableCell className="text-sm">{transaction.date}</TableCell>
                                                        <TableCell className="text-sm font-medium">{transaction.student}</TableCell>
                                                        <TableCell className="text-right font-semibold text-green-600">{fmt(transaction.amount)}</TableCell>
                                                        <TableCell>
                                                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${methodColor[transaction.method?.toLowerCase()] ?? 'bg-gray-100 text-gray-600'}`}>
                                                                {transaction.method?.toUpperCase() ?? 'CASH'}
                                                            </span>
                                                        </TableCell>
                                                        <TableCell className="text-sm capitalize">{transaction.payment_for}</TableCell>
                                                        <TableCell className="text-sm text-muted-foreground">{transaction.cashier}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="exports" className="mt-4">
                        <div className="grid gap-6 md:grid-cols-2">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Financial Reports</CardTitle>
                                    <CardDescription>Export payment transactions and fee balances</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div className="flex items-center justify-between rounded-lg border p-4">
                                        <div>
                                            <p className="text-sm font-semibold">Payment Transactions</p>
                                            <p className="text-xs text-muted-foreground">All OR numbers, dates, and amounts</p>
                                        </div>
                                        <Button size="sm" onClick={() => (window.location.href = '/owner/reports/export/financial?format=csv')}>
                                            <Download className="mr-2 h-4 w-4" /> CSV
                                        </Button>
                                    </div>
                                    <div className="flex items-center justify-between rounded-lg border p-4">
                                        <div>
                                            <p className="text-sm font-semibold">Student Balances</p>
                                            <p className="text-xs text-muted-foreground">Outstanding amounts per student</p>
                                        </div>
                                        <Button size="sm" onClick={() => (window.location.href = '/owner/reports/export/financial?format=csv')}>
                                            <Download className="mr-2 h-4 w-4" /> CSV
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle>Student Reports</CardTitle>
                                    <CardDescription>Export enrollment and demographic data</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div className="flex items-center justify-between rounded-lg border p-4">
                                        <div>
                                            <p className="text-sm font-semibold">Student Master List</p>
                                            <p className="text-xs text-muted-foreground">Complete student information</p>
                                        </div>
                                        <Button size="sm" onClick={() => (window.location.href = '/owner/reports/export/students?format=csv')}>
                                            <Download className="mr-2 h-4 w-4" /> CSV
                                        </Button>
                                    </div>
                                    <div className="flex items-center justify-between rounded-lg border p-4">
                                        <div>
                                            <p className="text-sm font-semibold">Department Enrollment</p>
                                            <p className="text-xs text-muted-foreground">Students grouped by department</p>
                                        </div>
                                        <Button size="sm" onClick={() => (window.location.href = '/owner/reports/export/students?format=csv')}>
                                            <Download className="mr-2 h-4 w-4" /> CSV
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="md:col-span-2">
                                <CardHeader>
                                    <CardTitle>Additional Reports</CardTitle>
                                    <CardDescription>More report types - coming soon</CardDescription>
                                </CardHeader>
                                <CardContent className="grid gap-4 md:grid-cols-3">
                                    {['Academic Performance', 'Attendance Records', 'Custom Reports'].map((label) => (
                                        <div key={label} className="rounded-lg border p-4">
                                            <h4 className="mb-1 text-sm font-semibold">{label}</h4>
                                            <p className="mb-3 text-xs text-muted-foreground">Feature in development</p>
                                            <Button variant="outline" size="sm" disabled>Coming Soon</Button>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>
                </Tabs>
            </ReportsPageShell>
        </OwnerLayout>
    );
}