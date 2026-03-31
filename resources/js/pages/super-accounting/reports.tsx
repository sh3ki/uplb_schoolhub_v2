import { Head, router, usePage } from '@inertiajs/react';
import { FileDown, FileText, Calendar, TrendingUp, Users } from 'lucide-react';
import { Fragment, useState } from 'react';
import { ExportButton } from '@/components/export-button';
import { FilterBar } from '@/components/filters/filter-bar';
import { FilterDropdown } from '@/components/filters/filter-dropdown';
import { ReportsPageShell } from '@/components/reports/reports-page-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StudentPhoto } from '@/components/ui/student-photo';
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
import SuperAccountingLayout from '@/layouts/super-accounting/super-accounting-layout';

interface Student {
    id: number;
    lrn: string;
    full_name: string;
    first_name?: string;
    last_name?: string;
    student_photo_url?: string | null;
    program?: string;
    year_level?: string;
}

interface PaymentSummary {
    date: string;
    count: number;
    total_amount: string;
}

interface BalanceReport {
    student: Student;
    school_year: string;
    total_amount: string;
    total_paid: string;
    previous_balance: string;
    balance: string;
    payment_status: string;
}

interface FeeReportItem {
    name: string;
    selling_price: number;
    cost_price: number;
    profit: number;
    students_availed: number;
    total_revenue: number;
    total_income: number;
}

interface FeeReportCategory {
    category: string;
    items: FeeReportItem[];
    total_revenue: number;
    total_income: number;
    total_assigned: number;
    total_collected: number;
}

interface DocFeeReportItem {
    name: string;
    price: number;
    students_availed: number;
    total_revenue: number;
}

interface DocFeeReportCategory {
    category: string;
    items: DocFeeReportItem[];
    total_revenue: number;
}

interface Department {
    id: number;
    name: string;
    code: string;
    classification: string;
}

interface DepartmentRow {
    department_id: number;
    department: string;
    students: number;
    billed: number;
    collected: number;
    previous_balance: number;
    balance: number;
    collection_rate: number;
}

interface FeeManipulationLog {
    id: number;
    student: {
        id: number | null;
        full_name: string | null;
        lrn: string | null;
        student_photo_url?: string | null;
    };
    action_type: string;
    action: string;
    details?: string | null;
    notes?: string | null;
    school_year?: string | null;
    performed_by?: string | null;
    created_at?: string | null;
}

interface Props {
    paymentSummary: PaymentSummary[];
    balanceReport: BalanceReport[];
    feeReport: FeeReportCategory[];
    documentFeeReport: DocFeeReportCategory[];
    departmentAnalysis: DepartmentRow[];
    grantTotals: {
        classification: string;
        rows: {
            department: string;
            students: number;
            total_discount: number;
        }[];
        total_students: number;
        total_discount: number;
    }[];
    grantSummary: {
        students: number;
        total_discount: number;
    };
    feeManipulations: FeeManipulationLog[];
    filters: {
        from?: string;
        to?: string;
        school_year?: string;
        status?: string;
        department_id?: string;
        classification?: string;
    };
    schoolYears: string[];
    departments: Department[];
    classifications: string[];
    summaryStats: {
        total_collectibles: number;
        total_collected: number;
        fully_paid_count: number;
        partial_paid_count: number;
        unpaid_count: number;
    };
}

export default function AccountingReports({
    paymentSummary = [],
    balanceReport = [],
    feeReport = [],
    documentFeeReport = [],
    departmentAnalysis = [],
    grantTotals = [],
    grantSummary = { students: 0, total_discount: 0 },
    feeManipulations = [],
    filters = {},
    schoolYears = [],
    departments = [],
    classifications = [],
    summaryStats = {
        total_collectibles: 0,
        total_collected: 0,
        fully_paid_count: 0,
        partial_paid_count: 0,
        unpaid_count: 0,
    },
}: Props) {
    const page = usePage();
    const currentPath = page.url || '';
    const routePrefix = currentPath.startsWith('/owner/') ? 'owner' : 'super-accounting';
    const basePath = `/${routePrefix}`;
    const departmentAccountsPath = routePrefix === 'owner'
        ? '/owner/student-accounts'
        : '/super-accounting/student-accounts';
    const ReportsLayoutComponent = routePrefix === 'owner' ? OwnerLayout : SuperAccountingLayout;

    const [from, setFrom] = useState(filters.from || '');
    const [to, setTo] = useState(filters.to || '');
    const [schoolYear, setSchoolYear] = useState(filters.school_year || 'all');
    const [status, setStatus] = useState(filters.status || 'all');
    const [departmentId, setDepartmentId] = useState(filters.department_id || 'all');
    const [classification, setClassification] = useState(filters.classification || 'all');

    const handleFetchReport = () => {
        router.get(
            `${basePath}/reports`,
            {
                from: from || undefined,
                to: to || undefined,
                school_year: schoolYear !== 'all' ? schoolYear : undefined,
                status: status !== 'all' ? status : undefined,
                department_id: departmentId !== 'all' ? departmentId : undefined,
                classification: classification !== 'all' ? classification : undefined,
            },
            {
                preserveState: true,
                preserveScroll: true,
            }
        );
    };

    const handlePrint = () => {
        window.print();
    };

    const formatCurrency = (amount: string | number) => {
        return `₱${parseFloat(amount.toString()).toLocaleString('en-PH', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })}`;
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-PH', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    const getStatusBadge = (status: string) => {
        if (status === 'paid') {
            return <Badge className="bg-green-500">Fully Paid</Badge>;
        } else if (status === 'partial') {
            return <Badge className="bg-yellow-500">Partial</Badge>;
        } else {
            return <Badge variant="destructive">Unpaid</Badge>;
        }
    };

    const calculatePercentage = (value: number, total: number) => {
        if (total === 0) return 0;
        return ((value / total) * 100).toFixed(1);
    };

    const totalStudents =
        summaryStats.fully_paid_count +
        summaryStats.partial_paid_count +
        summaryStats.unpaid_count;

    return (
        <ReportsLayoutComponent>
            <Head title="Reports" />

            <ReportsPageShell
                title="Reports & Analytics"
                description="Generate comprehensive reports on payments and fees"
                action={
                    <div className="flex gap-2">
                        <ExportButton
                            exportUrl={`${basePath}/reports/export`}
                            filters={{ from, to, school_year: schoolYear, status, department_id: departmentId, classification }}
                            buttonText="Export Report"
                        />
                        <Button variant="outline" onClick={handlePrint}>
                            <FileText className="mr-2 h-4 w-4" />
                            Print
                        </Button>
                    </div>
                }
            >

                {/* Summary Statistics */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Collectibles</CardTitle>
                            <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {formatCurrency(summaryStats.total_collectibles)}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                Outstanding balance from all students
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Collected</CardTitle>
                            <FileDown className="h-4 w-4 text-green-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-green-600">
                                {formatCurrency(summaryStats.total_collected)}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">All-time payments</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Fully Paid</CardTitle>
                            <Users className="h-4 w-4 text-green-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{summaryStats.fully_paid_count}</div>
                            <p className="text-xs text-muted-foreground mt-1">
                                {calculatePercentage(summaryStats.fully_paid_count, totalStudents)}% of
                                students
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Unpaid</CardTitle>
                            <Users className="h-4 w-4 text-red-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{summaryStats.unpaid_count}</div>
                            <p className="text-xs text-muted-foreground mt-1">
                                {calculatePercentage(summaryStats.unpaid_count, totalStudents)}% of students
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Filters */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Calendar className="h-5 w-5" />
                            Report Filters
                        </CardTitle>
                        <CardDescription>
                            Customize report parameters to generate specific views
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <FilterBar
                            onReset={() => {
                                setFrom('');
                                setTo('');
                                setSchoolYear('all');
                                setStatus('all');
                                setDepartmentId('all');
                                setClassification('all');
                                router.get(`${basePath}/reports`);
                            }}
                        >
                            <div className="space-y-2">
                                <Label htmlFor="from">Date From</Label>
                                <Input
                                    id="from"
                                    type="date"
                                    value={from}
                                    onChange={(e) => setFrom(e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="to">Date To</Label>
                                <Input
                                    id="to"
                                    type="date"
                                    value={to}
                                    onChange={(e) => setTo(e.target.value)}
                                />
                            </div>

                            <div className="min-w-[160px]">
                                <FilterDropdown
                                    label="School Year"
                                    value={schoolYear}
                                    onChange={setSchoolYear}
                                    options={[
                                        { value: 'all', label: 'All Years' },
                                        ...schoolYears.map((year) => ({ value: year, label: year })),
                                    ]}
                                    showAll={false}
                                />
                            </div>

                            <div className="min-w-[170px]">
                                <FilterDropdown
                                    label="Payment Status"
                                    value={status}
                                    onChange={setStatus}
                                    options={[
                                        { value: 'all', label: 'All Status' },
                                        { value: 'paid', label: 'Fully Paid' },
                                        { value: 'partial', label: 'Partial Payment' },
                                        { value: 'unpaid', label: 'Unpaid' },
                                    ]}
                                    showAll={false}
                                />
                            </div>

                            <div className="min-w-[180px]">
                                <FilterDropdown
                                    label="Classification"
                                    value={classification}
                                    onChange={setClassification}
                                    options={[
                                        { value: 'all', label: 'All Classifications' },
                                        ...classifications.map((cls) => ({ value: cls, label: cls })),
                                    ]}
                                    showAll={false}
                                />
                            </div>

                            <div className="min-w-[190px]">
                                <FilterDropdown
                                    label="Department"
                                    value={departmentId}
                                    onChange={setDepartmentId}
                                    options={[
                                        { value: 'all', label: 'All Departments' },
                                        ...departments.map((dept) => ({ value: dept.id.toString(), label: dept.name })),
                                    ]}
                                    showAll={false}
                                />
                            </div>
                        </FilterBar>

                        <div className="mt-4 flex gap-2">
                            <Button onClick={handleFetchReport}>Generate Report</Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Report Tabs */}
                <Tabs defaultValue="balance" className="space-y-4">
                    <TabsList>
                        <TabsTrigger value="balance">Balance Report</TabsTrigger>
                        <TabsTrigger value="collection">Collection Summary</TabsTrigger>
                        <TabsTrigger value="fee-income">Fee Income</TabsTrigger>
                        <TabsTrigger value="department">Department Analysis</TabsTrigger>
                        <TabsTrigger value="grants">Total Grants</TabsTrigger>
                        <TabsTrigger value="fee-manipulation">Fee Manipulation</TabsTrigger>
                    </TabsList>

                    <TabsContent value="balance" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Student Balance Report</CardTitle>
                                <CardDescription>
                                    Detailed breakdown of student fees and balances
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {balanceReport.length > 0 && (
                                    <div className="mb-3 flex justify-end gap-6 text-sm font-semibold">
                                        <span>Total Amount: {formatCurrency(balanceReport.reduce((sum, row) => sum + parseFloat(String(row.total_amount || 0)), 0))}</span>
                                        <span className="text-green-600">Total Paid: {formatCurrency(balanceReport.reduce((sum, row) => sum + parseFloat(String(row.total_paid || 0)), 0))}</span>
                                        <span className="text-orange-600">Previous Balance: {formatCurrency(balanceReport.reduce((sum, row) => sum + parseFloat(String(row.previous_balance || 0)), 0))}</span>
                                        <span className="text-red-600">Balance: {formatCurrency(balanceReport.reduce((sum, row) => sum + parseFloat(String(row.balance || 0)), 0))}</span>
                                    </div>
                                )}
                                <div className="rounded-lg border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Student Name</TableHead>
                                                <TableHead>Student No.</TableHead>
                                                <TableHead>Program</TableHead>
                                                <TableHead>School Year</TableHead>
                                                <TableHead className="text-right">Total Amount</TableHead>
                                                <TableHead className="text-right">Total Paid</TableHead>
                                                <TableHead className="text-right">Previous Balance</TableHead>
                                                <TableHead className="text-right">Balance</TableHead>
                                                <TableHead>Status</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {balanceReport.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={9} className="h-24 text-center">
                                                        <div className="flex flex-col items-center justify-center gap-2">
                                                            <FileText className="h-8 w-8 text-muted-foreground" />
                                                            <p className="text-muted-foreground">
                                                                No data available. Adjust filters and generate report.
                                                            </p>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                balanceReport.map((record, index) => (
                                                    <TableRow key={index}>
                                                        <TableCell>
                                                            <div className="flex items-center gap-3">
                                                                <StudentPhoto
                                                                    src={record.student.student_photo_url}
                                                                    firstName={record.student.first_name}
                                                                    lastName={record.student.last_name}
                                                                    size="sm"
                                                                />
                                                                <span className="font-medium">{record.student.full_name}</span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>{record.student.lrn}</TableCell>
                                                        <TableCell>
                                                            {record.student.program || 'N/A'}
                                                        </TableCell>
                                                        <TableCell>{record.school_year}</TableCell>
                                                        <TableCell className="text-right">
                                                            {formatCurrency(record.total_amount)}
                                                        </TableCell>
                                                        <TableCell className="text-right text-green-600">
                                                            {formatCurrency(record.total_paid)}
                                                        </TableCell>
                                                        <TableCell className="text-right text-orange-600 font-medium">
                                                            {formatCurrency(record.previous_balance || 0)}
                                                        </TableCell>
                                                        <TableCell className="text-right font-semibold">
                                                            {formatCurrency(record.balance)}
                                                        </TableCell>
                                                        <TableCell>
                                                            {getStatusBadge(record.payment_status)}
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="collection" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Payment Collection Summary</CardTitle>
                                <CardDescription>
                                    Timeline of payment collections grouped by date
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {paymentSummary.length > 0 && (
                                    <div className="mb-3 flex justify-end gap-6 text-sm font-semibold">
                                        <span>Total Payments: {paymentSummary.reduce((sum, s) => sum + s.count, 0)}</span>
                                        <span className="text-green-600">
                                            Total Amount: {formatCurrency(paymentSummary.reduce((sum, s) => sum + parseFloat(s.total_amount), 0))}
                                        </span>
                                    </div>
                                )}
                                <div className="rounded-lg border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Date</TableHead>
                                                <TableHead>Number of Payments</TableHead>
                                                <TableHead className="text-right">Total Amount</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {paymentSummary.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={3} className="h-24 text-center">
                                                        <div className="flex flex-col items-center justify-center gap-2">
                                                            <FileText className="h-8 w-8 text-muted-foreground" />
                                                            <p className="text-muted-foreground">
                                                                No payment data available for the selected period.
                                                            </p>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                paymentSummary.map((summary, index) => (
                                                    <TableRow
                                                        key={index}
                                                        className="cursor-pointer hover:bg-muted/60"
                                                        onClick={() => {
                                                            router.get(`${basePath}/account-dashboard`, {
                                                                date_from: summary.date,
                                                                date_to: summary.date,
                                                            });
                                                        }}
                                                    >
                                                        <TableCell className="font-medium">
                                                            {formatDate(summary.date)}
                                                        </TableCell>
                                                        <TableCell>{summary.count} payments</TableCell>
                                                        <TableCell className="text-right font-semibold text-green-600">
                                                            {formatCurrency(summary.total_amount)}
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                            {paymentSummary.length > 0 && (
                                                <TableRow className="bg-muted/50 font-semibold">
                                                    <TableCell>Total</TableCell>
                                                    <TableCell>
                                                        {paymentSummary.reduce((sum, s) => sum + s.count, 0)}{' '}
                                                        payments
                                                    </TableCell>
                                                    <TableCell className="text-right text-green-600">
                                                        {formatCurrency(
                                                            paymentSummary.reduce(
                                                                (sum, s) => sum + parseFloat(s.total_amount),
                                                                0
                                                            )
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="fee-income" className="space-y-6">
                        {/* General Fee Income */}
                        <Card>
                            <CardHeader>
                                <CardTitle>General Fee Income Report</CardTitle>
                                <CardDescription>
                                    Revenue and income from fee items based on students availed
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                {feeReport.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                                        <FileText className="h-10 w-10 mb-3" />
                                        <p>No fee income data yet. Set the number of students availed in Fee Management.</p>
                                    </div>
                                ) : (
                                    <>
                                        {feeReport.map((cat) => (
                                            <div key={cat.category} className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">{cat.category}</h3>
                                                    <div className="flex gap-4 text-sm">
                                                        <span className="text-muted-foreground">Assigned: {formatCurrency(cat.total_assigned ?? cat.total_revenue)}</span>
                                                        <span className="text-blue-600 font-medium">Collected: {formatCurrency(cat.total_collected ?? 0)}</span>
                                                        <span className="text-green-600 font-medium">Income: {formatCurrency(cat.total_income)}</span>
                                                    </div>
                                                </div>
                                                <div className="rounded-lg border">
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow>
                                                                <TableHead>Fee Item</TableHead>
                                                                <TableHead className="text-right">Selling Price</TableHead>
                                                                <TableHead className="text-right">Profit/Unit</TableHead>
                                                                <TableHead className="text-right">Students Availed</TableHead>
                                                                <TableHead className="text-right">Total Revenue</TableHead>
                                                                <TableHead className="text-right">Total Income</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {cat.items.map((item) => (
                                                                <TableRow key={item.name}>
                                                                    <TableCell className="font-medium">{item.name}</TableCell>
                                                                    <TableCell className="text-right">{formatCurrency(item.selling_price)}</TableCell>
                                                                    <TableCell className={`text-right ${item.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                                        {formatCurrency(item.profit)}
                                                                    </TableCell>
                                                                    <TableCell className="text-right">{item.students_availed.toLocaleString()}</TableCell>
                                                                    <TableCell className="text-right text-blue-600 font-medium">
                                                                        {formatCurrency(item.total_revenue)}
                                                                    </TableCell>
                                                                    <TableCell className="text-right text-green-600 font-semibold">
                                                                        {formatCurrency(item.total_income)}
                                                                    </TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            </div>
                                        ))}
                                        <div className="rounded-lg bg-muted p-4 flex gap-8 text-sm font-semibold justify-end">
                                            <span>Total Assigned: <span className="text-muted-foreground">{formatCurrency(feeReport.reduce((s, c) => s + (c.total_assigned ?? c.total_revenue), 0))}</span></span>
                                            <span>Total Collected: <span className="text-blue-600">{formatCurrency(feeReport.reduce((s, c) => s + (c.total_collected ?? 0), 0))}</span></span>
                                            <span>Total Income: <span className="text-green-600">{formatCurrency(feeReport.reduce((s, c) => s + c.total_income, 0))}</span></span>
                                        </div>
                                    </>
                                )}
                            </CardContent>
                        </Card>

                        {/* Document Fee Income */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Document Fee Income Report</CardTitle>
                                <CardDescription>
                                    Revenue from document request fees based on students availed
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                {documentFeeReport.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                                        <FileText className="h-10 w-10 mb-3" />
                                        <p>No document fee income data. Set students availed in Document Fees.</p>
                                    </div>
                                ) : (
                                    <>
                                        {documentFeeReport.map((cat) => (
                                            <div key={cat.category} className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">{cat.category}</h3>
                                                    <span className="text-blue-600 font-medium text-sm">Revenue: {formatCurrency(cat.total_revenue)}</span>
                                                </div>
                                                <div className="rounded-lg border">
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow>
                                                                <TableHead>Document Type</TableHead>
                                                                <TableHead className="text-right">Price</TableHead>
                                                                <TableHead className="text-right">Students Availed</TableHead>
                                                                <TableHead className="text-right">Total Revenue</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {cat.items.map((item) => (
                                                                <TableRow key={item.name}>
                                                                    <TableCell className="font-medium">{item.name}</TableCell>
                                                                    <TableCell className="text-right">{formatCurrency(item.price)}</TableCell>
                                                                    <TableCell className="text-right">{item.students_availed.toLocaleString()}</TableCell>
                                                                    <TableCell className="text-right text-blue-600 font-semibold">
                                                                        {formatCurrency(item.total_revenue)}
                                                                    </TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            </div>
                                        ))}
                                        <div className="rounded-lg bg-muted p-4 flex justify-end text-sm font-semibold">
                                            <span>Total Document Fee Revenue: <span className="text-blue-600">{formatCurrency(documentFeeReport.reduce((s, c) => s + c.total_revenue, 0))}</span></span>
                                        </div>
                                    </>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="department" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Department Financial Summary</CardTitle>
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
                                                    <TableHead className="text-right">Previous Balance</TableHead>
                                                    <TableHead className="text-right">Outstanding</TableHead>
                                                    <TableHead>Collection Rate</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {departmentAnalysis.map((d) => {
                                                    const rate = d.collection_rate;
                                                    const rateColor = rate >= 80 ? 'bg-green-500' : rate >= 50 ? 'bg-yellow-500' : 'bg-red-500';
                                                    return (
                                                        <TableRow
                                                            key={`${d.department_id}-${d.department}`}
                                                            className={d.department_id ? 'cursor-pointer hover:bg-muted/50' : ''}
                                                            onClick={() => {
                                                                if (!d.department_id) {
                                                                    return;
                                                                }

                                                                router.visit(`${departmentAccountsPath}?status=all&department_id=${d.department_id}&sort_school_year=desc`);
                                                            }}
                                                        >
                                                            <TableCell className="font-medium">
                                                                {d.department}
                                                                <span className="ml-1 text-xs text-muted-foreground">({d.students} students)</span>
                                                            </TableCell>
                                                            <TableCell className="text-right">{d.students.toLocaleString()}</TableCell>
                                                            <TableCell className="text-right">{formatCurrency(d.billed)}</TableCell>
                                                            <TableCell className="text-right text-green-600 font-semibold">{formatCurrency(d.collected)}</TableCell>
                                                            <TableCell className="text-right text-orange-600 font-semibold">{formatCurrency(d.previous_balance || 0)}</TableCell>
                                                            <TableCell className="text-right">
                                                                <span className={d.balance > 0 ? 'text-red-500 font-semibold' : 'text-muted-foreground'}>
                                                                    {formatCurrency(d.balance)}
                                                                </span>
                                                            </TableCell>
                                                            <TableCell>
                                                                <div className="flex items-center gap-2">
                                                                    <div className="h-2 w-24 rounded-full bg-muted overflow-hidden">
                                                                        <div className={`h-full rounded-full ${rateColor}`} style={{ width: `${Math.min(rate, 100)}%` }} />
                                                                    </div>
                                                                    <span className="text-xs font-medium tabular-nums">{rate.toFixed(1)}%</span>
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                })}
                                            </TableBody>
                                        </Table>
                                        <div className="mt-4 flex flex-wrap justify-end gap-6 rounded-lg bg-muted p-3 text-sm font-semibold">
                                            <span>Billed: <span className="text-foreground">{formatCurrency(departmentAnalysis.reduce((s, d) => s + d.billed, 0))}</span></span>
                                            <span>Collected: <span className="text-green-600">{formatCurrency(departmentAnalysis.reduce((s, d) => s + d.collected, 0))}</span></span>
                                            <span>Previous Balance: <span className="text-orange-600">{formatCurrency(departmentAnalysis.reduce((s, d) => s + (d.previous_balance || 0), 0))}</span></span>
                                            <span>Outstanding: <span className="text-red-500">{formatCurrency(departmentAnalysis.reduce((s, d) => s + d.balance, 0))}</span></span>
                                        </div>
                                    </>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="grants" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Total Grants</CardTitle>
                                <CardDescription>
                                    Grouped summary of student grants by classification and department
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {grantTotals.length > 0 && (
                                    <div className="mb-3 flex justify-end gap-6 text-sm font-semibold">
                                        <span>Total Students: {grantSummary.students.toLocaleString()}</span>
                                        <span className="text-green-600">Total Grants: {formatCurrency(grantSummary.total_discount)}</span>
                                    </div>
                                )}
                                <div className="rounded-lg border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Department</TableHead>
                                                <TableHead className="text-right">Students</TableHead>
                                                <TableHead className="text-right">Total Grants</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {grantTotals.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                                                        No grant data for selected filters.
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                grantTotals.map((group) => (
                                                    <Fragment key={`wrap-${group.classification}`}>
                                                        <TableRow key={`group-${group.classification}`} className="bg-muted/40">
                                                            <TableCell colSpan={3} className="font-semibold uppercase tracking-wide text-muted-foreground">
                                                                {group.classification}
                                                            </TableCell>
                                                        </TableRow>
                                                        {group.rows.map((row) => (
                                                            <TableRow key={`${group.classification}-${row.department}`}>
                                                                <TableCell className="pl-6 font-medium">{row.department}</TableCell>
                                                                <TableCell className="text-right">{row.students.toLocaleString()}</TableCell>
                                                                <TableCell className="text-right font-medium text-green-600">
                                                                    {formatCurrency(row.total_discount)}
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                        <TableRow key={`total-${group.classification}`} className="bg-muted/20 font-semibold">
                                                            <TableCell>{group.classification} Total</TableCell>
                                                            <TableCell className="text-right">{group.total_students.toLocaleString()}</TableCell>
                                                            <TableCell className="text-right text-green-600">{formatCurrency(group.total_discount)}</TableCell>
                                                        </TableRow>
                                                    </Fragment>
                                                ))
                                            )}
                                            {grantTotals.length > 0 && (
                                                <TableRow className="bg-muted/50 font-semibold">
                                                    <TableCell>Grand Total</TableCell>
                                                    <TableCell className="text-right">{grantSummary.students.toLocaleString()}</TableCell>
                                                    <TableCell className="text-right text-green-600">{formatCurrency(grantSummary.total_discount)}</TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="fee-manipulation" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Fee Manipulation</CardTitle>
                                <CardDescription>
                                    Logs for fee creation, updates, balance adjustments, and deletions
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="rounded-lg border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Timestamp</TableHead>
                                                <TableHead>Student</TableHead>
                                                <TableHead>School Year</TableHead>
                                                <TableHead>Action Type</TableHead>
                                                <TableHead>Action</TableHead>
                                                <TableHead>Performed By</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {feeManipulations.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                                        No fee manipulation logs for selected filters.
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                feeManipulations.map((log) => (
                                                    <TableRow key={log.id}>
                                                        <TableCell className="text-xs text-muted-foreground">{log.created_at || '-'}</TableCell>
                                                        <TableCell>
                                                            <div className="flex items-center gap-3">
                                                                <StudentPhoto
                                                                    src={log.student?.student_photo_url}
                                                                    firstName={log.student?.full_name?.split(' ')[0]}
                                                                    lastName={log.student?.full_name?.split(' ').slice(1).join(' ') || ''}
                                                                    size="sm"
                                                                />
                                                                <div>
                                                                    <div className="font-medium">{log.student?.full_name || 'Unknown Student'}</div>
                                                                    <div className="text-xs text-muted-foreground">{log.student?.lrn || '-'}</div>
                                                                </div>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>{log.school_year || '-'}</TableCell>
                                                        <TableCell className="capitalize">{log.action_type.replace('_', ' ')}</TableCell>
                                                        <TableCell className="max-w-[420px]">
                                                            <div className="line-clamp-2" title={log.details || log.action}>
                                                                {log.details || log.action}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>{log.performed_by || '-'}</TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </ReportsPageShell>
        </ReportsLayoutComponent>
    );
}
