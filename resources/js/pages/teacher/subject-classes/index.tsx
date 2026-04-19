import { Head, router, useForm } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import TeacherLayout from '@/layouts/teacher/teacher-layout';
import type { BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'My Subject Classes', href: '/teacher/subject-classes' },
];

interface SubjectRow {
    id: number;
    code: string;
    name: string;
    student_count: number;
}

interface EnrollmentRow {
    id: number;
    student_id: number;
    student_name: string;
    student_number: string | null;
    section: string | null;
    program: string | null;
    grade: number | null;
    status: string;
    updated_at: string | null;
}

interface Props {
    subjects: SubjectRow[];
    selectedSubjectId: number;
    currentSchoolYear: string;
    enrollments: EnrollmentRow[];
}

export default function TeacherSubjectClassesPage({ subjects, selectedSubjectId, currentSchoolYear, enrollments }: Props) {
    const [selected, setSelected] = useState<string>(selectedSubjectId ? selectedSubjectId.toString() : '');
    const [modalOpen, setModalOpen] = useState(false);
    const [activeEnrollment, setActiveEnrollment] = useState<EnrollmentRow | null>(null);

    const form = useForm({
        student_subject_id: 0,
        grade: '',
        notes: '',
    });

    useEffect(() => {
        setSelected(selectedSubjectId ? selectedSubjectId.toString() : '');
    }, [selectedSubjectId]);

    const selectedSubjectLabel = useMemo(() => {
        return subjects.find((subject) => subject.id === Number(selected))?.name ?? 'Subject';
    }, [subjects, selected]);

    const onSubjectChange = (value: string) => {
        setSelected(value);
        router.get('/teacher/subject-classes', { subject_id: value }, { preserveState: true, preserveScroll: true });
    };

    const openPostModal = (enrollment: EnrollmentRow) => {
        setActiveEnrollment(enrollment);
        form.setData({
            student_subject_id: enrollment.id,
            grade: enrollment.grade !== null ? enrollment.grade.toString() : '',
            notes: '',
        });
        setModalOpen(true);
    };

    const submitPost = () => {
        form.post('/teacher/subject-classes/post-grade', {
            preserveScroll: true,
            onSuccess: () => {
                setModalOpen(false);
                setActiveEnrollment(null);
            },
        });
    };

    return (
        <TeacherLayout breadcrumbs={breadcrumbs}>
            <Head title="My Subject Classes" />

            <div className="space-y-6 p-6">
                <div>
                    <h1 className="text-2xl font-bold">My Subject Classes</h1>
                    <p className="text-sm text-muted-foreground">Select a subject, click a student row, and post grade updates that students can view.</p>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Filter</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 md:grid-cols-2">
                        <div className="grid gap-2">
                            <Label>Subject</Label>
                            <Select value={selected} onValueChange={onSubjectChange}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select subject" />
                                </SelectTrigger>
                                <SelectContent>
                                    {subjects.map((subject) => (
                                        <SelectItem key={subject.id} value={subject.id.toString()}>
                                            {subject.code} - {subject.name} ({subject.student_count})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="rounded-lg border p-3 text-sm text-muted-foreground">
                            Current School Year: <span className="font-medium text-foreground">{currentSchoolYear}</span>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>{selectedSubjectLabel} Students</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {enrollments.length === 0 ? (
                            <p className="py-8 text-center text-sm text-muted-foreground">No enrolled students for this subject in the current school year.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b">
                                            <th className="px-3 py-2 text-left">Student</th>
                                            <th className="px-3 py-2 text-left">Student No.</th>
                                            <th className="px-3 py-2 text-left">Section</th>
                                            <th className="px-3 py-2 text-left">Program</th>
                                            <th className="px-3 py-2 text-center">Grade</th>
                                            <th className="px-3 py-2 text-center">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {enrollments.map((enrollment) => (
                                            <tr
                                                key={enrollment.id}
                                                className="cursor-pointer border-b hover:bg-muted/50"
                                                onClick={() => openPostModal(enrollment)}
                                            >
                                                <td className="px-3 py-2 font-medium">{enrollment.student_name}</td>
                                                <td className="px-3 py-2">{enrollment.student_number ?? '-'}</td>
                                                <td className="px-3 py-2">{enrollment.section ?? '-'}</td>
                                                <td className="px-3 py-2">{enrollment.program ?? '-'}</td>
                                                <td className="px-3 py-2 text-center">{enrollment.grade ?? '-'}</td>
                                                <td className="px-3 py-2 text-center capitalize">{enrollment.status}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Post Grade</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="rounded-lg border p-3 text-sm">
                            <p className="font-medium">{activeEnrollment?.student_name}</p>
                            <p className="text-muted-foreground">{activeEnrollment?.student_number ?? 'No student number'}</p>
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="grade">Grade</Label>
                            <Input
                                id="grade"
                                type="number"
                                min={0}
                                max={100}
                                value={form.data.grade}
                                onChange={(event) => form.setData('grade', event.target.value)}
                                placeholder="0 to 100"
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="notes">Notes</Label>
                            <Textarea
                                id="notes"
                                rows={3}
                                value={form.data.notes}
                                onChange={(event) => form.setData('notes', event.target.value)}
                                placeholder="Optional note visible in activity history"
                            />
                        </div>

                        <p className="text-xs text-muted-foreground">Confirming this posts the grade and updates the student record status.</p>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
                        <Button onClick={submitPost} disabled={form.processing}>Confirm Post</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </TeacherLayout>
    );
}
