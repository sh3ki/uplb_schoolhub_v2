import { Head } from '@inertiajs/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import RegistrarLayout from '@/layouts/registrar/registrar-layout';
import SuperAccountingLayout from '@/layouts/super-accounting/super-accounting-layout';

type StudentRow = {
    id: number;
    name: string;
    lrn: string;
};

type GroupRow = {
    group: string;
    male: StudentRow[];
    female: StudentRow[];
};

type Props = {
    rolePrefix: 'accounting' | 'super-accounting' | 'registrar' | 'owner';
    k12Groups: GroupRow[];
    collegeGroups: GroupRow[];
};

function RoleLayout({ rolePrefix, children }: { rolePrefix: Props['rolePrefix']; children: import('react').ReactNode }) {
    if (rolePrefix === 'super-accounting') {
        return <SuperAccountingLayout>{children}</SuperAccountingLayout>;
    }

    if (rolePrefix === 'registrar') {
        return <RegistrarLayout>{children}</RegistrarLayout>;
    }

    if (rolePrefix === 'owner') {
        return <OwnerLayout>{children}</OwnerLayout>;
    }

    return <AccountingLayout>{children}</AccountingLayout>;
}

function GenderTable({ title, rows, headerColor }: { title: string; rows: StudentRow[]; headerColor: string }) {
    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-base">{title} ({rows.length})</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
                <div className="rounded-md border overflow-hidden">
                    <Table>
                        <TableHeader style={{ backgroundColor: headerColor }}>
                            <TableRow>
                                <TableHead className="text-white">#</TableHead>
                                <TableHead className="text-white">Name</TableHead>
                                <TableHead className="text-white">LRN</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rows.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={3} className="text-center text-muted-foreground py-6">
                                        No records
                                    </TableCell>
                                </TableRow>
                            ) : (
                                rows.map((row, index) => (
                                    <TableRow key={row.id}>
                                        <TableCell>{index + 1}</TableCell>
                                        <TableCell className="font-medium">{row.name}</TableCell>
                                        <TableCell className="font-mono text-sm text-muted-foreground">{row.lrn}</TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}

export default function MasterlistPage({ rolePrefix, k12Groups, collegeGroups }: Props) {
    return (
        <RoleLayout rolePrefix={rolePrefix}>
            <Head title="Masterlist" />

            <div className="space-y-6 p-6">
                <div>
                    <h1 className="text-3xl font-bold">Masterlist</h1>
                    <p className="text-sm text-muted-foreground">
                        Student masterlist grouped by K-12 grade level and college department, separated by male and female.
                    </p>
                </div>

                <section className="space-y-4">
                    <h2 className="text-xl font-semibold">K-12 Classification</h2>
                    {k12Groups.length === 0 ? (
                        <Card><CardContent className="py-6 text-muted-foreground">No K-12 students found.</CardContent></Card>
                    ) : (
                        k12Groups.map((group) => (
                            <Card key={`k12-${group.group}`}>
                                <CardHeader>
                                    <CardTitle>{group.group}</CardTitle>
                                </CardHeader>
                                <CardContent className="grid gap-4 md:grid-cols-2">
                                    <GenderTable title="Male" rows={group.male} headerColor="oklch(58.8% 0.158 241.966)" />
                                    <GenderTable title="Female" rows={group.female} headerColor="oklch(58.8% 0.158 241.966)" />
                                </CardContent>
                            </Card>
                        ))
                    )}
                </section>

                <section className="space-y-4">
                    <h2 className="text-xl font-semibold">College Classification</h2>
                    {collegeGroups.length === 0 ? (
                        <Card><CardContent className="py-6 text-muted-foreground">No college students found.</CardContent></Card>
                    ) : (
                        collegeGroups.map((group) => (
                            <Card key={`college-${group.group}`}>
                                <CardHeader>
                                    <CardTitle>{group.group}</CardTitle>
                                </CardHeader>
                                <CardContent className="grid gap-4 md:grid-cols-2">
                                    <GenderTable title="Male" rows={group.male} headerColor="oklch(65.6% 0.241 354.308)" />
                                    <GenderTable title="Female" rows={group.female} headerColor="oklch(65.6% 0.241 354.308)" />
                                </CardContent>
                            </Card>
                        ))
                    )}
                </section>
            </div>
        </RoleLayout>
    );
}
