import { Head, useForm } from '@inertiajs/react';
import { FilePlus2, Paperclip, Trash2, Upload } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Pagination } from '@/components/ui/pagination';
import TeacherLayout from '@/layouts/teacher/teacher-layout';
import type { BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'My Materials', href: '/teacher/materials' },
];

interface Material {
    id: number;
    title: string;
    description: string | null;
    original_filename: string;
    file_url: string;
    file_size_label: string;
    created_at: string | null;
}

interface Props {
    materials: {
        data: Material[];
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
        from: number;
        to: number;
        links: any[];
    };
}

export default function TeacherMaterialsPage({ materials }: Props) {
    const form = useForm({
        title: '',
        description: '',
        attachment: null as File | null,
    });

    const submit = (event: React.FormEvent) => {
        event.preventDefault();
        form.post('/teacher/materials', {
            forceFormData: true,
            onSuccess: () => form.reset(),
        });
    };

    const remove = (id: number) => {
        if (!window.confirm('Delete this material?')) return;
        form.delete(`/teacher/materials/${id}`);
    };

    return (
        <TeacherLayout breadcrumbs={breadcrumbs}>
            <Head title="My Materials" />

            <div className="space-y-6 p-6">
                <div>
                    <h1 className="text-2xl font-bold">My Materials</h1>
                    <p className="text-sm text-muted-foreground">Upload and manage your private teaching materials.</p>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Upload className="h-5 w-5" />
                            Upload Material
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
                            <div className="grid gap-2 md:col-span-2">
                                <Label htmlFor="title">Title</Label>
                                <Input
                                    id="title"
                                    value={form.data.title}
                                    onChange={(event) => form.setData('title', event.target.value)}
                                    placeholder="e.g. Chapter 4 Slides"
                                    required
                                />
                            </div>

                            <div className="grid gap-2 md:col-span-2">
                                <Label htmlFor="description">Description</Label>
                                <Textarea
                                    id="description"
                                    value={form.data.description}
                                    onChange={(event) => form.setData('description', event.target.value)}
                                    placeholder="Optional note for this material"
                                    rows={3}
                                />
                            </div>

                            <div className="grid gap-2 md:col-span-2">
                                <Label htmlFor="attachment">Attachment</Label>
                                <Input
                                    id="attachment"
                                    type="file"
                                    required
                                    onChange={(event) => form.setData('attachment', event.target.files?.[0] ?? null)}
                                />
                            </div>

                            <div className="md:col-span-2 flex justify-end">
                                <Button type="submit" disabled={form.processing}>
                                    <FilePlus2 className="mr-2 h-4 w-4" />
                                    {form.processing ? 'Uploading...' : 'Save Material'}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Saved Materials</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {materials.data.length === 0 ? (
                            <p className="py-8 text-center text-sm text-muted-foreground">No materials yet.</p>
                        ) : (
                            <div className="space-y-3">
                                {materials.data.map((material) => (
                                    <div key={material.id} className="flex items-start justify-between rounded-lg border p-3">
                                        <div className="min-w-0">
                                            <p className="font-medium">{material.title}</p>
                                            <p className="text-xs text-muted-foreground">{material.original_filename} • {material.file_size_label}</p>
                                            {material.description && (
                                                <p className="mt-1 text-sm text-muted-foreground">{material.description}</p>
                                            )}
                                            <a href={material.file_url} className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline">
                                                <Paperclip className="h-3 w-3" />
                                                Open file
                                            </a>
                                        </div>
                                        <Button size="icon" variant="ghost" onClick={() => remove(material.id)}>
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="mt-4">
                            <Pagination data={materials} />
                        </div>
                    </CardContent>
                </Card>
            </div>
        </TeacherLayout>
    );
}
