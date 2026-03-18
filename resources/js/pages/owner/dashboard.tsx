import { Head, router } from '@inertiajs/react';
import { useState } from 'react';
import { IncomeCard } from '@/components/owner/income-card';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import OwnerLayout from '@/layouts/owner/owner-layout';
import type { BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Financial Dashboard',
        href: '/owner/dashboard',
    },
];

interface DashboardProps {
    todayIncome: number;
    todayTarget: number;
    todayAchievement: number;
    overallIncome: number;
    overallTarget: number;
    overallAchievement: number;
    expectedIncome: number;
    expectedTarget: number;
    expectedAchievement: number;
    departmentStats: Array<{
        id: number;
        name: string;
        code: string;
        enrollments: number;
        revenue: number;
        expected: number;
        collection_rate: number;
    }>;
    revenueTrend: Array<{
        date: string;
        label: string;
        amount: number;
    }>;
    totalStudents: number;
    totalPayments: number;
    schoolYear: string;
    schoolYears: string[];
    filters: { school_year?: string; date_from?: string; date_to?: string };
}

export default function OwnerDashboard({
    todayIncome,
    todayTarget,
    todayAchievement,
    overallIncome,
    overallTarget,
    overallAchievement,
    expectedIncome,
    expectedTarget,
    expectedAchievement,
    departmentStats,
    revenueTrend,
    totalStudents,
    totalPayments,
    schoolYear,
    schoolYears,
    filters,
}: DashboardProps) {
    const [selectedSchoolYear, setSelectedSchoolYear] = useState(filters.school_year || schoolYear);
    const [dateFrom, setDateFrom] = useState(filters.date_from || '');
    const [dateTo, setDateTo] = useState(filters.date_to || '');

    const handleApply = () => {
        router.get('/owner/dashboard', {
            school_year: selectedSchoolYear,
            date_from: dateFrom || undefined,
            date_to: dateTo || undefined,
        }, { preserveState: true });
    };

    return (
        <OwnerLayout breadcrumbs={breadcrumbs}>
            <Head title="Financial Dashboard" />

            <div className="space-y-6 p-6">
                {/* Header */}
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-foreground">
                            Financial Dashboard
                        </h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Real-time financial overview and analytics
                        </p>
                    </div>
                    {/* School Year + Date Filter */}
                    <div className="flex flex-wrap items-end gap-3">
                        <div className="flex flex-col gap-1">
                            <Label className="text-xs text-muted-foreground">School Year</Label>
                            <Select value={selectedSchoolYear} onValueChange={setSelectedSchoolYear}>
                                <SelectTrigger className="w-36">
                                    <SelectValue placeholder="School Year" />
                                </SelectTrigger>
                                <SelectContent>
                                    {schoolYears.map(sy => (
                                        <SelectItem key={sy} value={sy}>{sy}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex flex-col gap-1">
                            <Label className="text-xs text-muted-foreground">Date From</Label>
                            <Input type="date" className="w-36" value={dateFrom}
                                onChange={e => setDateFrom(e.target.value)} />
                        </div>
                        <div className="flex flex-col gap-1">
                            <Label className="text-xs text-muted-foreground">Date To</Label>
                            <Input type="date" className="w-36" value={dateTo}
                                onChange={e => setDateTo(e.target.value)} />
                        </div>
                        <Button onClick={handleApply}>Apply</Button>
                    </div>
                </div>

                {/* Income Cards */}
                <div className="grid gap-6 md:grid-cols-3">
                    <IncomeCard
                        title="Today's Income"
                        amount={todayIncome}
                        target={todayTarget}
                        achievement={todayAchievement}
                        period="Live"
                        variant="today"
                    />
                    <IncomeCard
                        title="Overall Income"
                        amount={overallIncome}
                        target={overallTarget}
                        achievement={overallAchievement}
                        period={schoolYear}
                        variant="overall"
                    />
                    <IncomeCard
                        title="Expected Income"
                        amount={expectedIncome}
                        target={expectedTarget}
                        achievement={expectedAchievement}
                        period="Remaining Balance"
                        variant="expected"
                        projected={expectedAchievement}
                    />
                </div>

                {/* Tabs */}
                <Tabs defaultValue="dashboard" className="space-y-6">
                    <TabsList>
                        <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
                        <TabsTrigger value="today">
                            Today's Income
                        </TabsTrigger>
                        <TabsTrigger value="overall">
                            Overall Income
                        </TabsTrigger>
                        <TabsTrigger value="expected">
                            Expected Income
                        </TabsTrigger>
                        <TabsTrigger value="departments">
                            Department Analysis
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="dashboard" className="space-y-6">
                        <div className="grid gap-4 md:grid-cols-2">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Summary</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Students with ledgers</span>
                                        <span className="font-semibold">{totalStudents}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Total payment transactions</span>
                                        <span className="font-semibold">{totalPayments}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Current School Year</span>
                                        <span className="font-semibold">{schoolYear}</span>
                                    </div>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader>
                                    <CardTitle>Revenue Trend (Last 7 Days)</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2 text-sm">
                                    {revenueTrend.map((item) => (
                                        <div key={item.date} className="flex justify-between">
                                            <span className="text-muted-foreground">{item.label}</span>
                                            <span className="font-semibold">₱{item.amount.toLocaleString('en-PH')}</span>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    <TabsContent value="today">
                        <Card>
                            <CardHeader>
                                <CardTitle>Today's Income Details</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Collected Today</span>
                                        <span className="font-semibold">₱{todayIncome.toLocaleString('en-PH')}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Target</span>
                                        <span className="font-semibold">₱{todayTarget.toLocaleString('en-PH')}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Achievement</span>
                                        <span className="font-semibold">{todayAchievement}%</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="overall">
                        <Card>
                            <CardHeader>
                                <CardTitle>Overall Income Analysis</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Collected</span>
                                        <span className="font-semibold">₱{overallIncome.toLocaleString('en-PH')}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Target</span>
                                        <span className="font-semibold">₱{overallTarget.toLocaleString('en-PH')}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Achievement</span>
                                        <span className="font-semibold">{overallAchievement}%</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="expected">
                        <Card>
                            <CardHeader>
                                <CardTitle>Expected Income Projections</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Remaining Balance</span>
                                        <span className="font-semibold">₱{expectedIncome.toLocaleString('en-PH')}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Expected Target</span>
                                        <span className="font-semibold">₱{expectedTarget.toLocaleString('en-PH')}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Projection</span>
                                        <span className="font-semibold">{expectedAchievement}%</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="departments">
                        <Card>
                            <CardHeader>
                                <CardTitle>
                                    Department Revenue Analysis
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2 text-sm">
                                    {departmentStats.map((dept) => (
                                        <div key={dept.id} className="flex items-center justify-between rounded border p-2">
                                            <div>
                                                <div className="font-medium">{dept.name}</div>
                                                <div className="text-xs text-muted-foreground">{dept.enrollments} students</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="font-semibold">₱{dept.revenue.toLocaleString('en-PH')}</div>
                                                <div className="text-xs text-muted-foreground">{dept.collection_rate}% collected</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </OwnerLayout>
    );
}
