import { Head, router, useForm } from '@inertiajs/react';
import { Download, Send, Trash2, Upload } from 'lucide-react';
import { useMemo, useState } from 'react';
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
    { title: 'Files', href: '/teacher/files' },
];

interface SentFile {
    id: number;
    title: string;
    description: string | null;
    original_filename: string;
    file_url: string;
    download_url: string;
    target_type: 'subject' | 'advisory';
    target_label: string;
    file_size_label: string;
    sent_at: string | null;
}

interface MaterialOption {
    id: number;
    title: string;
    original_filename: string;
}

interface Option {
    id: number;
    label: string;
}

interface Props {
    sentFiles: {
        data: SentFile[];
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
        from: number;
        to: number;
        links: any[];
    };
    draftMaterials: MaterialOption[];
    subjects: Option[];
    advisorySections: Option[];
    filters: {
        search?: string;
        file_type?: string;
        target_type?: string;
        from_date?: string;
        to_date?: string;
    };
}

const fileTypeOptions = [
    { value: 'all', label: 'All Types' },
    { value: 'pdf', label: 'PDF' },
    { value: 'doc', label: 'DOC' },
    { value: 'docx', label: 'DOCX' },
    { value: 'ppt', label: 'PPT' },
    { value: 'pptx', label: 'PPTX' },
    { value: 'xls', label: 'XLS' },
    { value: 'xlsx', label: 'XLSX' },
    { value: 'jpg', label: 'JPG' },
    { value: 'png', label: 'PNG' },
];

export default function TeacherFilesPage({ sentFiles, draftMaterials, subjects, advisorySections, filters }: Props) {
    const [uploadOpen, setUploadOpen] = useState(false);
    const [sendModalOpen, setSendModalOpen] = useState(false);
    const [selectedMaterialId, setSelectedMaterialId] = useState<string>('');
    const [sendClass, setSendClass] = useState<string>('');
    const [sendMessage, setSendMessage] = useState('');

    const [search, setSearch] = useState(filters.search || '');
    const [fileType, setFileType] = useState(filters.file_type || 'all');
    const [targetTypeFilter, setTargetTypeFilter] = useState(filters.target_type || 'all');
    const [fromDate, setFromDate] = useState(filters.from_date || '');
    const [toDate, setToDate] = useState(filters.to_date || '');

    const uploadForm = useForm({
        title: '',
        description: '',
        attachment: null as File | null,
        target_type: 'subject' as 'subject' | 'advisory',
        subject_id: '',
        section_id: '',
        message: '',
    });

    const classOptions = useMemo(() => {
        return [
            ...subjects.map((subject) => ({
                value: `subject:${subject.id}`,
                label: subject.label,
            })),
            ...advisorySections.map((section) => ({
                value: `advisory:${section.id}`,
                label: `${section.label} (Advisory)`,
            })),
        ];
    }, [subjects, advisorySections]);

    const applyFilters = (next?: Partial<{ search: string; file_type: string; target_type: string; from_date: string; to_date: string }>) => {
        router.get('/teacher/files', {
            search: next?.search ?? search,
            file_type: next?.file_type ?? fileType,
            target_type: next?.target_type ?? targetTypeFilter,
            from_date: next?.from_date ?? fromDate,
            to_date: next?.to_date ?? toDate,
        }, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const submitUpload = (event: React.FormEvent) => {
        event.preventDefault();
        uploadForm.post('/teacher/files', {
            forceFormData: true,
            onSuccess: () => {
                uploadForm.reset();
                setUploadOpen(false);
            },
        });
    };

    const openSendModal = (materialId: number) => {
        setSelectedMaterialId(materialId.toString());
        setSendClass('');
        setSendMessage('');
        setSendModalOpen(true);
    };

    const submitSend = () => {
        if (!selectedMaterialId || !sendClass) return;

        const [targetType, id] = sendClass.split(':');

        router.post(`/teacher/files/${selectedMaterialId}/send`, {
            target_type: targetType,
            subject_id: targetType === 'subject' ? id : null,
            section_id: targetType === 'advisory' ? id : null,
            message: sendMessage,
        }, {
            onSuccess: () => {
                setSendModalOpen(false);
                setSelectedMaterialId('');
                setSendClass('');
                setSendMessage('');
            },
        });
    };

    const remove = (id: number) => {
        if (!window.confirm('Delete this file?')) return;
        router.delete(`/teacher/files/${id}`);
    };

    return (
        <TeacherLayout breadcrumbs={breadcrumbs}>
            <Head title="My Files" />

            <div className="space-y-6 p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">My Files</h1>
                        <p className="text-sm text-muted-foreground">Upload files and send them to subject or advisory classes.</p>
                    </div>
                    <Button onClick={() => setUploadOpen(true)}>
                        <Upload className="mr-2 h-4 w-4" />
                        Upload New File
                    </Button>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-xl">My Files</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                            <div className="xl:col-span-2">
                                <Input
                                    value={search}
                                    onChange={(event) => {
                                        setSearch(event.target.value);
                                        applyFilters({ search: event.target.value });
                                    }}
                                    placeholder="Search by file name..."
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
                                    <SelectValue placeholder="All Types" />
                                </SelectTrigger>
                                <SelectContent>
                                    {fileTypeOptions.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <Select
                                value={targetTypeFilter}
                                onValueChange={(value) => {
                                    setTargetTypeFilter(value);
                                    applyFilters({ target_type: value });
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Target" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Targets</SelectItem>
                                    <SelectItem value="subject">Subject Classes</SelectItem>
                                    <SelectItem value="advisory">Advisory Classes</SelectItem>
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

                {sentFiles.data.length === 0 ? (
                    <Card>
                        <CardContent className="py-14 text-center text-sm text-muted-foreground">
                            No files found for your current filters.
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {sentFiles.data.map((file) => (
                            <Card key={file.id} className="border-l-4 border-l-fuchsia-500">
                                <CardContent className="space-y-3 p-4">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <p className="line-clamp-2 text-3 font-semibold">{file.title}</p>
                                            <p className="text-sm text-muted-foreground">{file.target_label}</p>
                                        </div>
                                        <Badge variant="outline">{file.target_type}</Badge>
                                    </div>

                                    <p className="text-sm text-muted-foreground">{file.original_filename} ({file.file_size_label})</p>

                                    {file.description && (
                                        <p className="line-clamp-3 text-sm text-muted-foreground">{file.description}</p>
                                    )}

                                    <div className="flex items-center justify-between border-t pt-3">
                                        <span className="text-xs text-muted-foreground">{file.sent_at ?? 'N/A'}</span>
                                        <div className="flex items-center gap-2">
                                            <Button size="icon" variant="outline" asChild>
                                                <a href={file.download_url} download={file.original_filename} title="Download file">
                                                    <Download className="h-4 w-4" />
                                                </a>
                                            </Button>
                                            <Button size="icon" variant="outline" onClick={() => openSendModal(file.id)}>
                                                <Send className="h-4 w-4 text-emerald-600" />
                                            </Button>
                                            <Button size="icon" variant="outline" onClick={() => remove(file.id)}>
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}

                <Pagination data={sentFiles} />

                {draftMaterials.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Quick Send From My Materials</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {draftMaterials.map((material) => (
                                    <div key={material.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                                        <div>
                                            <p className="font-medium">{material.title}</p>
                                            <p className="text-xs text-muted-foreground">{material.original_filename}</p>
                                        </div>
                                        <Button size="sm" onClick={() => openSendModal(material.id)}>
                                            <Send className="mr-2 h-4 w-4" />
                                            Send to Students
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>

            <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Upload New File</DialogTitle>
                    </DialogHeader>

                    <form onSubmit={submitUpload} className="space-y-4">
                        <div className="grid gap-2">
                            <Label htmlFor="title">Title</Label>
                            <Input id="title" value={uploadForm.data.title} onChange={(event) => uploadForm.setData('title', event.target.value)} required />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="description">Description</Label>
                            <Textarea id="description" rows={3} value={uploadForm.data.description} onChange={(event) => uploadForm.setData('description', event.target.value)} />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="attachment">Attachment</Label>
                            <Input id="attachment" type="file" required onChange={(event) => uploadForm.setData('attachment', event.target.files?.[0] ?? null)} />
                        </div>

                        <div className="grid gap-2">
                            <Label>Target Type</Label>
                            <Select value={uploadForm.data.target_type} onValueChange={(value: 'subject' | 'advisory') => uploadForm.setData('target_type', value)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="subject">Subject Class</SelectItem>
                                    <SelectItem value="advisory">Advisory Class</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {uploadForm.data.target_type === 'subject' ? (
                            <div className="grid gap-2">
                                <Label>Select Class</Label>
                                <Select value={uploadForm.data.subject_id} onValueChange={(value) => uploadForm.setData('subject_id', value)}>
                                    <SelectTrigger><SelectValue placeholder="Select subject class" /></SelectTrigger>
                                    <SelectContent>
                                        {subjects.map((subject) => (
                                            <SelectItem key={subject.id} value={subject.id.toString()}>{subject.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        ) : (
                            <div className="grid gap-2">
                                <Label>Select Class</Label>
                                <Select value={uploadForm.data.section_id} onValueChange={(value) => uploadForm.setData('section_id', value)}>
                                    <SelectTrigger><SelectValue placeholder="Select advisory class" /></SelectTrigger>
                                    <SelectContent>
                                        {advisorySections.map((section) => (
                                            <SelectItem key={section.id} value={section.id.toString()}>{section.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        <div className="grid gap-2">
                            <Label htmlFor="message">Message (optional)</Label>
                            <Textarea
                                id="message"
                                rows={3}
                                value={uploadForm.data.message}
                                onChange={(event) => uploadForm.setData('message', event.target.value)}
                                placeholder="Add a message to students..."
                            />
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setUploadOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={uploadForm.processing}>
                                {uploadForm.processing ? 'Sending...' : 'Upload and Send'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={sendModalOpen} onOpenChange={setSendModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Send File to Students</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="grid gap-2">
                            <Label>Select Class</Label>
                            <Select value={sendClass} onValueChange={setSendClass}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select class" />
                                </SelectTrigger>
                                <SelectContent>
                                    {classOptions.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="send-message">Message (optional)</Label>
                            <Textarea
                                id="send-message"
                                rows={4}
                                value={sendMessage}
                                onChange={(event) => setSendMessage(event.target.value)}
                                placeholder="Add a message to students..."
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setSendModalOpen(false)}>Cancel</Button>
                        <Button onClick={submitSend} disabled={!sendClass}>
                            <Send className="mr-2 h-4 w-4" />
                            Send to Students
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </TeacherLayout>
    );
}
