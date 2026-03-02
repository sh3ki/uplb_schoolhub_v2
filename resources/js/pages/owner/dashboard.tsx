import { Head, router } from '@inertiajs/react';
import { useState } from 'react';
import { IncomeCard } from '@/components/owner/income-card';
import { RevenueChart } from '@/components/owner/revenue-chart';
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
                        <Card>
                            <CardHeader>
                                <CardTitle>Financial Overview</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <RevenueChart />
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="today">
                        <Card>
                            <CardHeader>
                                <CardTitle>Today's Income Details</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-muted-foreground">
                                    Detailed breakdown of today's income...
                                </p>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="overall">
                        <Card>
                            <CardHeader>
                                <CardTitle>Overall Income Analysis</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-muted-foreground">
                                    Comprehensive income analysis...
                                </p>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="expected">
                        <Card>
                            <CardHeader>
                                <CardTitle>Expected Income Projections</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-muted-foreground">
                                    Income projections and forecasts...
                                </p>
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
                                <RevenueChart />
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </OwnerLayout>
    );
}
