import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, Mail, Phone, MapPin, School, BookOpen, TrendingUp } from 'lucide-react';
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

interface GradeRow {
    id: number;
    subject_code?: string | null;
    subject_name?: string | null;
    units?: number | null;
    semester?: number | null;
    school_year?: string | null;
    status?: string | null;
    grade?: number | null;
    draft_grade?: number | null;
    is_grade_posted?: boolean;
    grade_posted_at?: string | null;
}

interface Props {
    student: Student;
    currentSchoolYear: string;
    gradeRows: GradeRow[];
    summary: {
        total_subjects: number;
        posted_subjects: number;
        draft_subjects: number;
        passed_subjects: number;
        failed_subjects: number;
    };
}

const enrollmentVariants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    enrolled: 'default',
    dropped: 'destructive',
    graduated: 'secondary',
    'pending-registrar': 'outline',
    'pending-accounting': 'outline',
    'pending-enrollment': 'outline',
};

export default function TeacherStudentShow({ student, currentSchoolYear, gradeRows, summary }: Props) {
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

                <div className="grid gap-4 md:grid-cols-5">
                    <Card>
                        <CardContent className="p-4">
                            <p className="text-xs text-muted-foreground">Current S.Y.</p>
                            <p className="text-sm font-semibold">{currentSchoolYear}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4">
                            <p className="text-xs text-muted-foreground">Total Subjects</p>
                            <p className="text-2xl font-bold">{summary.total_subjects}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4">
                            <p className="text-xs text-muted-foreground">Posted Grades</p>
                            <p className="text-2xl font-bold text-green-600">{summary.posted_subjects}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4">
                            <p className="text-xs text-muted-foreground">Draft Grades</p>
                            <p className="text-2xl font-bold text-amber-600">{summary.draft_subjects}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4">
                            <p className="text-xs text-muted-foreground">Passed / Failed</p>
                            <p className="text-sm font-semibold">{summary.passed_subjects} / {summary.failed_subjects}</p>
                        </CardContent>
                    </Card>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <BookOpen className="h-5 w-5" />
                            Grade Details
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {gradeRows.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No grade records found.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b">
                                            <th className="px-3 py-2 text-left">Code</th>
                                            <th className="px-3 py-2 text-left">Subject</th>
                                            <th className="px-3 py-2 text-center">S.Y.</th>
                                            <th className="px-3 py-2 text-center">Sem</th>
                                            <th className="px-3 py-2 text-center">Grade</th>
                                            <th className="px-3 py-2 text-center">State</th>
                                            <th className="px-3 py-2 text-center">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {gradeRows.map((row) => (
                                            <tr key={row.id} className="border-b">
                                                <td className="px-3 py-2 font-mono text-xs">{row.subject_code || '-'}</td>
                                                <td className="px-3 py-2">
                                                    <p className="font-medium">{row.subject_name || '-'}</p>
                                                    <p className="text-xs text-muted-foreground">Units: {row.units ?? '-'}</p>
                                                </td>
                                                <td className="px-3 py-2 text-center">{row.school_year || '-'}</td>
                                                <td className="px-3 py-2 text-center">{row.semester ?? '-'}</td>
                                                <td className="px-3 py-2 text-center">
                                                    {row.is_grade_posted ? (row.grade ?? '-') : (row.draft_grade ?? '-')}
                                                </td>
                                                <td className="px-3 py-2 text-center">
                                                    {row.is_grade_posted ? (
                                                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Posted</Badge>
                                                    ) : (
                                                        <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Draft</Badge>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2 text-center capitalize">{row.status || '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>

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
