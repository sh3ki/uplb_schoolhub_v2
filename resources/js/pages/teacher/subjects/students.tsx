import { Head, Link, router } from '@inertiajs/react';
import { ArrowLeft, BookOpen, Users, Eye, UploadCloud } from 'lucide-react';
import { useState } from 'react';
import { GradeEntryModal } from '@/components/elms/grade-entry-modal';
import { FilterBar } from '@/components/filters/filter-bar';
import { FilterDropdown } from '@/components/filters/filter-dropdown';
import { SearchBar } from '@/components/filters/search-bar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Pagination } from '@/components/ui/pagination';
import { StudentPhoto } from '@/components/ui/student-photo';
import TeacherLayout from '@/layouts/teacher/teacher-layout';
import type { BreadcrumbItem } from '@/types';

interface Department {
    id: number;
    name: string;
    classification: 'K-12' | 'College';
}

interface YearLevel {
    id: number;
    name: string;
}

interface Subject {
    id: number;
    code: string;
    name: string;
    description: string | null;
    classification: 'K-12' | 'College';
    units: number | null;
    type: string;
    department: Department;
    year_level: YearLevel | null;
}

interface Student {
    id: number;
    student_subject_id: number;
    first_name: string;
    last_name: string;
    middle_name?: string | null;
    suffix?: string | null;
    lrn: string;
    email?: string;
    year_level?: string;
    section?: string;
    enrollment_status: string;
    subject_status: string;
    grade: number | null;
    draft_grade?: number | null;
    draft_breakdown?: Record<string, any> | null;
    grade_breakdown?: Record<string, any> | null;
    is_grade_posted?: boolean;
    gender?: string | null;
    student_photo_url?: string | null;
    department?: Department | null;
}

interface Props {
    subject: Subject;
    students: {
        data: Student[];
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
        from: number;
        to: number;
        links: any[];
    };
    currentSchoolYear: string;
    sections: string[];
    filters: {
        search?: string;
        section?: string;
        gender?: string;
        subject_status?: string;
    };
}

const getEnrollmentStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
        enrolled: { label: 'Enrolled', variant: 'default' },
        'pending-registrar': { label: 'Pending', variant: 'secondary' },
        'pending-accounting': { label: 'Pending', variant: 'secondary' },
        'pending-enrollment': { label: 'Enrollment Pending', variant: 'secondary' },
        'not-enrolled': { label: 'Not Enrolled', variant: 'outline' },
        graduated: { label: 'Graduated', variant: 'default' },
        dropped: { label: 'Dropped', variant: 'destructive' },
    };
    const config = statusMap[status] || { label: status, variant: 'outline' as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
};

const getFullName = (student: Student) => {
    return `${student.last_name}, ${student.first_name}${student.middle_name ? ` ${student.middle_name}` : ''}${student.suffix ? ` ${student.suffix}` : ''}`;
};

export default function SubjectStudents({ subject, students, currentSchoolYear, sections, filters }: Props) {
    const [search, setSearch] = useState(filters.search || '');
    const [section, setSection] = useState(filters.section || 'all');
    const [gender, setGender] = useState(filters.gender || 'all');
    const [subjectStatus, setSubjectStatus] = useState(filters.subject_status || 'all');
    const [postOpen, setPostOpen] = useState(false);
    const [activeStudent, setActiveStudent] = useState<Student | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Subjects', href: '/teacher/subjects' },
        { title: subject.name, href: `/teacher/subjects/${subject.id}/students` },
    ];

    const navigate = (params: Record<string, string>) => {
        const cleanParams = Object.fromEntries(
            Object.entries(params).filter(([_, v]) => v && v !== 'all')
        );
        router.get(`/teacher/subjects/${subject.id}/students`, cleanParams, { 
            preserveState: true, 
            preserveScroll: true 
        });
    };

    const handleSearchChange = (value: string) => {
        setSearch(value);
        navigate({ search: value, section, gender, subject_status: subjectStatus });
    };

    const handleSectionChange = (value: string) => {
        setSection(value);
        navigate({ search, section: value, gender, subject_status: subjectStatus });
    };

    const handleGenderChange = (value: string) => {
        setGender(value);
        navigate({ search, section, gender: value, subject_status: subjectStatus });
    };

    const handleSubjectStatusChange = (value: string) => {
        setSubjectStatus(value);
        navigate({ search, section, gender, subject_status: value });
    };

    const resetFilters = () => {
        setSearch('');
        setSection('all');
        setGender('all');
        setSubjectStatus('all');
        router.get(`/teacher/subjects/${subject.id}/students`);
    };

    const hasActiveFilters = !!(search || section !== 'all' || gender !== 'all' || subjectStatus !== 'all');

    const openPostDialog = (student: Student) => {
        setActiveStudent(student);
        setPostOpen(true);
    };

    const submitGrade = (payload: {
        action: 'save' | 'post';
        student_subject_id: number;
        notes: string;
        breakdown: {
            written_works: Array<{ title: string; score: number | null }>;
            performance_tasks: Array<{ title: string; score: number | null }>;
            examinations: Array<{ title: string; score: number | null }>;
            weights: {
                written_works: number;
                performance_tasks: number;
                examinations: number;
            };
        };
    }) => {
        setIsSubmitting(true);
        router.post('/teacher/subject-classes/post-grade', payload, {
            preserveScroll: true,
            onSuccess: () => {
                setPostOpen(false);
                setActiveStudent(null);
            },
            onFinish: () => {
                setIsSubmitting(false);
            },
        });
    };

    return (
        <TeacherLayout breadcrumbs={breadcrumbs}>
            <Head title={`${subject.name} - Students`} />

            <div className="space-y-6 p-6">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <Link href="/teacher/subjects">
                        <Button variant="outline" size="icon">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900">
                            <BookOpen className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-foreground">
                                {subject.name}
                            </h1>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="font-mono text-sm text-muted-foreground">{subject.code}</span>
                                <span className="text-muted-foreground">•</span>
                                <Badge variant={subject.classification === 'K-12' ? 'secondary' : 'default'}>
                                    {subject.classification}
                                </Badge>
                                {subject.year_level && (
                                    <>
                                        <span className="text-muted-foreground">•</span>
                                        <span className="text-sm text-muted-foreground">{subject.year_level.name}</span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Stats */}
                <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100 text-green-600">
                            <Users className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Total Students</p>
                            <p className="text-2xl font-bold">{students.total}</p>
                            <p className="text-xs text-muted-foreground">School Year: {currentSchoolYear}</p>
                        </div>
                    </CardContent>
                </Card>

                {/* Students Table */}
                <Card>
                    <CardHeader>
                        <CardTitle>Enrolled Students</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <FilterBar onReset={resetFilters} showReset={hasActiveFilters}>
                            <SearchBar 
                                value={search} 
                                onChange={handleSearchChange} 
                                placeholder="Search by name or LRN..." 
                            />
                            <FilterDropdown
                                label="Section"
                                value={section}
                                onChange={handleSectionChange}
                                options={sections.map(s => ({ value: s, label: s }))}
                                placeholder="All Sections"
                            />
                            <FilterDropdown
                                label="Gender"
                                value={gender}
                                onChange={handleGenderChange}
                                options={[
                                    { value: 'male', label: 'Male' },
                                    { value: 'female', label: 'Female' },
                                ]}
                                placeholder="All Gender"
                            />
                            <FilterDropdown
                                label="Subject Status"
                                value={subjectStatus}
                                onChange={handleSubjectStatusChange}
                                options={[
                                    { value: 'enrolled', label: 'Enrolled' },
                                    { value: 'completed', label: 'Completed' },
                                    { value: 'failed', label: 'Failed' },
                                    { value: 'dropped', label: 'Dropped' },
                                ]}
                                placeholder="All Status"
                            />
                        </FilterBar>

                        <div className="mt-6 overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b">
                                        <th className="p-3 text-left font-semibold">Student</th>
                                        <th className="p-3 text-left font-semibold">Student No.</th>
                                        <th className="p-3 text-left font-semibold">Year Level</th>
                                        <th className="p-3 text-left font-semibold">Section</th>
                                            <th className="p-3 text-center font-semibold">Status</th>
                                            <th className="p-3 text-center font-semibold">Grade</th>
                                            <th className="p-3 text-center font-semibold">Publish</th>
                                        <th className="p-3 text-center font-semibold">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {students.data.length === 0 ? (
                                        <tr>
                                                <td colSpan={8} className="p-8 text-center text-gray-500">
                                                No students found for this subject.
                                            </td>
                                        </tr>
                                    ) : (
                                        students.data.map((student) => (
                                            <tr key={student.id} className="border-b hover:bg-gray-50">
                                                <td className="p-3">
                                                    <div className="flex items-center gap-3">
                                                        <StudentPhoto 
                                                            src={student.student_photo_url}
                                                            firstName={student.first_name}
                                                            lastName={student.last_name}
                                                            size="md"
                                                        />
                                                        <div>
                                                            <p className="font-medium">{getFullName(student)}</p>
                                                            <p className="text-sm text-muted-foreground">{student.email}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-3">
                                                    <span className="font-mono text-sm">{student.lrn}</span>
                                                </td>
                                                <td className="p-3 text-sm">{student.year_level || '-'}</td>
                                                <td className="p-3 text-sm">{student.section || '-'}</td>
                                                <td className="p-3 text-center">
                                                    {getEnrollmentStatusBadge(student.enrollment_status)}
                                                </td>
                                                <td className="p-3 text-center font-medium">
                                                    {student.is_grade_posted === false ? (student.draft_grade ?? '-') : (student.grade ?? '-')}
                                                </td>
                                                <td className="p-3 text-center">
                                                    {student.is_grade_posted === false ? (
                                                        <span className="inline-block rounded bg-amber-100 px-2 py-1 text-xs text-amber-700">Draft</span>
                                                    ) : (
                                                        <span className="inline-block rounded bg-green-100 px-2 py-1 text-xs text-green-700">Posted</span>
                                                    )}
                                                </td>
                                                <td className="p-3 text-center">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() => router.visit(`/teacher/students/${student.id}`)}
                                                        >
                                                            <Eye className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => openPostDialog(student)}
                                                        >
                                                            <UploadCloud className="mr-1 h-4 w-4" />
                                                            Open Grade Sheet
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <Pagination data={students} />
                    </CardContent>
                </Card>
            </div>

            {activeStudent ? (
                <GradeEntryModal
                    open={postOpen}
                    onOpenChange={setPostOpen}
                    studentName={getFullName(activeStudent)}
                    studentNumber={activeStudent.lrn}
                    studentSubjectId={activeStudent.student_subject_id}
                    initialBreakdown={activeStudent.draft_breakdown ?? activeStudent.grade_breakdown ?? null}
                    processing={isSubmitting}
                    onSubmit={submitGrade}
                />
            ) : null}
        </TeacherLayout>
    );
}
