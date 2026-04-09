import { Head, router, usePage } from '@inertiajs/react';
import { Eye, Pencil, Plus, Trash2 } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { FilterBar } from '@/components/filters/filter-bar';
import { FilterDropdown } from '@/components/filters/filter-dropdown';
import { SearchBar } from '@/components/filters/search-bar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Pagination } from '@/components/ui/pagination';
import { PdfViewer } from '@/components/ui/pdf-viewer';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import RegistrarLayout from '@/layouts/registrar/registrar-layout';
import type { BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Schedule', href: '/registrar/schedule' },
];

interface Department {
    id: number;
    name: string;
    classification?: string;
}

interface Program {
    id: number;
    name: string;
    department_id: number;
    department: Department;
}

interface YearLevel {
    id: number;
    name: string;
    level_number: number;
    department_id: number;
    department: Department;
}

interface Section {
    id: number;
    name: string;
    department_id: number;
    year_level_id: number;
    department: Department;
    year_level: YearLevel;
}

interface Teacher {
    id: number;
    first_name: string;
    last_name: string;
    suffix: string | null;
    department_id: number;
}

interface Schedule {
    id: number;
    title: string;
    department_id: number;
    program_id: number | null;
    year_level_id: number | null;
    section_id: number | null;
    teacher_id: number | null;
    file_path: string;
    file_name: string;
    is_active: boolean;
    department: Department;
    program: Program | null;
    year_level: YearLevel | null;
    section: Section | null;
    teacher: Teacher | null;
    created_at: string;
}

interface Props {
    schedules: {
        data: Schedule[];
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
        from: number;
        to: number;
        links: any[];
    };
    departments: Department[];
    programs: Program[];
    yearLevels: YearLevel[];
    sections: Section[];
    teachers: Teacher[];
    filters: {
        search?: string;
        classification?: string;
        department_id?: string;
        status?: string;
    };
}

export default function RegistrarScheduleIndex({ schedules, departments, programs, yearLevels, sections, teachers, filters }: Props) {
    const { props } = usePage();
    const hasK12 = (props.appSettings as any)?.has_k12 !== false;
    const hasCollege = (props.appSettings as any)?.has_college !== false;
    const classificationOptions = [
        ...(hasK12 ? [{ value: 'K-12', label: 'K-12' }] : []),
        ...(hasCollege ? [{ value: 'College', label: 'College' }] : []),
    ];

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [scheduleToDelete, setScheduleToDelete] = useState<Schedule | null>(null);
    const [viewingSchedule, setViewingSchedule] = useState<Schedule | null>(null);
    const [search, setSearch] = useState(filters.search || '');
    const [classification, setClassification] = useState(filters.classification || 'all');
    const [selectedDepartment, setSelectedDepartment] = useState(filters.department_id || 'all');
    const [status, setStatus] = useState(filters.status || 'all');

    const [title, setTitle] = useState('');
    const [departmentId, setDepartmentId] = useState('');
    const [programId, setProgramId] = useState('');
    const [yearLevelId, setYearLevelId] = useState('');
    const [sectionId, setSectionId] = useState('');
    const [teacherId, setTeacherId] = useState('');
    const [isActive, setIsActive] = useState(true);
    const [file, setFile] = useState<File | null>(null);
    const [processing, setProcessing] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const filteredPrograms = departmentId ? programs.filter((p) => p.department_id === parseInt(departmentId)) : [];
    const filteredYearLevels = departmentId ? yearLevels.filter((yl) => yl.department_id === parseInt(departmentId)) : [];
    const filteredSections = (departmentId && yearLevelId)
        ? sections.filter((s) => s.department_id === parseInt(departmentId) && s.year_level_id === parseInt(yearLevelId))
        : [];
    const filteredTeachers = departmentId
        ? [
            ...teachers.filter((t) => t.department_id === parseInt(departmentId)),
            ...teachers.filter((t) => t.department_id !== parseInt(departmentId)),
        ]
        : teachers;

    const modalDepartments = classification !== 'all'
        ? departments.filter((d) => d.classification === classification)
        : departments;

    const handleSearchChange = (value: string) => {
        setSearch(value);
        router.get('/registrar/schedule', { search: value, classification, department_id: selectedDepartment, status }, { preserveState: true, replace: true });
    };

    const handleClassificationChange = (value: string) => {
        setClassification(value);
        setSelectedDepartment('all');
        router.get('/registrar/schedule', { search, classification: value, department_id: 'all', status }, { preserveState: true, replace: true });
    };

    const handleDepartmentFilterChange = (value: string) => {
        setSelectedDepartment(value);
        router.get('/registrar/schedule', { search, classification, department_id: value, status }, { preserveState: true, replace: true });
    };

    const handleStatusChange = (value: string) => {
        setStatus(value);
        router.get('/registrar/schedule', { search, classification, department_id: selectedDepartment, status: value }, { preserveState: true, replace: true });
    };

    const handleReset = () => {
        setSearch('');
        setClassification('all');
        setSelectedDepartment('all');
        setStatus('all');
        router.get('/registrar/schedule');
    };

    const resetForm = () => {
        setTitle('');
        setDepartmentId('');
        setProgramId('');
        setYearLevelId('');
        setSectionId('');
        setTeacherId('');
        setIsActive(true);
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const openCreateModal = () => {
        resetForm();
        setEditingSchedule(null);
        setIsModalOpen(true);
    };

    const openEditModal = (schedule: Schedule) => {
        setEditingSchedule(schedule);
        setTitle(schedule.title);
        setDepartmentId(schedule.department_id.toString());
        setProgramId(schedule.program_id?.toString() || '');
        setYearLevelId(schedule.year_level_id?.toString() || '');
        setSectionId(schedule.section_id?.toString() || '');
        setTeacherId(schedule.teacher_id?.toString() || '');
        setIsActive(schedule.is_active);
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        setIsModalOpen(true);
    };

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        setProcessing(true);

        const formData = new FormData();
        formData.append('title', title);
        formData.append('department_id', departmentId);
        if (programId) formData.append('program_id', programId);
        if (yearLevelId) formData.append('year_level_id', yearLevelId);
        if (sectionId) formData.append('section_id', sectionId);
        if (teacherId) formData.append('teacher_id', teacherId);
        formData.append('is_active', isActive ? '1' : '0');
        if (file) formData.append('file', file);

        if (editingSchedule) {
            formData.append('_method', 'PUT');
            router.post(`/registrar/schedule/${editingSchedule.id}`, formData, {
                onSuccess: () => {
                    toast.success('Schedule updated successfully');
                    setIsModalOpen(false);
                    resetForm();
                },
                onFinish: () => setProcessing(false),
            });
        } else {
            router.post('/registrar/schedule', formData, {
                onSuccess: () => {
                    toast.success('Schedule uploaded successfully');
                    setIsModalOpen(false);
                    resetForm();
                },
                onFinish: () => setProcessing(false),
            });
        }
    };

    const confirmDelete = (schedule: Schedule) => {
        setScheduleToDelete(schedule);
        setDeleteDialogOpen(true);
    };

    const handleDelete = () => {
        if (scheduleToDelete) {
            router.delete(`/registrar/schedule/${scheduleToDelete.id}`, {
                onSuccess: () => {
                    toast.success('Schedule deleted successfully');
                    setDeleteDialogOpen(false);
                    setScheduleToDelete(null);
                },
            });
        }
    };

    return (
        <RegistrarLayout breadcrumbs={breadcrumbs}>
            <Head title="Schedule" />

            <div className="space-y-6 p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-foreground">Schedule Management</h1>
                        <p className="mt-1 text-sm text-muted-foreground">Upload and manage class schedules (PDF or image)</p>
                    </div>
                    <Button onClick={openCreateModal}>
                        <Plus className="mr-2 h-4 w-4" />
                        Upload Schedule
                    </Button>
                </div>

                <Card>
                    <CardContent className="p-6">
                        <FilterBar onReset={handleReset}>
                            <SearchBar value={search} onChange={handleSearchChange} placeholder="Search schedules..." />
                            <FilterDropdown
                                label="Classification"
                                value={classification}
                                onChange={handleClassificationChange}
                                options={classificationOptions}
                            />
                            <FilterDropdown
                                label="Department"
                                value={selectedDepartment}
                                onChange={handleDepartmentFilterChange}
                                options={[
                                    { value: 'all', label: 'All Departments' },
                                    ...departments.map((d) => ({ value: d.id.toString(), label: d.name })),
                                ]}
                            />
                            <FilterDropdown
                                label="Status"
                                value={status}
                                onChange={handleStatusChange}
                                options={[
                                    { value: 'all', label: 'All Status' },
                                    { value: 'active', label: 'Active' },
                                    { value: 'inactive', label: 'Inactive' },
                                ]}
                            />
                        </FilterBar>

                        <div className="mt-6 overflow-x-auto">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="border-b">
                                        <th className="p-3 text-left text-sm font-semibold">Title</th>
                                        <th className="p-3 text-left text-sm font-semibold">Department</th>
                                        <th className="p-3 text-left text-sm font-semibold">Program</th>
                                        <th className="p-3 text-left text-sm font-semibold">Year Level</th>
                                        <th className="p-3 text-left text-sm font-semibold">Section</th>
                                        <th className="p-3 text-left text-sm font-semibold">Teacher</th>
                                        <th className="p-3 text-left text-sm font-semibold">File</th>
                                        <th className="p-3 text-left text-sm font-semibold">Status</th>
                                        <th className="p-3 text-left text-sm font-semibold">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {schedules.data.length === 0 ? (
                                        <tr>
                                            <td colSpan={9} className="p-8 text-center text-muted-foreground">
                                                No schedules found
                                            </td>
                                        </tr>
                                    ) : (
                                        schedules.data.map((schedule) => (
                                            <tr key={schedule.id} className="border-b hover:bg-muted/50">
                                                <td className="p-3 font-medium">{schedule.title}</td>
                                                <td className="p-3 text-sm">{schedule.department.name}</td>
                                                <td className="p-3 text-sm">{schedule.program?.name || 'All'}</td>
                                                <td className="p-3 text-sm">{schedule.year_level?.name || 'All'}</td>
                                                <td className="p-3 text-sm">{schedule.section?.name || 'All'}</td>
                                                <td className="p-3 text-sm">{schedule.teacher ? `${schedule.teacher.last_name}, ${schedule.teacher.first_name}${schedule.teacher.suffix ? ` ${schedule.teacher.suffix}` : ''}` : 'N/A'}</td>
                                                <td className="p-3 text-sm">{schedule.file_name}</td>
                                                <td className="p-3">
                                                    <Badge variant={schedule.is_active ? 'default' : 'secondary'}>
                                                        {schedule.is_active ? 'Active' : 'Inactive'}
                                                    </Badge>
                                                </td>
                                                <td className="p-3">
                                                    <div className="flex gap-2">
                                                        <Button variant="ghost" size="icon" onClick={() => setViewingSchedule(schedule)} title="View file">
                                                            <Eye className="h-4 w-4" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" onClick={() => openEditModal(schedule)}>
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" onClick={() => confirmDelete(schedule)}>
                                                            <Trash2 className="h-4 w-4 text-destructive" />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {schedules.last_page > 1 && (
                            <div className="mt-4">
                                <Pagination data={schedules} />
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingSchedule ? 'Edit Schedule' : 'Upload Schedule'}</DialogTitle>
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <Label htmlFor="title">Title *</Label>
                            <Input
                                id="title"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="e.g., BSIT 1st Year Class Schedule"
                                required
                            />
                        </div>

                        <div>
                            <Label htmlFor="department">Department *</Label>
                            <Select value={departmentId} onValueChange={(value) => {
                                setDepartmentId(value);
                                setProgramId('');
                                setYearLevelId('');
                                setSectionId('');
                                setTeacherId('');
                            }}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select department" />
                                </SelectTrigger>
                                <SelectContent>
                                    {modalDepartments.map((dept) => (
                                        <SelectItem key={dept.id} value={dept.id.toString()}>
                                            {dept.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="program">Program (Optional)</Label>
                                <Select value={programId || '__all__'} onValueChange={(value) => setProgramId(value === '__all__' ? '' : value)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="All programs" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="__all__">All Programs</SelectItem>
                                        {filteredPrograms.map((program) => (
                                            <SelectItem key={program.id} value={program.id.toString()}>
                                                {program.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label htmlFor="yearLevel">Year Level (Optional)</Label>
                                <Select value={yearLevelId || '__all__'} onValueChange={(value) => {
                                    const next = value === '__all__' ? '' : value;
                                    setYearLevelId(next);
                                    setSectionId('');
                                }}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="All year levels" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="__all__">All Year Levels</SelectItem>
                                        {filteredYearLevels.map((year) => (
                                            <SelectItem key={year.id} value={year.id.toString()}>
                                                {year.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="section">Section (Optional)</Label>
                                <Select value={sectionId || '__all__'} onValueChange={(value) => setSectionId(value === '__all__' ? '' : value)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="All sections" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="__all__">All Sections</SelectItem>
                                        {filteredSections.map((section) => (
                                            <SelectItem key={section.id} value={section.id.toString()}>
                                                {section.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label htmlFor="teacher">Teacher (Optional)</Label>
                                <Select value={teacherId || '__all__'} onValueChange={(value) => setTeacherId(value === '__all__' ? '' : value)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Unassigned" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="__all__">Unassigned</SelectItem>
                                        {filteredTeachers.map((teacher) => (
                                            <SelectItem key={teacher.id} value={teacher.id.toString()}>
                                                {teacher.last_name}, {teacher.first_name}{teacher.suffix ? ` ${teacher.suffix}` : ''}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div>
                            <Label htmlFor="file">
                                Schedule File (PDF/Image) {editingSchedule ? '(leave blank to keep current)' : '*'}
                            </Label>
                            <Input
                                id="file"
                                type="file"
                                accept=".pdf,.jpg,.jpeg,.png,.webp"
                                ref={fileInputRef}
                                onChange={(e) => setFile(e.target.files?.[0] || null)}
                                required={!editingSchedule}
                            />
                            <p className="mt-1 text-xs text-muted-foreground">Max 10MB, PDF/JPG/JPEG/PNG/WEBP</p>
                        </div>

                        <div className="flex items-center justify-between">
                            <Label htmlFor="isActive">Active</Label>
                            <Switch id="isActive" checked={isActive} onCheckedChange={setIsActive} />
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={processing || !title || !departmentId || (!editingSchedule && !file)}>
                                {processing ? 'Saving...' : editingSchedule ? 'Update' : 'Upload'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <ConfirmDialog
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
                title="Delete Schedule"
                description={`Are you sure you want to delete "${scheduleToDelete?.title}"? This action cannot be undone.`}
                onConfirm={handleDelete}
                confirmLabel="Delete"
                cancelLabel="Cancel"
                variant="danger"
            />

            <PdfViewer
                open={!!viewingSchedule}
                onOpenChange={() => setViewingSchedule(null)}
                title={viewingSchedule?.title || ''}
                filePath={viewingSchedule?.file_path || ''}
            />
        </RegistrarLayout>
    );
}
