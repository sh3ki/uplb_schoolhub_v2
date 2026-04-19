import { Head, router, useForm } from '@inertiajs/react';
import { Download, FilePlus2, FileText, Filter, Search, Trash2, Upload } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Pagination } from '@/components/ui/pagination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
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
    download_url: string;
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
    filters: {
        search?: string;
        file_type?: string;
        from_date?: string;
        to_date?: string;
    };
}

const fileTypeOptions = [
    { value: 'all', label: 'All Categories' },
    { value: 'pdf', label: 'PDF' },
    { value: 'doc', label: 'Word (DOC)' },
    { value: 'docx', label: 'Word (DOCX)' },
    { value: 'ppt', label: 'PowerPoint (PPT)' },
    { value: 'pptx', label: 'PowerPoint (PPTX)' },
    { value: 'xls', label: 'Excel (XLS)' },
    { value: 'xlsx', label: 'Excel (XLSX)' },
    { value: 'jpg', label: 'Image (JPG)' },
    { value: 'png', label: 'Image (PNG)' },
];

export default function TeacherMaterialsPage({ materials, filters }: Props) {
    const [uploadOpen, setUploadOpen] = useState(false);

    const [search, setSearch] = useState(filters.search || '');
    const [fileType, setFileType] = useState(filters.file_type || 'all');
    const [fromDate, setFromDate] = useState(filters.from_date || '');
    const [toDate, setToDate] = useState(filters.to_date || '');

    const form = useForm({
        title: '',
        description: '',
        attachment: null as File | null,
    });

    const applyFilters = (next?: Partial<{ search: string; file_type: string; from_date: string; to_date: string }>) => {
        router.get('/teacher/materials', {
            search: next?.search ?? search,
            file_type: next?.file_type ?? fileType,
            from_date: next?.from_date ?? fromDate,
            to_date: next?.to_date ?? toDate,
        }, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const submit = (event: React.FormEvent) => {
        event.preventDefault();
        form.post('/teacher/materials', {
            forceFormData: true,
            onSuccess: () => {
                form.reset();
                setUploadOpen(false);
            },
        });
    };

    const remove = (id: number) => {
        if (!window.confirm('Delete this material?')) return;
        router.delete(`/teacher/materials/${id}`);
    };

    return (
        <TeacherLayout breadcrumbs={breadcrumbs}>
            <Head title="My Materials" />

            <div className="space-y-6 p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">My Materials</h1>
                        <p className="text-sm text-muted-foreground">All uploaded materials for your classes.</p>
                    </div>
                    <Button onClick={() => setUploadOpen(true)}>
                        <Upload className="mr-2 h-4 w-4" />
                        Upload New Material
                    </Button>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-xl">
                            <Filter className="h-5 w-5" />
                            All Uploaded Materials
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                            <div className="relative xl:col-span-2">
                                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    value={search}
                                    onChange={(event) => {
                                        setSearch(event.target.value);
                                        applyFilters({ search: event.target.value });
                                    }}
                                    className="pl-9"
                                    placeholder="Search by title or file name..."
                                />
                            </div>

                            <Select
                                value={fileType}
                                onValueChange={(value) => {
                                    setFileType(value);
                                    applyFilters({ file_type: value });
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="File Type" />
                                </SelectTrigger>
                                <SelectContent>
                                    {fileTypeOptions.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <Input
                                type="date"
                                value={fromDate}
                                onChange={(event) => {
                                    setFromDate(event.target.value);
                                    applyFilters({ from_date: event.target.value });
                                }}
                            />

                            <Input
                                type="date"
                                value={toDate}
                                onChange={(event) => {
                                    setToDate(event.target.value);
                                    applyFilters({ to_date: event.target.value });
                                }}
                            />
                        </div>
                    </CardContent>
                </Card>

                {materials.data.length === 0 ? (
                    <Card>
                        <CardContent className="py-14 text-center text-sm text-muted-foreground">
                            No materials found for your filters.
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {materials.data.map((material) => (
                            <Card key={material.id} className="border-l-4 border-l-blue-500">
                                <CardContent className="space-y-3 p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-start gap-3">
                                            <div className="rounded-md bg-blue-100 p-2 text-blue-700">
                                                <FileText className="h-6 w-6" />
                                            </div>
                                            <div>
                                                <p className="line-clamp-2 text-xl font-semibold leading-tight">{material.title}</p>
                                                <p className="text-sm text-muted-foreground">{material.original_filename}</p>
                                            </div>
                                        </div>
                                        <Badge variant="outline">{material.file_size_label}</Badge>
                                    </div>

                                    {material.description && (
                                        <p className="line-clamp-3 text-sm text-muted-foreground">{material.description}</p>
                                    )}

                                    <div className="flex items-center justify-between border-t pt-3">
                                        <span className="text-xs text-muted-foreground">{material.created_at ?? 'N/A'}</span>
                                        <div className="flex items-center gap-2">
                                            <Button size="icon" variant="outline" asChild>
                                                <a href={material.download_url} download={material.original_filename} title="Download / Open">
                                                    <Download className="h-4 w-4" />
                                                </a>
                                            </Button>
                                            <Button size="icon" variant="outline" onClick={() => remove(material.id)}>
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}

                <Pagination data={materials} />
            </div>

            <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <FilePlus2 className="h-5 w-5" />
                            Upload New Material
                        </DialogTitle>
                    </DialogHeader>

                    <form onSubmit={submit} className="space-y-4">
                        <div className="grid gap-2">
                            <Label htmlFor="title">Title</Label>
                            <Input
                                id="title"
                                value={form.data.title}
                                onChange={(event) => form.setData('title', event.target.value)}
                                placeholder="e.g. Chapter 3 Algebra Practice"
                                required
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="description">Description</Label>
                            <Textarea
                                id="description"
                                rows={3}
                                value={form.data.description}
                                onChange={(event) => form.setData('description', event.target.value)}
                                placeholder="Add material notes..."
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="attachment">File</Label>
                            <Input
                                id="attachment"
                                type="file"
                                required
                                onChange={(event) => form.setData('attachment', event.target.files?.[0] ?? null)}
                            />
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setUploadOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={form.processing}>
                                {form.processing ? 'Uploading...' : 'Upload Material'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </TeacherLayout>
    );
}
