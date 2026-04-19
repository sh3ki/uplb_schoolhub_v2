import { Head } from '@inertiajs/react';
import { router } from '@inertiajs/react';
import { useState } from 'react';
import { UploadCloud } from 'lucide-react';
import { GradeEntryModal } from '@/components/elms/grade-entry-modal';
import { FilterBar } from '@/components/filters/filter-bar';
import { FilterDropdown } from '@/components/filters/filter-dropdown';
import { SearchBar } from '@/components/filters/search-bar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Pagination } from '@/components/ui/pagination';
import { StudentPhoto } from '@/components/ui/student-photo';
import TeacherLayout from '@/layouts/teacher/teacher-layout';

interface StudentSubjectRow {
    id: number;
    student_id: number;
    subject_id: number;
    grade: number | null;
    draft_grade?: number | null;
    draft_breakdown?: Record<string, any> | null;
    grade_breakdown?: Record<string, any> | null;
    is_grade_posted?: boolean;
    status: string;
}

interface Student {
    id: number;
    first_name: string;
    last_name: string;
    middle_name?: string | null;
    student_photo_url?: string | null;
    lrn: string;
    section: string;
    year_level: string;
    enrollment_status: string;
    student_subjects: StudentSubjectRow[];
}

interface SectionOption {
    id: number;
    name: string;
}

interface SubjectOption {
    id: number;
    name: string;
}

interface Props {
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
    sections: SectionOption[];
    subjects: SubjectOption[];
    currentSchoolYear: string;
    filters: {
        search?: string;
        section?: string;
        subject?: string;
    };
}

export default function GradesIndex({ students, sections, subjects, currentSchoolYear, filters }: Props) {
    const [search, setSearch] = useState(filters.search || '');
    const [section, setSection] = useState(filters.section || 'all');
    const [subject, setSubject] = useState(filters.subject || 'all');
    const [postOpen, setPostOpen] = useState(false);
    const [activeStudent, setActiveStudent] = useState<Student | null>(null);
    const [activeEnrollment, setActiveEnrollment] = useState<StudentSubjectRow | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const navigate = (params: Record<string, string>) => {
        router.get('/teacher/grades', params, { preserveState: true, preserveScroll: true });
    };

    const handleSearchChange = (value: string) => {
        setSearch(value);
        navigate({ search: value, section, subject });
    };

    const handleSectionChange = (value: string) => {
        setSection(value);
        navigate({ search, section: value, subject });
    };

    const handleSubjectChange = (value: string) => {
        setSubject(value);
        navigate({ search, section, subject: value });
    };

    const resetFilters = () => {
        setSearch('');
        setSection('all');
        setSubject('all');
        router.get('/teacher/grades');
    };

    const openPostDialog = (student: Student) => {
        if (subject === 'all') {
            return;
        }

        const enrollment = student.student_subjects.find((row) => row.subject_id === Number(subject));
        if (!enrollment) {
            return;
        }

        setActiveStudent(student);
        setActiveEnrollment(enrollment);
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
                setActiveEnrollment(null);
            },
            onFinish: () => {
                setIsSubmitting(false);
            },
        });
    };

    const getEnrollment = (student: Student) => {
        if (subject === 'all') return null;
        return student.student_subjects.find((row) => row.subject_id === Number(subject)) || null;
    };

    return (
        <TeacherLayout>
            <Head title="Grades" />

            <div className="space-y-6 p-6">
                <div>
                    <h1 className="text-3xl font-bold">Grades</h1>
                    <p className="mt-1 text-sm text-gray-600">View and post student grades for your assigned classes</p>
                    <p className="text-xs text-muted-foreground">School Year: {currentSchoolYear}</p>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Student Grades</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <FilterBar onReset={resetFilters} showReset={!!(search || section !== 'all' || subject !== 'all')}>
                            <SearchBar value={search} onChange={handleSearchChange} placeholder="Search students..." />
                            <FilterDropdown
                                label="Section"
                                value={section}
                                onChange={handleSectionChange}
                                options={sections.map((s) => ({ value: s.name, label: s.name }))}
                                placeholder="All Sections"
                            />
                            <FilterDropdown
                                label="Subject"
                                value={subject}
                                onChange={handleSubjectChange}
                                options={subjects.map((s) => ({ value: s.id.toString(), label: s.name }))}
                                placeholder="All Subjects"
                            />
                        </FilterBar>

                        <div className="mt-6 overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b">
                                        <th className="p-3 text-left font-semibold">Student No.</th>
                                        <th className="p-3 text-left font-semibold">Name</th>
                                        <th className="p-3 text-left font-semibold">Section</th>
                                        <th className="p-3 text-left font-semibold">Year Level</th>
                                        <th className="p-3 text-center font-semibold">Status</th>
                                        <th className="p-3 text-center font-semibold">Grade</th>
                                        <th className="p-3 text-center font-semibold">Publish</th>
                                        <th className="p-3 text-center font-semibold">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {students.data.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="p-8 text-center text-gray-500">
                                                No students found.
                                            </td>
                                        </tr>
                                    ) : (
                                        students.data.map((student) => (
                                            <tr key={student.id} className="border-b hover:bg-gray-50">
                                                <td className="p-3 font-mono text-sm">{student.lrn}</td>
                                                <td className="p-3 font-medium">
                                                    <div className="flex items-center gap-2">
                                                        <StudentPhoto
                                                            src={student.student_photo_url}
                                                            firstName={student.first_name}
                                                            lastName={student.last_name}
                                                            size="sm"
                                                        />
                                                        <span>{student.last_name}, {student.first_name}</span>
                                                    </div>
                                                </td>
                                                <td className="p-3 text-sm">{student.section || '-'}</td>
                                                <td className="p-3 text-sm">{student.year_level || '-'}</td>
                                                <td className="p-3 text-center">
                                                    <span className={`inline-block rounded px-2 py-1 text-xs capitalize ${
                                                        student.enrollment_status === 'enrolled'
                                                            ? 'bg-green-100 text-green-700'
                                                            : 'bg-gray-100 text-gray-700'
                                                    }`}>
                                                        {student.enrollment_status}
                                                    </span>
                                                </td>
                                                <td className="p-3 text-center text-sm font-medium">
                                                    {getEnrollment(student)?.grade ?? '-'}
                                                </td>
                                                <td className="p-3 text-center">
                                                    {getEnrollment(student)?.is_grade_posted === false ? (
                                                        <span className="inline-block rounded bg-amber-100 px-2 py-1 text-xs text-amber-700">Draft</span>
                                                    ) : (
                                                        <span className="inline-block rounded bg-green-100 px-2 py-1 text-xs text-green-700">Posted</span>
                                                    )}
                                                </td>
                                                <td className="p-3 text-center">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        disabled={!getEnrollment(student)}
                                                        onClick={() => openPostDialog(student)}
                                                    >
                                                        <UploadCloud className="mr-1 h-4 w-4" />
                                                        Open Grade Sheet
                                                    </Button>
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

            {activeStudent && activeEnrollment ? (
                <GradeEntryModal
                    open={postOpen}
                    onOpenChange={setPostOpen}
                    studentName={`${activeStudent.last_name}, ${activeStudent.first_name}`}
                    studentNumber={activeStudent.lrn}
                    studentSubjectId={activeEnrollment.id}
                    initialBreakdown={activeEnrollment.draft_breakdown ?? activeEnrollment.grade_breakdown ?? null}
                    processing={isSubmitting}
                    onSubmit={submitGrade}
                />
            ) : null}
        </TeacherLayout>
    );
}
