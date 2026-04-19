import { Head, router } from '@inertiajs/react';
import {
    CheckCircle2,
    Circle,
    Search,
    Filter,
    Users,
    Clock,
    AlertCircle,
    ClipboardList,
    CheckCircle,
    XCircle,
} from 'lucide-react';
import { PhilippinePeso } from '@/components/icons/philippine-peso';
import { useState } from 'react';
import { toast } from 'sonner';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import AccountingLayout from '@/layouts/accounting-layout';

interface EnrollmentClearance {
    id: number;
    accounting_clearance: boolean;
    accounting_cleared_at: string | null;
    accounting_notes: string | null;
}

interface ErSubject {
    id: number;
    code: string;
    name: string;
    units: number;
    type: string;
    selling_price: number;
}

interface EnrollmentRequestItem {
    id: number;
    school_year: string;
    semester: number;
    status: string;
    created_at: string;
    total_selling_price: number;
    student: {
        id: number;
        full_name: string;
        lrn: string;
        program: string | null;
        year_level: string | null;
        photo_url: string | null;
    };
    subjects: ErSubject[];
}

interface Student {
    id: number;
    first_name: string;
    middle_name: string | null;
    last_name: string;
    suffix: string | null;
    lrn: string;
    program: string;
    year_level: string;
    section: string | null;
    student_photo_url: string | null;
    enrollment_clearance: EnrollmentClearance | null;
    total_fees: number;
    total_paid: number;
    balance: number;
    is_fully_paid: boolean;
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
    programs: string[];
    yearLevels: string[];
    departments: { id: number; name: string; code: string; classification: string; }[];
    classifications: string[];
    stats: {
        total: number;
        pending: number;
        cleared: number;
    };
    filters: {
        search?: string;
        status?: string;
        program?: string;
        year_level?: string;
        department_id?: string;
        classification?: string;
    };
    enrollmentRequests: EnrollmentRequestItem[];
    erSearch: string;
}

export default function ClearanceIndex({ students, programs, yearLevels, departments = [], classifications = [], stats, filters, enrollmentRequests = [], erSearch: initialErSearch = '' }: Props) {
    const [search, setSearch] = useState(filters.search || '');
    const [status, setStatus] = useState(filters.status || 'pending');
    const [program, setProgram] = useState(filters.program || 'all');
    const [yearLevel, setYearLevel] = useState(filters.year_level || 'all');
    const [departmentId, setDepartmentId] = useState(filters.department_id || 'all');
    const [classification, setClassification] = useState(filters.classification || 'all');
    const [selectedStudents, setSelectedStudents] = useState<number[]>([]);
    const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; student: Student | null; action: 'clear' | 'unclear' }>({
        open: false,
        student: null,
        action: 'clear',
    });
    const [bulkAction, setBulkAction] = useState<'clear' | 'unclear' | null>(null);

    // Enrollment clearance state
    const [mainTab, setMainTab] = useState('student-clearance');
    const [erSearchInput, setErSearchInput] = useState(initialErSearch);
    const [erDisapproveDialog, setErDisapproveDialog] = useState<EnrollmentRequestItem | null>(null);
    const [erNotes, setErNotes] = useState('');
    const [erActing, setErActing] = useState(false);

    const formatPeso = (v: number) =>
        new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(v);
    const semLabel: Record<number, string> = { 1: '1st Semester', 2: '2nd Semester', 3: 'Summer' };

    const handleErApprove = (er: EnrollmentRequestItem) => {
        setErActing(true);
        router.post(`/accounting/enrollment-clearance/${er.id}/approve`, {}, {
            preserveScroll: true,
            onSuccess: () => { toast.success('Enrollment request approved.'); setErActing(false); },
            onError: () => { toast.error('Failed to approve.'); setErActing(false); },
        });
    };

    const handleErDisapproveSubmit = () => {
        if (!erDisapproveDialog) return;
        setErActing(true);
        router.post(`/accounting/enrollment-clearance/${erDisapproveDialog.id}/disapprove`, { notes: erNotes }, {
            preserveScroll: true,
            onSuccess: () => { toast.success('Request rejected.'); setErDisapproveDialog(null); setErNotes(''); setErActing(false); },
            onError: () => { toast.error('Failed to reject.'); setErActing(false); },
        });
    };

    const handleErSearch = () => {
        router.get('/accounting/clearance', { er_search: erSearchInput, tab: 'enrollment' }, { preserveState: true, preserveScroll: true });
    };

    const formatMoney = (amount: number) => {
        return new Intl.NumberFormat('en-PH', {
            style: 'currency',
            currency: 'PHP',
        }).format(amount);
    };

    const getFullName = (student: Student) => {
        let name = `${student.first_name}`;
        if (student.middle_name) name += ` ${student.middle_name}`;
        name += ` ${student.last_name}`;
        if (student.suffix) name += ` ${student.suffix}`;
        return name;
    };

    const getInitials = (student: Student) => {
        return `${student.first_name[0]}${student.last_name[0]}`.toUpperCase();
    };

    const handleSearch = () => {
        router.get('/accounting/clearance', {
            search,
            status: status !== 'all' ? status : undefined,
            program: program !== 'all' ? program : undefined,
            year_level: yearLevel !== 'all' ? yearLevel : undefined,
            department_id: departmentId !== 'all' ? departmentId : undefined,
            classification: classification !== 'all' ? classification : undefined,
        }, {
            preserveState: true,
            preserveScroll: true,
        });
    };

    const handleFilterChange = (key: string, value: string) => {
        const params: Record<string, string | undefined> = {
            search: search || undefined,
            status: status !== 'all' ? status : undefined,
            program: program !== 'all' ? program : undefined,
            year_level: yearLevel !== 'all' ? yearLevel : undefined,
            department_id: departmentId !== 'all' ? departmentId : undefined,
            classification: classification !== 'all' ? classification : undefined,
        };
        
        if (value === 'all') {
            delete params[key];
        } else {
            params[key] = value;
        }
        
        router.get('/accounting/clearance', params, {
            preserveState: true,
            preserveScroll: true,
        });
    };

    const handleClearanceToggle = (student: Student, newStatus: boolean) => {
        router.put(`/accounting/clearance/${student.id}`, {
            status: newStatus,
        }, {
            preserveScroll: true,
            onSuccess: () => {
                toast.success(newStatus 
                    ? `${getFullName(student)} cleared successfully` 
                    : `Clearance removed for ${getFullName(student)}`);
                setConfirmDialog({ open: false, student: null, action: 'clear' });
            },
            onError: () => {
                toast.error('Failed to update clearance status');
            },
        });
    };

    const handleBulkClear = (status: boolean) => {
        if (selectedStudents.length === 0) {
            toast.error('Please select at least one student');
            return;
        }

        router.post('/accounting/clearance/bulk-clear', {
            student_ids: selectedStudents,
            status,
        }, {
            preserveScroll: true,
            onSuccess: () => {
                toast.success(`${selectedStudents.length} students updated successfully`);
                setSelectedStudents([]);
                setBulkAction(null);
            },
            onError: () => {
                toast.error('Failed to update students');
            },
        });
    };

    const toggleSelectAll = () => {
        if (selectedStudents.length === students.data.length) {
            setSelectedStudents([]);
        } else {
            setSelectedStudents(students.data.map(s => s.id));
        }
    };

    const toggleSelect = (studentId: number) => {
        setSelectedStudents(prev =>
            prev.includes(studentId)
                ? prev.filter(id => id !== studentId)
                : [...prev, studentId]
        );
    };

    return (
        <AccountingLayout>
            <Head title="Student Clearance" />

            <div className="space-y-6 p-6">
                {/* Header */}
                <div>
                    <h1 className="text-3xl font-bold">Student Clearance</h1>
                    <p className="mt-1 text-sm text-gray-600">
                        Manage accounting clearance for student enrollment
                    </p>
                </div>

                {/* Main section tabs */}
                <Tabs value={mainTab} onValueChange={setMainTab}>
                    <TabsList className="grid w-full max-w-md grid-cols-2">
                        <TabsTrigger value="student-clearance" className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4" />
                            Student Clearance
                        </TabsTrigger>
                        <TabsTrigger value="enrollment-clearance" className="flex items-center gap-2">
                            <ClipboardList className="h-4 w-4" />
                            Enrollment Clearance
                            {enrollmentRequests.length > 0 && (
                                <span className="ml-1 rounded-full bg-primary text-primary-foreground text-xs px-1.5 py-0.5 leading-none">
                                    {enrollmentRequests.length}
                                </span>
                            )}
                        </TabsTrigger>
                    </TabsList>

                    {/* ── Student Clearance Tab ── */}
                    <TabsContent value="student-clearance" className="space-y-6 mt-4">

                {/* Pending / Cleared Tabs */}
                <Tabs value={status} onValueChange={(v) => { setStatus(v); handleFilterChange('status', v); }}>
                    <TabsList className="grid w-full max-w-sm grid-cols-2">
                        <TabsTrigger value="pending" className="flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            Pending
                            <Badge variant="secondary" className="ml-1 bg-orange-100 text-orange-700">{stats.pending}</Badge>
                        </TabsTrigger>
                        <TabsTrigger value="cleared" className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4" />
                            Cleared
                            <Badge variant="secondary" className="ml-1 bg-green-100 text-green-700">{stats.cleared}</Badge>
                        </TabsTrigger>
                    </TabsList>
                </Tabs>

                {/* Stats Cards */}
                <div className="grid gap-4 md:grid-cols-3">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Students</CardTitle>
                            <Users className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.total}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Pending Clearance</CardTitle>
                            <Clock className="h-4 w-4 text-orange-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-orange-600">{stats.pending}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Cleared</CardTitle>
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-green-600">{stats.cleared}</div>
                        </CardContent>
                    </Card>
                </div>

                {/* Filters */}
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex flex-wrap items-center gap-4">
                            <div className="flex-1 min-w-50">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <Input
                                        placeholder="Search by name, LRN, email..."
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                        className="pl-9"
                                    />
                                </div>
                            </div>
                            <Select value={program} onValueChange={(v) => { setProgram(v); handleFilterChange('program', v); }}>
                                <SelectTrigger className="w-37.5">
                                    <SelectValue placeholder="Program" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Programs</SelectItem>
                                    {programs.map((p) => (
                                        <SelectItem key={p} value={p}>{p}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select value={yearLevel} onValueChange={(v) => { setYearLevel(v); handleFilterChange('year_level', v); }}>
                                <SelectTrigger className="w-37.5">
                                    <SelectValue placeholder="Year Level" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Year Levels</SelectItem>
                                    {yearLevels.map((y) => (
                                        <SelectItem key={y} value={y}>{y}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select value={classification} onValueChange={(v) => { setClassification(v); handleFilterChange('classification', v); }}>
                                <SelectTrigger className="w-37.5">
                                    <SelectValue placeholder="Classification" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Classifications</SelectItem>
                                    {classifications.map((c) => (
                                        <SelectItem key={c} value={c}>{c}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select value={departmentId} onValueChange={(v) => { setDepartmentId(v); handleFilterChange('department_id', v); }}>
                                <SelectTrigger className="w-37.5">
                                    <SelectValue placeholder="Department" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Departments</SelectItem>
                                    {departments.map((d) => (
                                        <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Button onClick={handleSearch}>
                                <Search className="mr-2 h-4 w-4" />
                                Search
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Bulk Actions */}
                {selectedStudents.length > 0 && (
                    <Card className="bg-blue-50 border-blue-200">
                        <CardContent className="pt-4 pb-4">
                            <div className="flex items-center justify-between">
                                <span className="font-medium">
                                    {selectedStudents.length} student(s) selected
                                </span>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        onClick={() => setSelectedStudents([])}
                                    >
                                        Clear Selection
                                    </Button>
                                    <Button
                                        variant="default"
                                        onClick={() => setBulkAction('clear')}
                                    >
                                        <CheckCircle2 className="mr-2 h-4 w-4" />
                                        Clear Selected
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Students Table */}
                <Card>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-12">
                                        <Checkbox
                                            checked={selectedStudents.length === students.data.length && students.data.length > 0}
                                            onCheckedChange={toggleSelectAll}
                                        />
                                    </TableHead>
                                    <TableHead>Student</TableHead>
                                    <TableHead>Program / Year</TableHead>
                                    <TableHead className="text-center">Clearance Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {students.data.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                                            No students found.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    students.data.map((student) => (
                                        <TableRow
                                            key={student.id}
                                            className="cursor-pointer hover:bg-muted/50"
                                            onClick={() => router.visit(`/accounting/payments/process/${student.id}`)}
                                        >
                                            <TableCell onClick={(e) => e.stopPropagation()}>
                                                <Checkbox
                                                    checked={selectedStudents.includes(student.id)}
                                                    onCheckedChange={() => toggleSelect(student.id)}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-10 w-10">
                                                        <AvatarImage src={student.student_photo_url || undefined} />
                                                        <AvatarFallback>{getInitials(student)}</AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <div className="font-medium">{getFullName(student)}</div>
                                                        <div className="text-sm text-muted-foreground">Student No.: {student.lrn}</div>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div>{student.program}</div>
                                                <div className="text-sm text-muted-foreground">
                                                    {student.year_level}{student.section ? ` - ${student.section}` : ''}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {student.enrollment_clearance?.accounting_clearance ? (
                                                    <Badge className="bg-green-100 text-green-700">
                                                        <CheckCircle2 className="mr-1 h-3 w-3" />
                                                        Cleared
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="secondary" className="bg-orange-100 text-orange-700">
                                                        <Clock className="mr-1 h-3 w-3" />
                                                        Pending
                                                    </Badge>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* Pagination */}
                <Pagination data={students} />

                    </TabsContent>{/* end student-clearance */}

                    {/* ── Enrollment Clearance Tab ── */}
                    <TabsContent value="enrollment-clearance" className="space-y-4 mt-4">
                        <div className="flex items-center gap-3">
                            <div className="relative flex-1 max-w-sm">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search by name or LRN..."
                                    value={erSearchInput}
                                    onChange={e => setErSearchInput(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleErSearch()}
                                    className="pl-9"
                                />
                            </div>
                            <Button variant="outline" onClick={handleErSearch} size="sm">Search</Button>
                        </div>

                        {enrollmentRequests.length === 0 ? (
                            <Card>
                                <CardContent className="py-12 text-center text-muted-foreground">
                                    <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-40" />
                                    <p className="font-medium">No pending enrollment clearances</p>
                                    <p className="text-sm">Requests approved by the registrar will appear here.</p>
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="space-y-4">
                                {enrollmentRequests.map(er => (
                                    <Card key={er.id}>
                                        <CardContent className="pt-5 space-y-3">
                                            <div className="flex items-start justify-between gap-3 flex-wrap">
                                                <div className="flex items-center gap-3">
                                                    <div>
                                                        <p className="font-semibold">{er.student.full_name}</p>
                                                        <p className="text-sm text-muted-foreground">
                                                            LRN: {er.student.lrn} · {er.student.program ?? '—'} · {er.student.year_level ?? '—'}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="text-right text-sm text-muted-foreground">
                                                    <p>{er.school_year} — {semLabel[er.semester] ?? `Sem ${er.semester}`}</p>
                                                    <p>Submitted {new Date(er.created_at).toLocaleDateString()}</p>
                                                </div>
                                            </div>

                                            {/* Subjects table */}
                                            <div className="rounded-md border">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead>Code</TableHead>
                                                            <TableHead>Subject</TableHead>
                                                            <TableHead className="text-center">Units</TableHead>
                                                            <TableHead className="text-right">Selling Price</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {er.subjects.map(s => (
                                                            <TableRow key={s.id}>
                                                                <TableCell className="font-mono text-sm">{s.code}</TableCell>
                                                                <TableCell>{s.name}</TableCell>
                                                                <TableCell className="text-center">{s.units}</TableCell>
                                                                <TableCell className="text-right">
                                                                    {s.selling_price > 0 ? formatPeso(s.selling_price) : '—'}
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </div>

                                            {er.total_selling_price > 0 && (
                                                <div className="flex justify-end text-sm font-semibold">
                                                    Total: {formatPeso(er.total_selling_price)}
                                                </div>
                                            )}

                                            <div className="flex gap-2 pt-1">
                                                <Button size="sm" onClick={() => handleErApprove(er)} disabled={erActing}>
                                                    <CheckCircle className="h-3.5 w-3.5 mr-1" />
                                                    Approve
                                                </Button>
                                                <Button size="sm" variant="destructive" onClick={() => { setErDisapproveDialog(er); setErNotes(''); }} disabled={erActing}>
                                                    <XCircle className="h-3.5 w-3.5 mr-1" />
                                                    Disapprove
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </TabsContent>{/* end enrollment-clearance */}

                </Tabs>{/* end mainTab */}
            </div>

            {/* Confirm Dialog */}
            <AlertDialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {confirmDialog.action === 'clear' ? 'Clear Student?' : 'Remove Clearance?'}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {confirmDialog.action === 'clear' ? (
                                <>
                                    Are you sure you want to clear <strong>{confirmDialog.student && getFullName(confirmDialog.student)}</strong> for accounting?
                                    {confirmDialog.student && confirmDialog.student.balance > 0 && (
                                        <span className="block mt-2 text-orange-600">
                                            <AlertCircle className="inline mr-1 h-4 w-4" />
                                            Note: This student still has an outstanding balance of {formatMoney(confirmDialog.student.balance)}.
                                        </span>
                                    )}
                                </>
                            ) : (
                                <>
                                    Are you sure you want to remove accounting clearance for <strong>{confirmDialog.student && getFullName(confirmDialog.student)}</strong>?
                                </>
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => confirmDialog.student && handleClearanceToggle(confirmDialog.student, confirmDialog.action === 'clear')}
                        >
                            {confirmDialog.action === 'clear' ? 'Clear Student' : 'Remove Clearance'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Bulk Action Dialog */}
            <AlertDialog open={bulkAction !== null} onOpenChange={(open) => !open && setBulkAction(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Clear {selectedStudents.length} Students?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to clear accounting for {selectedStudents.length} selected students?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleBulkClear(true)}>
                            Clear All Selected
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            {/* Enrollment Request Disapprove Dialog */}
            <Dialog open={!!erDisapproveDialog} onOpenChange={(o) => { if (!o) setErDisapproveDialog(null); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Disapprove Enrollment Request</DialogTitle>
                        <DialogDescription>
                            Provide a reason that will be visible to the student.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-2">
                        <Label htmlFor="er-notes">Notes *</Label>
                        <Textarea
                            id="er-notes"
                            value={erNotes}
                            onChange={(e) => setErNotes(e.target.value)}
                            placeholder="Enter reason for disapproval..."
                            rows={3}
                            className="mt-1"
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setErDisapproveDialog(null)}>Cancel</Button>
                        <Button variant="destructive" onClick={handleErDisapproveSubmit} disabled={erActing || !erNotes.trim()}>
                            {erActing ? 'Rejecting...' : 'Confirm Rejection'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AccountingLayout>
    );
}
