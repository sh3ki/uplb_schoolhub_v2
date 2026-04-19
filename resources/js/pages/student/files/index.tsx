import { Head } from '@inertiajs/react';
import { Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Pagination } from '@/components/ui/pagination';
import StudentLayout from '@/layouts/student/student-layout';
import type { BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Class Files', href: '/student/files' },
];

interface FileRow {
    id: number;
    title: string;
    description: string | null;
    original_filename: string;
    file_url: string;
    teacher_name: string;
    target_label: string;
    sent_at: string | null;
}

interface Props {
    files: {
        data: FileRow[];
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
        from: number;
        to: number;
        links: any[];
    };
}

export default function StudentFilesPage({ files }: Props) {
    return (
        <StudentLayout breadcrumbs={breadcrumbs}>
            <Head title="Class Files" />

            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold">Class Files</h1>
                    <p className="text-sm text-muted-foreground">Files sent by your teachers to your subjects and advisory section.</p>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Received Files</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {files.data.length === 0 ? (
                            <p className="py-8 text-center text-sm text-muted-foreground">No files received yet.</p>
                        ) : (
                            <div className="space-y-3">
                                {files.data.map((file) => (
                                    <div key={file.id} className="rounded-lg border p-3">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="font-medium">{file.title}</p>
                                                <p className="text-xs text-muted-foreground">{file.target_label} • From: {file.teacher_name}</p>
                                                <p className="text-xs text-muted-foreground">{file.original_filename} • {file.sent_at ?? 'N/A'}</p>
                                                {file.description && <p className="mt-1 text-sm text-muted-foreground">{file.description}</p>}
                                            </div>
                                            <a href={file.file_url} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                                                <Download className="h-4 w-4" />
                                                Open
                                            </a>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="mt-4">
                            <Pagination data={files} />
                        </div>
                    </CardContent>
                </Card>
            </div>
        </StudentLayout>
    );
}
