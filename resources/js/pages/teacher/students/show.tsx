import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, Mail, Phone, MapPin, School } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StudentPhoto } from '@/components/ui/student-photo';
import TeacherLayout from '@/layouts/teacher/teacher-layout';
import type { BreadcrumbItem } from '@/types';

interface RequirementRow {
    id: number;
    status?: string | null;
    requirement?: {
        id: number;
        name: string;
        category?: {
            id: number;
            name: string;
        } | null;
    } | null;
}

interface Student {
    id: number;
    first_name: string;
    middle_name?: string | null;
    last_name: string;
    suffix?: string | null;
    lrn?: string | null;
    email?: string | null;
    phone?: string | null;
    complete_address?: string | null;
    student_photo_url?: string | null;
    enrollment_status?: string | null;
    year_level?: string | null;
    section?: string | null;
    program?: string | null;
    department?: {
        id: number;
        name: string;
    } | null;
    requirements?: RequirementRow[];
}

interface Props {
    student: Student;
}

const enrollmentVariants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    enrolled: 'default',
    dropped: 'destructive',
    graduated: 'secondary',
    'pending-registrar': 'outline',
    'pending-accounting': 'outline',
    'pending-enrollment': 'outline',
};

export default function TeacherStudentShow({ student }: Props) {
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Students', href: '/teacher/students' },
        { title: `${student.last_name}, ${student.first_name}`, href: `/teacher/students/${student.id}` },
    ];

    const fullName = `${student.first_name}${student.middle_name ? ` ${student.middle_name}` : ''} ${student.last_name}${student.suffix ? ` ${student.suffix}` : ''}`;

    return (
        <TeacherLayout breadcrumbs={breadcrumbs}>
            <Head title={`Student - ${fullName}`} />

            <div className="space-y-6 p-6">
                <div className="flex items-center gap-3">
                    <Button variant="outline" size="icon" asChild>
                        <Link href="/teacher/students">
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                    </Button>
                    <h1 className="text-2xl font-bold">Student Profile</h1>
                </div>

                <Card>
                    <CardContent className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-center gap-4">
                            <StudentPhoto
                                src={student.student_photo_url}
                                firstName={student.first_name}
                                lastName={student.last_name}
                                size="xl"
                                bordered
                            />
                            <div>
                                <p className="text-2xl font-semibold">{fullName}</p>
                                <p className="text-sm text-muted-foreground">Student No: {student.lrn || 'N/A'}</p>
                            </div>
                        </div>
                        <Badge variant={enrollmentVariants[student.enrollment_status || ''] || 'outline'}>
                            {student.enrollment_status || 'Unknown'}
                        </Badge>
                    </CardContent>
                </Card>

                <div className="grid gap-6 lg:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Academic Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm">
                            <p><span className="font-medium">Department:</span> {student.department?.name || 'N/A'}</p>
                            <p><span className="font-medium">Program:</span> {student.program || 'N/A'}</p>
                            <p><span className="font-medium">Year Level:</span> {student.year_level || 'N/A'}</p>
                            <p><span className="font-medium">Section:</span> {student.section || 'N/A'}</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Contact Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm">
                            <p className="flex items-center gap-2"><Mail className="h-4 w-4" /> {student.email || 'N/A'}</p>
                            <p className="flex items-center gap-2"><Phone className="h-4 w-4" /> {student.phone || 'N/A'}</p>
                            <p className="flex items-center gap-2"><MapPin className="h-4 w-4" /> {student.complete_address || 'N/A'}</p>
                        </CardContent>
                    </Card>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <School className="h-5 w-5" />
                            Requirements
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {(student.requirements || []).length === 0 ? (
                            <p className="text-sm text-muted-foreground">No requirement records found.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b">
                                            <th className="px-3 py-2 text-left">Requirement</th>
                                            <th className="px-3 py-2 text-left">Category</th>
                                            <th className="px-3 py-2 text-left">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(student.requirements || []).map((item) => (
                                            <tr key={item.id} className="border-b">
                                                <td className="px-3 py-2">{item.requirement?.name || 'N/A'}</td>
                                                <td className="px-3 py-2">{item.requirement?.category?.name || 'Uncategorized'}</td>
                                                <td className="px-3 py-2 capitalize">{item.status || 'pending'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </TeacherLayout>
    );
}
