import { Head } from '@inertiajs/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Pagination } from '@/components/ui/pagination';
import TeacherLayout from '@/layouts/teacher/teacher-layout';
import type { BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Student Profiles', href: '/teacher/advisory/student-profiles' },
];

interface StudentRow {
    id: number;
    student_number: string | null;
    name: string;
    gender: string | null;
    program: string | null;
    year_level: string | null;
    section: string | null;
    email: string | null;
    phone: string | null;
    guardian_name: string | null;
    guardian_contact: string | null;
}

interface Props {
    students: {
        data: StudentRow[];
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
        from: number;
        to: number;
        links: any[];
    };
}

export default function AdvisoryStudentProfilesPage({ students }: Props) {
    return (
        <TeacherLayout breadcrumbs={breadcrumbs}>
            <Head title="Advisory Student Profiles" />

            <div className="space-y-6 p-6">
                <div>
                    <h1 className="text-2xl font-bold">Student Profiles</h1>
                    <p className="text-sm text-muted-foreground">Advisory students and guardian contact information.</p>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Advisory Students</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {students.data.length === 0 ? (
                            <p className="py-8 text-center text-sm text-muted-foreground">No advisory students found.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b">
                                            <th className="px-3 py-2 text-left">Student No.</th>
                                            <th className="px-3 py-2 text-left">Name</th>
                                            <th className="px-3 py-2 text-left">Section</th>
                                            <th className="px-3 py-2 text-left">Program</th>
                                            <th className="px-3 py-2 text-left">Guardian</th>
                                            <th className="px-3 py-2 text-left">Guardian Contact</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {students.data.map((student) => (
                                            <tr key={student.id} className="border-b">
                                                <td className="px-3 py-2">{student.student_number ?? '-'}</td>
                                                <td className="px-3 py-2 font-medium">{student.name}</td>
                                                <td className="px-3 py-2">{student.section ?? '-'}</td>
                                                <td className="px-3 py-2">{student.program ?? '-'}</td>
                                                <td className="px-3 py-2">{student.guardian_name ?? '-'}</td>
                                                <td className="px-3 py-2">{student.guardian_contact ?? '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        <div className="mt-4">
                            <Pagination data={students} />
                        </div>
                    </CardContent>
                </Card>
            </div>
        </TeacherLayout>
    );
}
