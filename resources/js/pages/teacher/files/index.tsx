import { Head, router, useForm } from '@inertiajs/react';
import { Send, Trash2, Upload } from 'lucide-react';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Pagination } from '@/components/ui/pagination';
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
}

export default function TeacherFilesPage({ sentFiles, draftMaterials, subjects, advisorySections }: Props) {
    const [sendModalOpen, setSendModalOpen] = useState(false);
    const [selectedMaterialId, setSelectedMaterialId] = useState<string>('');
    const [targetType, setTargetType] = useState<'subject' | 'advisory'>('subject');
    const [subjectId, setSubjectId] = useState<string>('');
    const [sectionId, setSectionId] = useState<string>('');

    const uploadForm = useForm({
        title: '',
        description: '',
        attachment: null as File | null,
        target_type: 'subject' as 'subject' | 'advisory',
        subject_id: '',
        section_id: '',
    });

    const submitUpload = (event: React.FormEvent) => {
        event.preventDefault();
        uploadForm.post('/teacher/files', {
            forceFormData: true,
            onSuccess: () => uploadForm.reset(),
        });
    };

    const openSendModal = (materialId: number) => {
        setSelectedMaterialId(materialId.toString());
        setSendModalOpen(true);
    };

    const submitSend = () => {
        if (!selectedMaterialId) return;

        router.post(`/teacher/files/${selectedMaterialId}/send`, {
            target_type: targetType,
            subject_id: targetType === 'subject' ? subjectId : null,
            section_id: targetType === 'advisory' ? sectionId : null,
        }, {
            onSuccess: () => {
                setSendModalOpen(false);
                setSelectedMaterialId('');
                setSubjectId('');
                setSectionId('');
            },
        });
    };

    const remove = (id: number) => {
        if (!window.confirm('Delete this file?')) return;
        router.delete(`/teacher/files/${id}`);
    };

    return (
        <TeacherLayout breadcrumbs={breadcrumbs}>
            <Head title="Files" />

            <div className="space-y-6 p-6">
                <div>
                    <h1 className="text-2xl font-bold">Files</h1>
                    <p className="text-sm text-muted-foreground">Upload files and send them to your subject or advisory classes.</p>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Upload className="h-5 w-5" />
                            Upload And Send File
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={submitUpload} className="grid gap-4 md:grid-cols-2">
                            <div className="grid gap-2 md:col-span-2">
                                <Label htmlFor="title">Title</Label>
                                <Input id="title" value={uploadForm.data.title} onChange={(event) => uploadForm.setData('title', event.target.value)} required />
                            </div>

                            <div className="grid gap-2 md:col-span-2">
                                <Label htmlFor="description">Description</Label>
                                <Textarea id="description" value={uploadForm.data.description} onChange={(event) => uploadForm.setData('description', event.target.value)} rows={3} />
                            </div>

                            <div className="grid gap-2 md:col-span-2">
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
                                    <Label>Subject</Label>
                                    <Select value={uploadForm.data.subject_id} onValueChange={(value) => uploadForm.setData('subject_id', value)}>
                                        <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                                        <SelectContent>
                                            {subjects.map((subject) => (
                                                <SelectItem key={subject.id} value={subject.id.toString()}>{subject.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            ) : (
                                <div className="grid gap-2">
                                    <Label>Advisory Section</Label>
                                    <Select value={uploadForm.data.section_id} onValueChange={(value) => uploadForm.setData('section_id', value)}>
                                        <SelectTrigger><SelectValue placeholder="Select section" /></SelectTrigger>
                                        <SelectContent>
                                            {advisorySections.map((section) => (
                                                <SelectItem key={section.id} value={section.id.toString()}>{section.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            <div className="md:col-span-2 flex justify-end">
                                <Button type="submit" disabled={uploadForm.processing}>
                                    {uploadForm.processing ? 'Sending...' : 'Upload And Send'}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Send Existing Material</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {draftMaterials.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No private materials available to send.</p>
                        ) : (
                            <div className="space-y-2">
                                {draftMaterials.map((material) => (
                                    <div key={material.id} className="flex items-center justify-between rounded-lg border p-3">
                                        <div>
                                            <p className="font-medium">{material.title}</p>
                                            <p className="text-xs text-muted-foreground">{material.original_filename}</p>
                                        </div>
                                        <Button size="sm" onClick={() => openSendModal(material.id)}>
                                            <Send className="mr-2 h-4 w-4" />
                                            Send
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Sent Files</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {sentFiles.data.length === 0 ? (
                            <p className="py-8 text-center text-sm text-muted-foreground">No sent files yet.</p>
                        ) : (
                            <div className="space-y-3">
                                {sentFiles.data.map((file) => (
                                    <div key={file.id} className="flex items-start justify-between rounded-lg border p-3">
                                        <div className="min-w-0">
                                            <p className="font-medium">{file.title}</p>
                                            <p className="text-xs text-muted-foreground">{file.target_label} • {file.original_filename} • {file.file_size_label}</p>
                                            {file.description && <p className="mt-1 text-sm text-muted-foreground">{file.description}</p>}
                                            <div className="mt-1 flex items-center gap-3 text-xs">
                                                <a href={file.file_url} className="text-primary hover:underline">Open file</a>
                                                <span className="text-muted-foreground">Sent: {file.sent_at ?? 'N/A'}</span>
                                            </div>
                                        </div>
                                        <Button size="icon" variant="ghost" onClick={() => remove(file.id)}>
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="mt-4">
                            <Pagination data={sentFiles} />
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Dialog open={sendModalOpen} onOpenChange={setSendModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Send Material</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="grid gap-2">
                            <Label>Target Type</Label>
                            <Select value={targetType} onValueChange={(value: 'subject' | 'advisory') => setTargetType(value)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="subject">Subject Class</SelectItem>
                                    <SelectItem value="advisory">Advisory Class</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {targetType === 'subject' ? (
                            <div className="grid gap-2">
                                <Label>Subject</Label>
                                <Select value={subjectId} onValueChange={setSubjectId}>
                                    <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                                    <SelectContent>
                                        {subjects.map((subject) => (
                                            <SelectItem key={subject.id} value={subject.id.toString()}>{subject.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        ) : (
                            <div className="grid gap-2">
                                <Label>Advisory Section</Label>
                                <Select value={sectionId} onValueChange={setSectionId}>
                                    <SelectTrigger><SelectValue placeholder="Select section" /></SelectTrigger>
                                    <SelectContent>
                                        {advisorySections.map((section) => (
                                            <SelectItem key={section.id} value={section.id.toString()}>{section.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setSendModalOpen(false)}>Cancel</Button>
                        <Button onClick={submitSend}>Confirm Send</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </TeacherLayout>
    );
}
