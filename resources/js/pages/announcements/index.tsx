import { Head, router, useForm } from '@inertiajs/react';
import { format } from 'date-fns';
import { Check, CheckCheck, File, FileText, Image as ImageIcon, Megaphone, Pencil, Pin, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { FilterBar } from '@/components/filters/filter-bar';
import { SearchBar } from '@/components/filters/search-bar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FileViewer } from '@/components/ui/file-viewer';
import { ImageViewer } from '@/components/ui/image-viewer';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Pagination } from '@/components/ui/pagination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

interface Department {
    id: number;
    name: string;
    classification: 'K-12' | 'College';
}

interface ProgramOption {
    id: number;
    department_id: number;
    name: string;
}

interface YearLevelOption {
    id: number;
    department_id: number;
    program_id: number | null;
    classification: 'K-12' | 'College';
    name: string;
}

interface SectionOption {
    id: number;
    department_id: number;
    program_id: number | null;
    year_level_id: number;
    name: string;
}

interface User {
    id: number;
    name: string;
}

interface Announcement {
    id: number;
    title: string;
    content: string;
    priority: 'low' | 'normal' | 'high' | 'urgent';
    target_roles: string[] | null;
    department_id: number | null;
    classification: string | null;
    program_id: number | null;
    year_level_id: number | null;
    section_id: number | null;
    program: string | null;
    grade_level: string | null;
    created_by: number;
    created_at: string;
    is_pinned: boolean;
    attachment_path: string | null;
    attachment_name: string | null;
    attachment_type: string | null;
    image_path: string | null;
    image_name: string | null;
    image_type: string | null;
    is_read: boolean;
    read_at: string | null;
    can_edit: boolean;
    department?: Department | null;
    creator?: User;
    program_model?: { id: number; name: string } | null;
    year_level?: { id: number; name: string } | null;
    section?: { id: number; name: string } | null;
}

interface Props {
    announcements: {
        data: Announcement[];
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
        from: number;
        to: number;
        links: { url: string | null; label: string; active: boolean }[];
    };
    filters: {
        search?: string;
        sort_by?: 'priority' | 'date';
        read_status?: 'read' | 'unread' | 'all';
    };
    role: string;
    canCreate?: boolean;
    departments?: Department[];
    programs?: ProgramOption[];
    yearLevels?: YearLevelOption[];
    sections?: SectionOption[];
}

interface AnnouncementFormData {
    title: string;
    content: string;
    priority: 'low' | 'normal' | 'high' | 'urgent';
    target_roles: string[];
    department_id: string;
    program_id: string;
    year_level_id: string;
    section_id: string;
    is_pinned: boolean;
}

const AVAILABLE_ROLES = [
    { value: 'registrar', label: 'Registrar' },
    { value: 'accounting', label: 'Accounting' },
    { value: 'super-accounting', label: 'Super Accounting' },
    { value: 'student', label: 'Student' },
    { value: 'teacher', label: 'Teacher' },
    { value: 'parent', label: 'Parent' },
    { value: 'guidance', label: 'Guidance' },
    { value: 'librarian', label: 'Librarian' },
    { value: 'clinic', label: 'Clinic' },
    { value: 'canteen', label: 'Canteen' },
];

const emptyFormData: AnnouncementFormData = {
    title: '',
    content: '',
    priority: 'normal',
    target_roles: [],
    department_id: '',
    program_id: '',
    year_level_id: '',
    section_id: '',
    is_pinned: false,
};

const priorityStyles: Record<Announcement['priority'], { card: string; badge: string; label: string }> = {
    urgent: {
        card: 'border-red-300 bg-red-50/70 dark:border-red-900 dark:bg-red-950/30',
        badge: 'bg-red-600 text-white hover:bg-red-600',
        label: 'Urgent',
    },
    high: {
        card: 'border-orange-300 bg-orange-50/70 dark:border-orange-900 dark:bg-orange-950/30',
        badge: 'bg-orange-600 text-white hover:bg-orange-600',
        label: 'High',
    },
    normal: {
        card: 'border-blue-300 bg-blue-50/70 dark:border-blue-900 dark:bg-blue-950/30',
        badge: 'bg-blue-600 text-white hover:bg-blue-600',
        label: 'Normal',
    },
    low: {
        card: 'border-slate-300 bg-slate-50/70 dark:border-slate-700 dark:bg-slate-900/30',
        badge: 'bg-slate-600 text-white hover:bg-slate-600',
        label: 'Low',
    },
};

const getFileIcon = (mimeType: string | null) => {
    if (mimeType?.startsWith('image/')) return <ImageIcon className="h-4 w-4" />;
    if (mimeType === 'application/pdf') return <FileText className="h-4 w-4" />;
    return <File className="h-4 w-4" />;
};

export default function AnnouncementsIndex({
    announcements,
    filters,
    role,
    canCreate = false,
    departments = [],
    programs = [],
    yearLevels = [],
    sections = [],
}: Props) {
    const [search, setSearch] = useState(filters.search || '');
    const [sortBy, setSortBy] = useState<'priority' | 'date'>(filters.sort_by || 'priority');
    const [readStatus, setReadStatus] = useState<'read' | 'unread' | 'all'>(filters.read_status || 'unread');
    const [expandedAnnouncements, setExpandedAnnouncements] = useState<Set<number>>(new Set());

    const [fileViewerOpen, setFileViewerOpen] = useState(false);
    const [viewingAnnouncement, setViewingAnnouncement] = useState<Announcement | null>(null);
    const [imageViewerOpen, setImageViewerOpen] = useState(false);
    const [viewingImageAnnouncement, setViewingImageAnnouncement] = useState<Announcement | null>(null);

    const [formOpen, setFormOpen] = useState(false);
    const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);

    const { data, setData, post, patch, processing, errors, reset, clearErrors } = useForm<AnnouncementFormData>(emptyFormData);

    const selectedDepartment = useMemo(
        () => departments.find((department) => department.id === Number(data.department_id)),
        [data.department_id, departments],
    );

    const isK12Department = selectedDepartment?.classification === 'K-12';

    const filteredPrograms = useMemo(() => {
        if (!data.department_id) return [];
        return programs.filter((program) => program.department_id === Number(data.department_id));
    }, [data.department_id, programs]);

    const filteredYearLevels = useMemo(() => {
        if (!data.department_id) return [];

        const departmentId = Number(data.department_id);
        if (isK12Department) {
            return yearLevels.filter((yearLevel) => yearLevel.department_id === departmentId);
        }

        if (data.program_id) {
            return yearLevels.filter(
                (yearLevel) =>
                    yearLevel.department_id === departmentId && yearLevel.program_id === Number(data.program_id),
            );
        }

        return yearLevels.filter((yearLevel) => yearLevel.department_id === departmentId);
    }, [data.department_id, data.program_id, isK12Department, yearLevels]);

    const filteredSections = useMemo(() => {
        if (!data.year_level_id) return [];

        const yearLevelId = Number(data.year_level_id);
        const departmentId = data.department_id ? Number(data.department_id) : null;
        const programId = data.program_id ? Number(data.program_id) : null;

        return sections.filter((section) => {
            if (section.year_level_id !== yearLevelId) return false;
            if (departmentId && section.department_id !== departmentId) return false;
            if (programId && section.program_id && section.program_id !== programId) return false;
            return true;
        });
    }, [data.year_level_id, data.department_id, data.program_id, sections]);

    const navigate = (params: Record<string, string>) => {
        const cleanParams = Object.fromEntries(Object.entries(params).filter(([, value]) => value));
        router.get(`/${role}/announcements`, cleanParams, { preserveState: true, preserveScroll: true });
    };

    const handleSearchChange = (value: string) => {
        setSearch(value);
        navigate({ search: value, sort_by: sortBy, read_status: readStatus });
    };

    const handleSortChange = (value: string) => {
        const nextSort = value === 'date' ? 'date' : 'priority';
        setSortBy(nextSort);
        navigate({ search, sort_by: nextSort, read_status: readStatus });
    };

    const handleReadStatusChange = (value: string) => {
        const nextReadStatus = value === 'read' || value === 'all' ? value : 'unread';
        setReadStatus(nextReadStatus);
        navigate({ search, sort_by: sortBy, read_status: nextReadStatus });
    };

    const resetFilters = () => {
        setSearch('');
        setSortBy('priority');
        setReadStatus('unread');
        router.get(`/${role}/announcements`);
    };

    const resetFormState = () => {
        setEditingAnnouncement(null);
        reset();
        clearErrors();
        setData({ ...emptyFormData });
    };

    const openCreateDialog = () => {
        resetFormState();
        setFormOpen(true);
    };

    const resolveProgramId = (announcement: Announcement): string => {
        if (announcement.program_id) return String(announcement.program_id);
        if (!announcement.program) return '';

        const match = programs.find(
            (program) =>
                program.name === announcement.program &&
                (!announcement.department_id || program.department_id === announcement.department_id),
        );

        return match ? String(match.id) : '';
    };

    const resolveYearLevelId = (announcement: Announcement, programId: string): string => {
        if (announcement.year_level_id) return String(announcement.year_level_id);
        if (!announcement.grade_level) return '';

        const match = yearLevels.find((yearLevel) => {
            if (yearLevel.name !== announcement.grade_level) return false;
            if (announcement.department_id && yearLevel.department_id !== announcement.department_id) return false;
            if (programId && yearLevel.program_id && yearLevel.program_id !== Number(programId)) return false;
            return true;
        });

        return match ? String(match.id) : '';
    };

    const openEditDialog = (announcement: Announcement) => {
        const programId = resolveProgramId(announcement);
        const yearLevelId = resolveYearLevelId(announcement, programId);

        setEditingAnnouncement(announcement);
        setData({
            title: announcement.title,
            content: announcement.content,
            priority: announcement.priority,
            target_roles: announcement.target_roles || [],
            department_id: announcement.department_id ? String(announcement.department_id) : '',
            program_id: programId,
            year_level_id: yearLevelId,
            section_id: announcement.section_id ? String(announcement.section_id) : '',
            is_pinned: announcement.is_pinned,
        });
        clearErrors();
        setFormOpen(true);
    };

    const closeFormDialog = (open: boolean) => {
        setFormOpen(open);
        if (!open) {
            resetFormState();
        }
    };

    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (editingAnnouncement) {
            patch(`/${role}/announcements/${editingAnnouncement.id}`, {
                onSuccess: () => closeFormDialog(false),
            });
            return;
        }

        post(`/${role}/announcements`, {
            onSuccess: () => closeFormDialog(false),
        });
    };

    const toggleTargetRole = (roleValue: string) => {
        setData(
            'target_roles',
            data.target_roles.includes(roleValue)
                ? data.target_roles.filter((value) => value !== roleValue)
                : [...data.target_roles, roleValue],
        );
    };

    const handleDepartmentChange = (value: string) => {
        const nextDepartment = value === 'all' ? '' : value;
        setData((previous) => ({
            ...previous,
            department_id: nextDepartment,
            program_id: '',
            year_level_id: '',
            section_id: '',
        }));
    };

    const handleProgramChange = (value: string) => {
        const nextProgram = value === 'all' ? '' : value;
        setData((previous) => ({
            ...previous,
            program_id: nextProgram,
            year_level_id: '',
            section_id: '',
        }));
    };

    const handleYearLevelChange = (value: string) => {
        const nextYearLevel = value === 'all' ? '' : value;
        setData((previous) => ({
            ...previous,
            year_level_id: nextYearLevel,
            section_id: '',
        }));
    };

    const handleSectionChange = (value: string) => {
        setData('section_id', value === 'all' ? '' : value);
    };

    const openFileViewer = (announcement: Announcement) => {
        setViewingAnnouncement(announcement);
        setFileViewerOpen(true);
    };

    const openImageViewer = (announcement: Announcement) => {
        setViewingImageAnnouncement(announcement);
        setImageViewerOpen(true);
    };

    const markAllAsRead = () => {
        router.post(
            `/${role}/announcements/mark-read`,
            {},
            {
                preserveScroll: true,
            },
        );
    };

    const markAnnouncementAsRead = (announcementId: number) => {
        router.post(
            `/${role}/announcements/${announcementId}/mark-read`,
            {},
            {
                preserveScroll: true,
            },
        );
    };

    const toggleExpanded = (id: number) => {
        setExpandedAnnouncements((previous) => {
            const next = new Set(previous);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const hasActiveFilters = !!(search || sortBy !== 'priority' || readStatus !== 'unread');

    return (
        <>
            <Head title="Announcements" />

            <div className="space-y-6 p-6">
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                    <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900">
                            <Megaphone className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold">Announcements</h1>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Stay updated with the latest school announcements
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Button variant="outline" onClick={markAllAsRead}>
                            <CheckCheck className="mr-2 h-4 w-4" />
                            Mark All as Read
                        </Button>
                        {canCreate && (
                            <Button onClick={openCreateDialog}>
                                <Plus className="mr-2 h-4 w-4" />
                                New Announcement
                            </Button>
                        )}
                    </div>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>All Announcements</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <FilterBar onReset={resetFilters} showReset={hasActiveFilters}>
                            <SearchBar
                                value={search}
                                onChange={handleSearchChange}
                                placeholder="Search announcements..."
                            />
                        </FilterBar>

                        <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <Tabs value={sortBy} onValueChange={handleSortChange}>
                                <TabsList>
                                    <TabsTrigger value="priority">Based on Priority</TabsTrigger>
                                    <TabsTrigger value="date">Based on Date</TabsTrigger>
                                </TabsList>
                            </Tabs>

                            <Tabs value={readStatus} onValueChange={handleReadStatusChange}>
                                <TabsList>
                                    <TabsTrigger value="unread">Unread</TabsTrigger>
                                    <TabsTrigger value="read">Read</TabsTrigger>
                                    <TabsTrigger value="all">All</TabsTrigger>
                                </TabsList>
                            </Tabs>
                        </div>

                        <div className="mt-6 space-y-4">
                            {announcements.data.length === 0 ? (
                                <div className="py-12 text-center text-muted-foreground">No announcements found.</div>
                            ) : (
                                announcements.data.map((announcement) => {
                                    const isExpanded = expandedAnnouncements.has(announcement.id);
                                    const contentPreview =
                                        announcement.content.length > 300 && !isExpanded
                                            ? `${announcement.content.substring(0, 300)}...`
                                            : announcement.content;
                                    const priorityStyle = priorityStyles[announcement.priority] || priorityStyles.normal;

                                    return (
                                        <div
                                            key={announcement.id}
                                            className={`rounded-lg border p-5 transition-colors hover:bg-muted/40 ${priorityStyle.card} ${announcement.is_pinned ? 'ring-1 ring-yellow-300 dark:ring-yellow-700' : ''}`}
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex-1">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        {announcement.is_pinned && <Pin className="h-4 w-4 text-yellow-600" />}
                                                        <h3 className="text-lg font-semibold">{announcement.title}</h3>
                                                        <Badge className={priorityStyle.badge}>{priorityStyle.label}</Badge>
                                                        {!announcement.is_read && (
                                                            <Badge variant="outline" className="border-blue-500 text-blue-600 dark:border-blue-400 dark:text-blue-300">
                                                                Unread
                                                            </Badge>
                                                        )}
                                                    </div>

                                                    <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">
                                                        {contentPreview}
                                                    </p>

                                                    {announcement.content.length > 300 && (
                                                        <Button
                                                            variant="link"
                                                            size="sm"
                                                            className="mt-1 h-auto px-0"
                                                            onClick={() => toggleExpanded(announcement.id)}
                                                        >
                                                            {isExpanded ? 'Show less' : 'Read more'}
                                                        </Button>
                                                    )}

                                                    {announcement.attachment_path && (
                                                        <div className="mt-3">
                                                            <Button variant="outline" size="sm" onClick={() => openFileViewer(announcement)}>
                                                                {getFileIcon(announcement.attachment_type)}
                                                                <span className="ml-2">{announcement.attachment_name || 'View Attachment'}</span>
                                                            </Button>
                                                        </div>
                                                    )}

                                                    {announcement.image_path && (
                                                        <div className="mt-3">
                                                            <img
                                                                src={
                                                                    announcement.image_path.startsWith('/storage/')
                                                                        ? announcement.image_path
                                                                        : `/storage/${announcement.image_path}`
                                                                }
                                                                alt={announcement.image_name || announcement.title}
                                                                className="max-h-64 cursor-pointer rounded-lg border object-cover transition-opacity hover:opacity-90"
                                                                onClick={() => openImageViewer(announcement)}
                                                            />
                                                        </div>
                                                    )}

                                                    <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                                        <span>Posted by {announcement.creator?.name || 'Admin'}</span>
                                                        <span>•</span>
                                                        <span>{format(new Date(announcement.created_at), "MMMM d, yyyy 'at' h:mm a")}</span>
                                                        {announcement.department && (
                                                            <>
                                                                <span>•</span>
                                                                <Badge variant="outline" className="text-xs">
                                                                    {announcement.department.name}
                                                                </Badge>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="flex shrink-0 items-center gap-1">
                                                    {!announcement.is_read ? (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => markAnnouncementAsRead(announcement.id)}
                                                        >
                                                            <Check className="mr-2 h-4 w-4" />
                                                            Mark as Read
                                                        </Button>
                                                    ) : (
                                                        <Badge variant="secondary">Read</Badge>
                                                    )}

                                                    {announcement.can_edit && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => openEditDialog(announcement)}
                                                            aria-label="Edit announcement"
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        <Pagination data={announcements} />
                    </CardContent>
                </Card>
            </div>

            {viewingAnnouncement && (
                <FileViewer
                    open={fileViewerOpen}
                    onOpenChange={setFileViewerOpen}
                    title={viewingAnnouncement.attachment_name || viewingAnnouncement.title}
                    filePath={viewingAnnouncement.attachment_path || ''}
                    fileType={viewingAnnouncement.attachment_type || undefined}
                    fileName={viewingAnnouncement.attachment_name || undefined}
                />
            )}

            {viewingImageAnnouncement && viewingImageAnnouncement.image_path && (
                <ImageViewer
                    open={imageViewerOpen}
                    onOpenChange={setImageViewerOpen}
                    title={viewingImageAnnouncement.image_name || viewingImageAnnouncement.title}
                    imagePath={viewingImageAnnouncement.image_path}
                />
            )}

            {canCreate && (
                <Dialog open={formOpen} onOpenChange={closeFormDialog}>
                    <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>{editingAnnouncement ? 'Edit Announcement' : 'Create Announcement'}</DialogTitle>
                        </DialogHeader>

                        <form onSubmit={handleFormSubmit} className="space-y-4">
                            <div className="space-y-1">
                                <Label htmlFor="title">
                                    Title <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    id="title"
                                    value={data.title}
                                    onChange={(event) => setData('title', event.target.value)}
                                    placeholder="Announcement title"
                                />
                                {errors.title && <p className="text-sm text-destructive">{errors.title}</p>}
                            </div>

                            <div className="space-y-1">
                                <Label htmlFor="content">
                                    Content <span className="text-destructive">*</span>
                                </Label>
                                <Textarea
                                    id="content"
                                    value={data.content}
                                    onChange={(event) => setData('content', event.target.value)}
                                    placeholder="Announcement content"
                                    rows={4}
                                />
                                {errors.content && <p className="text-sm text-destructive">{errors.content}</p>}
                            </div>

                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div className="space-y-1">
                                    <Label>
                                        Priority <span className="text-destructive">*</span>
                                    </Label>
                                    <Select
                                        value={data.priority}
                                        onValueChange={(value: AnnouncementFormData['priority']) => setData('priority', value)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="low">Low</SelectItem>
                                            <SelectItem value="normal">Normal</SelectItem>
                                            <SelectItem value="high">High</SelectItem>
                                            <SelectItem value="urgent">Urgent</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    {errors.priority && <p className="text-sm text-destructive">{errors.priority}</p>}
                                </div>

                                <div className="flex items-center gap-2 pt-7">
                                    <Checkbox
                                        id="is_pinned"
                                        checked={data.is_pinned}
                                        onCheckedChange={(value) => setData('is_pinned', !!value)}
                                    />
                                    <Label htmlFor="is_pinned" className="cursor-pointer font-normal">
                                        Pin this announcement
                                    </Label>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>
                                    Target Roles <span className="text-destructive">*</span>
                                </Label>
                                <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                                    {AVAILABLE_ROLES.map((targetRole) => (
                                        <div key={targetRole.value} className="flex items-center gap-2">
                                            <Checkbox
                                                id={`role-${targetRole.value}`}
                                                checked={data.target_roles.includes(targetRole.value)}
                                                onCheckedChange={() => toggleTargetRole(targetRole.value)}
                                            />
                                            <Label
                                                htmlFor={`role-${targetRole.value}`}
                                                className="cursor-pointer font-normal"
                                            >
                                                {targetRole.label}
                                            </Label>
                                        </div>
                                    ))}
                                </div>
                                {errors.target_roles && <p className="text-sm text-destructive">{errors.target_roles}</p>}
                            </div>

                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div className="space-y-1">
                                    <Label>Department</Label>
                                    <Select
                                        value={data.department_id || 'all'}
                                        onValueChange={handleDepartmentChange}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="All Departments" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Departments</SelectItem>
                                            {departments.map((department) => (
                                                <SelectItem key={department.id} value={String(department.id)}>
                                                    {department.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {errors.department_id && <p className="text-sm text-destructive">{errors.department_id}</p>}
                                </div>

                                {!isK12Department && (
                                    <div className="space-y-1">
                                        <Label>Program (College)</Label>
                                        <Select
                                            value={data.program_id || 'all'}
                                            onValueChange={handleProgramChange}
                                            disabled={!data.department_id}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="All Programs" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All Programs</SelectItem>
                                                {filteredPrograms.map((program) => (
                                                    <SelectItem key={program.id} value={String(program.id)}>
                                                        {program.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        {errors.program_id && <p className="text-sm text-destructive">{errors.program_id}</p>}
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div className="space-y-1">
                                    <Label>Year Level</Label>
                                    <Select
                                        value={data.year_level_id || 'all'}
                                        onValueChange={handleYearLevelChange}
                                        disabled={!data.department_id}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="All Year Levels" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Year Levels</SelectItem>
                                            {filteredYearLevels.map((yearLevel) => (
                                                <SelectItem key={yearLevel.id} value={String(yearLevel.id)}>
                                                    {yearLevel.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {errors.year_level_id && <p className="text-sm text-destructive">{errors.year_level_id}</p>}
                                </div>

                                <div className="space-y-1">
                                    <Label>Section</Label>
                                    <Select
                                        value={data.section_id || 'all'}
                                        onValueChange={handleSectionChange}
                                        disabled={!data.year_level_id}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="All Sections" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Sections</SelectItem>
                                            {filteredSections.map((section) => (
                                                <SelectItem key={section.id} value={String(section.id)}>
                                                    {section.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {errors.section_id && <p className="text-sm text-destructive">{errors.section_id}</p>}
                                </div>
                            </div>

                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => closeFormDialog(false)}>
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={processing}>
                                    {processing
                                        ? editingAnnouncement
                                            ? 'Saving...'
                                            : 'Posting...'
                                        : editingAnnouncement
                                          ? 'Save Changes'
                                          : 'Post Announcement'}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            )}
        </>
    );
}
