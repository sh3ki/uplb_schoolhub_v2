import { Head } from '@inertiajs/react';
import axios from 'axios';
import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Pagination } from '@/components/ui/pagination';
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

const STUDENTS_PER_PAGE = 10;

type LocalPaginationData = {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number;
    to: number;
    links: { url: string | null; label: string; active: boolean }[];
};

function buildLocalPaginationData(currentPage: number, total: number, perPage: number): LocalPaginationData {
    const lastPage = Math.max(1, Math.ceil(total / perPage));
    const safePage = Math.min(Math.max(1, currentPage), lastPage);
    const from = total === 0 ? 0 : (safePage - 1) * perPage + 1;
    const to = total === 0 ? 0 : Math.min(safePage * perPage, total);

    const links = Array.from({ length: lastPage }, (_, index) => {
        const page = index + 1;
        return {
            url: null,
            label: String(page),
            active: page === safePage,
        };
    });

    return {
        current_page: safePage,
        last_page: lastPage,
        per_page: perPage,
        total,
        from,
        to,
        links,
    };
}

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

function GenderTable({ title, rows, headerColor, tableId }: { title: string; rows: StudentRow[]; headerColor: string; tableId: string }) {
    const [currentPage, setCurrentPage] = useState(1);

    useEffect(() => {
        const maxPage = Math.max(1, Math.ceil(rows.length / STUDENTS_PER_PAGE));
        if (currentPage > maxPage) {
            setCurrentPage(maxPage);
        }
    }, [rows.length, currentPage]);

    const paginationData = useMemo(
        () => buildLocalPaginationData(currentPage, rows.length, STUDENTS_PER_PAGE),
        [currentPage, rows.length],
    );

    const pagedRows = useMemo(() => {
        const start = (paginationData.current_page - 1) * STUDENTS_PER_PAGE;
        const end = start + STUDENTS_PER_PAGE;
        return rows.slice(start, end);
    }, [rows, paginationData.current_page]);

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
                            {pagedRows.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={3} className="text-center text-muted-foreground py-6">
                                        No records
                                    </TableCell>
                                </TableRow>
                            ) : (
                                pagedRows.map((row, index) => (
                                    <TableRow key={row.id}>
                                        <TableCell>{(paginationData.current_page - 1) * STUDENTS_PER_PAGE + index + 1}</TableCell>
                                        <TableCell className="font-medium">{row.name}</TableCell>
                                        <TableCell className="font-mono text-sm text-muted-foreground">{row.lrn}</TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>

                {rows.length > 0 && (
                    <div className="mt-3" data-table-id={tableId}>
                        <Pagination
                            data={paginationData}
                            onPageChange={setCurrentPage}
                            preserveScroll
                            preserveState
                        />
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

export default function MasterlistPage({ rolePrefix, k12Groups, collegeGroups }: Props) {
    const [k12Data, setK12Data] = useState(k12Groups);
    const [collegeData, setCollegeData] = useState(collegeGroups);

    useEffect(() => {
        setK12Data(k12Groups);
        setCollegeData(collegeGroups);
    }, [k12Groups, collegeGroups]);

    useEffect(() => {
        let isMounted = true;

        const pollData = async () => {
            try {
                const response = await axios.get(window.location.pathname, {
                    params: { json: 1 },
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest',
                        Accept: 'application/json',
                    },
                });

                if (!isMounted) {
                    return;
                }

                const payload = response.data as { k12Groups?: GroupRow[]; collegeGroups?: GroupRow[] };
                setK12Data(payload.k12Groups ?? []);
                setCollegeData(payload.collegeGroups ?? []);
            } catch {
                // Silent fail to avoid interrupting table interaction.
            }
        };

        const timer = setInterval(pollData, 15000);

        return () => {
            isMounted = false;
            clearInterval(timer);
        };
    }, []);

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
                    {k12Data.length === 0 ? (
                        <Card><CardContent className="py-6 text-muted-foreground">No K-12 students found.</CardContent></Card>
                    ) : (
                        k12Data.map((group) => (
                            <Card key={`k12-${group.group}`}>
                                <CardHeader>
                                    <CardTitle>{group.group}</CardTitle>
                                </CardHeader>
                                <CardContent className="grid gap-4 md:grid-cols-2">
                                    <GenderTable
                                        title="Male"
                                        rows={group.male}
                                        headerColor="oklch(58.8% 0.158 241.966)"
                                        tableId={`k12-${group.group}-male`}
                                    />
                                    <GenderTable
                                        title="Female"
                                        rows={group.female}
                                        headerColor="oklch(65.6% 0.241 354.308)"
                                        tableId={`k12-${group.group}-female`}
                                    />
                                </CardContent>
                            </Card>
                        ))
                    )}
                </section>

                <section className="space-y-4">
                    <h2 className="text-xl font-semibold">College Classification</h2>
                    {collegeData.length === 0 ? (
                        <Card><CardContent className="py-6 text-muted-foreground">No college students found.</CardContent></Card>
                    ) : (
                        collegeData.map((group) => (
                            <Card key={`college-${group.group}`}>
                                <CardHeader>
                                    <CardTitle>{group.group}</CardTitle>
                                </CardHeader>
                                <CardContent className="grid gap-4 md:grid-cols-2">
                                    <GenderTable
                                        title="Male"
                                        rows={group.male}
                                        headerColor="oklch(58.8% 0.158 241.966)"
                                        tableId={`college-${group.group}-male`}
                                    />
                                    <GenderTable
                                        title="Female"
                                        rows={group.female}
                                        headerColor="oklch(65.6% 0.241 354.308)"
                                        tableId={`college-${group.group}-female`}
                                    />
                                </CardContent>
                            </Card>
                        ))
                    )}
                </section>
            </div>
        </RoleLayout>
    );
}
