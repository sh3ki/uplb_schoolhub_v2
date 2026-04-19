import { Head, router } from '@inertiajs/react';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import RegistrarLayout from '@/layouts/registrar/registrar-layout';
import type { BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'E-LMS Posted Grades', href: '/registrar/elms/grades' },
];

interface GradeRow {
    id: number;
    student_name: string;
    student_number: string | null;
    section: string | null;
    program: string | null;
    year_level: string | null;
    subject_code: string | null;
    subject_name: string | null;
    grade: string | null;
    status: string;
    updated_at: string | null;
}

interface Props {
    postedGrades: {
        data: GradeRow[];
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
        from: number;
        to: number;
        links: any[];
    };
    filters: {
        search?: string;
    };
    currentSchoolYear: string;
}

export default function RegistrarElmsGradesPage({ postedGrades, filters, currentSchoolYear }: Props) {
    const [search, setSearch] = useState(filters.search ?? '');

    const onSearchChange = (value: string) => {
        setSearch(value);
        router.get('/registrar/elms/grades', { search: value }, { preserveState: true, preserveScroll: true, replace: true });
    };

    return (
        <RegistrarLayout breadcrumbs={breadcrumbs}>
            <Head title="E-LMS Posted Grades" />

            <div className="space-y-6 p-6">
                <div>
                    <h1 className="text-2xl font-bold">E-LMS Posted Grades</h1>
                    <p className="text-sm text-muted-foreground">Registrar visibility for teacher-posted grades ({currentSchoolYear}).</p>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Filters</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Input
                            value={search}
                            onChange={(event) => onSearchChange(event.target.value)}
                            placeholder="Search student name or student number..."
                        />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Posted Grade Entries</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {postedGrades.data.length === 0 ? (
                            <p className="py-8 text-center text-sm text-muted-foreground">No posted grades found.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b">
                                            <th className="px-3 py-2 text-left">Student</th>
                                            <th className="px-3 py-2 text-left">Student No.</th>
                                            <th className="px-3 py-2 text-left">Section</th>
                                            <th className="px-3 py-2 text-left">Subject</th>
                                            <th className="px-3 py-2 text-center">Grade</th>
                                            <th className="px-3 py-2 text-center">Status</th>
                                            <th className="px-3 py-2 text-left">Updated</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {postedGrades.data.map((row) => (
                                            <tr key={row.id} className="border-b">
                                                <td className="px-3 py-2 font-medium">{row.student_name}</td>
                                                <td className="px-3 py-2">{row.student_number ?? '-'}</td>
                                                <td className="px-3 py-2">{row.section ?? '-'}</td>
                                                <td className="px-3 py-2">{row.subject_code} - {row.subject_name}</td>
                                                <td className="px-3 py-2 text-center">{row.grade ?? '-'}</td>
                                                <td className="px-3 py-2 text-center capitalize">{row.status}</td>
                                                <td className="px-3 py-2">{row.updated_at ?? '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        <div className="mt-4">
                            <Pagination data={postedGrades} />
                        </div>
                    </CardContent>
                </Card>
            </div>
        </RegistrarLayout>
    );
}
