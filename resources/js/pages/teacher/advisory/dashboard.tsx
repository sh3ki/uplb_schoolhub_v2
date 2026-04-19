import { Head } from '@inertiajs/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import TeacherLayout from '@/layouts/teacher/teacher-layout';
import type { BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Advisory Dashboard', href: '/teacher/advisory/dashboard' },
];

interface Section {
    id: number;
    name: string;
    room_number: string | null;
    student_count: number;
}

interface Props {
    sections: Section[];
    summary: {
        total_sections: number;
        total_students: number;
        male_students: number;
        female_students: number;
    };
}

export default function AdvisoryDashboardPage({ sections, summary }: Props) {
    return (
        <TeacherLayout breadcrumbs={breadcrumbs}>
            <Head title="Advisory Dashboard" />

            <div className="space-y-6 p-6">
                <div>
                    <h1 className="text-2xl font-bold">Advisory Dashboard</h1>
                    <p className="text-sm text-muted-foreground">Overview of your advisory sections and students.</p>
                </div>

                <div className="grid gap-4 md:grid-cols-4">
                    <Card>
                        <CardContent className="p-4">
                            <p className="text-xs text-muted-foreground">Sections</p>
                            <p className="text-2xl font-bold">{summary.total_sections}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4">
                            <p className="text-xs text-muted-foreground">Students</p>
                            <p className="text-2xl font-bold">{summary.total_students}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4">
                            <p className="text-xs text-muted-foreground">Male</p>
                            <p className="text-2xl font-bold">{summary.male_students}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4">
                            <p className="text-xs text-muted-foreground">Female</p>
                            <p className="text-2xl font-bold">{summary.female_students}</p>
                        </CardContent>
                    </Card>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Assigned Advisory Sections</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {sections.length === 0 ? (
                            <p className="py-8 text-center text-sm text-muted-foreground">No advisory sections assigned.</p>
                        ) : (
                            <div className="space-y-2">
                                {sections.map((section) => (
                                    <div key={section.id} className="flex items-center justify-between rounded-lg border p-3">
                                        <div>
                                            <p className="font-medium">{section.name}</p>
                                            <p className="text-xs text-muted-foreground">Room: {section.room_number ?? 'N/A'}</p>
                                        </div>
                                        <p className="text-sm font-semibold">{section.student_count} students</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </TeacherLayout>
    );
}
