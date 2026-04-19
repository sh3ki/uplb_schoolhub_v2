import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    BookOpen,
    CheckCircle2,
    AlertTriangle,
    GraduationCap,
    Search,
    Info,
    Plus,
    Minus,
    Lock,
    Filter,
    X,
    Clock,
    XCircle,
    CheckSquare,
    ClipboardList,
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@/components/ui/tabs';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import StudentLayout from '@/layouts/student/student-layout';

interface Prerequisite {
    id: number;
    code: string;
    name: string;
    completed: boolean;
}

interface AvailableSubject {
    id: number;
    code: string;
    name: string;
    description: string | null;
    units: number;
    type: string;
    semester: number | null;
    hours_per_week: number | null;
    selling_price: number;
    year_level_name: string;
    level_number: number;
    prerequisites: Prerequisite[];
    prerequisites_met: boolean;
    programs: string[];
}

interface EnrolledSubject {
    id: number;
    subject_id: number;
    code: string;
    name: string;
    units: number;
    type: string;
    status: string;
    grade: number | null;
}

interface CompletedSubject {
    id: number;
    subject_id: number;
    code: string;
    name: string;
    units: number;
    type: string;
    school_year: string;
    semester: number | null;
    grade: number | null;
}

interface EnrollmentRequestSubject {
    id: number;
    code: string;
    name: string;
    units: number;
    type: string;
    selling_price: number;
}

interface ActiveRequest {
    id: number;
    status: string;
    registrar_notes: string | null;
    accounting_notes: string | null;
    created_at: string;
    subjects: EnrollmentRequestSubject[];
}

interface RejectedRequest {
    id: number;
    status: string;
    registrar_notes: string | null;
    accounting_notes: string | null;
    created_at: string;
}

interface StudentInfo {
    id: number;
    first_name: string;
    last_name: string;
    lrn: string;
    program: string | null;
    year_level: string | null;
    department_id: number | null;
    enrollment_status: string;
}

interface Props {
    student: StudentInfo;
    currentSchoolYear: string;
    activeSemester: number;
    activeSemesterLabel: string;
    availableSubjects: AvailableSubject[];
    enrolledSubjects: EnrolledSubject[];
    completedSubjects: CompletedSubject[];
    completedSubjectIds: number[];
    enrolledUnits: number;
    maxUnits: number;
    minUnits: number;
    idealUnits: number;
    activeRequest: ActiveRequest | null;
    rejectedRequests: RejectedRequest[];
}

const typeColors: Record<string, string> = {
    core:     'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    major:    'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    elective: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
    general:  'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
};

const semesterLabels: Record<number, string> = { 1: '1st Sem', 2: '2nd Sem', 3: 'Summer' };

const formatPeso = (val: number) =>
    new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(val);

const requestStatusBadge = (status: string) => {
    const map: Record<string, { label: string; className: string }> = {
        pending_registrar:   { label: 'Pending Registrar',  className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
        pending_accounting:  { label: 'Pending Accounting', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
        approved_accounting: { label: 'Approved by Accounting', className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
        rejected_registrar:  { label: 'Rejected by Registrar',  className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
        rejected_accounting: { label: 'Rejected by Accounting', className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
        completed:           { label: 'Completed', className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
    };
    const cfg = map[status] ?? { label: status, className: '' };
    return <Badge variant="secondary" className={cfg.className}>{cfg.label}</Badge>;
};

export default function SubjectEnrollment({
    student,
    currentSchoolYear,
    activeSemester,
    activeSemesterLabel,
    availableSubjects,
    enrolledSubjects,
    completedSubjects,
    completedSubjectIds,
    enrolledUnits,
    maxUnits,
    minUnits,
    idealUnits,
    activeRequest,
    rejectedRequests,
}: Props) {
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState<string>('all');
    const [yearFilter, setYearFilter] = useState<string>('all');
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [dropping, setDropping] = useState(false);
    const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
    const [dropDialogOpen, setDropDialogOpen] = useState(false);
    const [subjectToDrop, setSubjectToDrop] = useState<EnrolledSubject | null>(null);

    const selectedUnits = useMemo(() =>
        availableSubjects.filter(s => selectedIds.includes(s.id)).reduce((sum, s) => sum + s.units, 0),
        [selectedIds, availableSubjects]
    );

    const selectedTotalPrice = useMemo(() =>
        availableSubjects.filter(s => selectedIds.includes(s.id)).reduce((sum, s) => sum + s.selling_price, 0),
        [selectedIds, availableSubjects]
    );

    const totalUnitsAfterEnroll = enrolledUnits + selectedUnits;
    const unitProgress = Math.min((totalUnitsAfterEnroll / maxUnits) * 100, 100);
    const wouldExceedMax = totalUnitsAfterEnroll > maxUnits;

    const yearLevels = useMemo(() => {
        const unique = [...new Set(availableSubjects.map(s => s.year_level_name))];
        return unique.sort((a, b) => {
            const aNum = availableSubjects.find(s => s.year_level_name === a)?.level_number ?? 0;
            const bNum = availableSubjects.find(s => s.year_level_name === b)?.level_number ?? 0;
            return aNum - bNum;
        });
    }, [availableSubjects]);

    const subjectTypes = useMemo(() => [...new Set(availableSubjects.map(s => s.type))], [availableSubjects]);

    const filteredSubjects = useMemo(() =>
        availableSubjects.filter(s => {
            if (search) {
                const q = search.toLowerCase();
                if (!s.code.toLowerCase().includes(q) && !s.name.toLowerCase().includes(q)) return false;
            }
            if (typeFilter !== 'all' && s.type !== typeFilter) return false;
            if (yearFilter !== 'all' && s.year_level_name !== yearFilter) return false;
            return true;
        }),
        [availableSubjects, search, typeFilter, yearFilter]
    );

    const groupedSubjects = useMemo(() => {
        const groups: Record<string, AvailableSubject[]> = {};
        filteredSubjects.forEach(s => {
            if (!groups[s.year_level_name]) groups[s.year_level_name] = [];
            groups[s.year_level_name].push(s);
        });
        return Object.entries(groups).sort((a, b) => {
            const aNum = a[1][0]?.level_number ?? 0;
            const bNum = b[1][0]?.level_number ?? 0;
            return aNum - bNum;
        });
    }, [filteredSubjects]);

    const toggleSubject = (subjectId: number) => {
        setSelectedIds(prev =>
            prev.includes(subjectId) ? prev.filter(id => id !== subjectId) : [...prev, subjectId]
        );
    };

    const handleEnrollSubmit = () => {
        if (selectedIds.length === 0) { toast.error('Please select at least one subject'); return; }
        if (wouldExceedMax) { toast.error(`Cannot enroll: total units would exceed maximum of ${maxUnits}.`); return; }
        setConfirmDialogOpen(true);
    };

    const confirmEnroll = () => {
        setSubmitting(true);
        setConfirmDialogOpen(false);
        router.post('/student/enrollment/subjects', { subject_ids: selectedIds }, {
            preserveScroll: true,
            onSuccess: () => { setSelectedIds([]); setSubmitting(false); toast.success('Enrollment request submitted!'); },
            onError: () => { setSubmitting(false); toast.error('Failed to submit request. Please try again.'); },
        });
    };

    const confirmDrop = () => {
        if (!subjectToDrop) return;
        setDropping(true);
        setDropDialogOpen(false);
        router.delete(`/student/enrollment/subjects/${subjectToDrop.id}`, {
            preserveScroll: true,
            onSuccess: () => { setDropping(false); setSubjectToDrop(null); toast.success(`Dropped ${subjectToDrop.name}.`); },
            onError: () => { setDropping(false); toast.error('Failed to drop subject.'); },
        });
    };

    const selectedSubjects = availableSubjects.filter(s => selectedIds.includes(s.id));
    const hasActiveRequest = !!activeRequest;

    return (
        <StudentLayout>
            <Head title="Subject Enrollment" />

            {/* Enrollment Tabs */}
            <div className="border-b px-6 pt-2">
                <nav className="flex">
                    <Link
                        href="/student/enrollment"
                        className="px-5 py-2.5 text-sm font-medium border-b-2 border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300 transition-colors"
                    >
                        Enrollment Details
                    </Link>
                    <Link
                        href="/student/enrollment/subjects"
                        className="px-5 py-2.5 text-sm font-medium border-b-2 border-primary text-primary transition-colors"
                    >
                        Subject Enrollment
                    </Link>
                </nav>
            </div>

            <div className="space-y-6 p-6">
                {/* Header */}
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                            <BookOpen className="h-6 w-6 text-primary" />
                            Subject Enrollment
                        </h1>
                        <p className="text-muted-foreground">
                            {activeSemesterLabel} — S.Y. {currentSchoolYear}
                        </p>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                        <Badge variant="outline" className="text-sm">
                            <GraduationCap className="h-3.5 w-3.5 mr-1" />
                            {student.program ?? 'No Program'}
                        </Badge>
                        <Badge variant="outline" className="text-sm">
                            {student.year_level ?? 'N/A'}
                        </Badge>
                    </div>
                </div>

                {/* Rejected request notices */}
                {rejectedRequests.map(rr => (
                    <Alert key={rr.id} variant="destructive">
                        <XCircle className="h-4 w-4" />
                        <AlertTitle>Enrollment Request Rejected</AlertTitle>
                        <AlertDescription>
                            {rr.status === 'rejected_registrar' && rr.registrar_notes && (
                                <span><strong>Registrar note:</strong> {rr.registrar_notes}</span>
                            )}
                            {rr.status === 'rejected_accounting' && rr.accounting_notes && (
                                <span><strong>Accounting note:</strong> {rr.accounting_notes}</span>
                            )}
                        </AlertDescription>
                    </Alert>
                ))}

                {/* Active enrollment request banner */}
                {activeRequest && (
                    <Alert>
                        <Clock className="h-4 w-4" />
                        <AlertTitle className="flex items-center gap-2">
                            Enrollment Request In Progress
                            {requestStatusBadge(activeRequest.status)}
                        </AlertTitle>
                        <AlertDescription>
                            <p className="mb-2">Your enrollment request for {activeRequest.subjects.length} subject(s) is under review.</p>
                            <div className="flex flex-wrap gap-1">
                                {activeRequest.subjects.map(s => (
                                    <Badge key={s.id} variant="outline" className="text-xs">
                                        {s.code}
                                    </Badge>
                                ))}
                            </div>
                            {activeRequest.status === 'approved_accounting' && (
                                <p className="mt-2 text-sm font-medium text-green-700 dark:text-green-400">
                                    ✓ Approved by accounting. Waiting for registrar to finalize enrollment.
                                </p>
                            )}
                        </AlertDescription>
                    </Alert>
                )}

                <Tabs defaultValue="enroll">
                    <TabsList>
                        <TabsTrigger value="enroll">
                            <BookOpen className="h-3.5 w-3.5 mr-1" />
                            Available Subjects
                        </TabsTrigger>
                        <TabsTrigger value="completed">
                            <CheckSquare className="h-3.5 w-3.5 mr-1" />
                            Completed Subjects ({completedSubjects.length})
                        </TabsTrigger>
                    </TabsList>

                    {/* ── Available Subjects Tab ── */}
                    <TabsContent value="enroll" className="space-y-6 mt-4">
                        {/* Unit Counter Card */}
                        <Card>
                            <CardContent className="pt-5">
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium text-muted-foreground">Enrolled Units</p>
                                            <p className="text-2xl font-bold">
                                                {enrolledUnits}
                                                {selectedUnits > 0 && <span className="text-primary"> + {selectedUnits}</span>}
                                                <span className="text-lg text-muted-foreground font-normal"> / {maxUnits}</span>
                                            </p>
                                        </div>
                                        <div className="text-right text-sm text-muted-foreground space-y-0.5">
                                            <p>Standard: {idealUnits} units</p>
                                            <p>Min: {minUnits} | Max: {maxUnits} units</p>
                                        </div>
                                    </div>
                                    <Progress value={unitProgress} className={wouldExceedMax ? '[&>div]:bg-destructive' : ''} />
                                    {wouldExceedMax && (
                                        <p className="text-sm text-destructive flex items-center gap-1">
                                            <AlertTriangle className="h-3.5 w-3.5" />
                                            Exceeds maximum of {maxUnits} units per semester
                                        </p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Currently Enrolled Subjects */}
                        {enrolledSubjects.length > 0 && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2 text-lg">
                                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                                        Currently Enrolled Subjects ({enrolledSubjects.length})
                                    </CardTitle>
                                    <CardDescription>
                                        {activeSemesterLabel} — {enrolledUnits} total units
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="rounded-md border">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Code</TableHead>
                                                    <TableHead>Subject</TableHead>
                                                    <TableHead className="text-center">Units</TableHead>
                                                    <TableHead className="text-center">Type</TableHead>
                                                    <TableHead className="text-center">Status</TableHead>
                                                    <TableHead className="text-right">Action</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {enrolledSubjects.map(es => (
                                                    <TableRow key={es.id}>
                                                        <TableCell className="font-mono font-medium">{es.code}</TableCell>
                                                        <TableCell>{es.name}</TableCell>
                                                        <TableCell className="text-center">{es.units}</TableCell>
                                                        <TableCell className="text-center">
                                                            <Badge variant="secondary" className={typeColors[es.type] || ''}>
                                                                {es.type}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="text-center">
                                                            <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                                                {es.status}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            {es.status === 'enrolled' && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="text-destructive hover:text-destructive"
                                                                    onClick={() => { setSubjectToDrop(es); setDropDialogOpen(true); }}
                                                                    disabled={dropping}
                                                                >
                                                                    <Minus className="h-3.5 w-3.5 mr-1" />
                                                                    Drop
                                                                </Button>
                                                            )}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Available Subjects */}
                        <Card>
                            <CardHeader>
                                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                    <div>
                                        <CardTitle className="flex items-center gap-2 text-lg">
                                            <BookOpen className="h-5 w-5 text-primary" />
                                            Available Subjects
                                        </CardTitle>
                                        <CardDescription>
                                            Select subjects for {activeSemesterLabel}. Max {maxUnits} units.
                                        </CardDescription>
                                    </div>
                                    {selectedIds.length > 0 && (
                                        <Button
                                            onClick={handleEnrollSubmit}
                                            disabled={submitting || wouldExceedMax || hasActiveRequest}
                                            className="shrink-0"
                                        >
                                            <Plus className="h-4 w-4 mr-1" />
                                            Request {selectedIds.length} Subject{selectedIds.length > 1 ? 's' : ''} ({selectedUnits} units)
                                        </Button>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {hasActiveRequest && (
                                    <Alert>
                                        <Clock className="h-4 w-4" />
                                        <AlertDescription>
                                            You have a pending enrollment request. You cannot submit another request until it is resolved.
                                        </AlertDescription>
                                    </Alert>
                                )}

                                {/* Filters */}
                                <div className="flex flex-col gap-3 md:flex-row md:items-center">
                                    <div className="relative flex-1">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            placeholder="Search by code or name..."
                                            value={search}
                                            onChange={e => setSearch(e.target.value)}
                                            className="pl-9"
                                        />
                                        {search && (
                                            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                                                <X className="h-4 w-4" />
                                            </button>
                                        )}
                                    </div>
                                    <Select value={typeFilter} onValueChange={setTypeFilter}>
                                        <SelectTrigger className="w-40">
                                            <Filter className="h-3.5 w-3.5 mr-1" />
                                            <SelectValue placeholder="Type" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Types</SelectItem>
                                            {subjectTypes.map(t => (
                                                <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Select value={yearFilter} onValueChange={setYearFilter}>
                                        <SelectTrigger className="w-45">
                                            <Filter className="h-3.5 w-3.5 mr-1" />
                                            <SelectValue placeholder="Year Level" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Year Levels</SelectItem>
                                            {yearLevels.map(yl => (
                                                <SelectItem key={yl} value={yl}>{yl}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {filteredSubjects.length === 0 ? (
                                    <div className="text-center py-12 text-muted-foreground">
                                        <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
                                        <p className="font-medium">No available subjects found</p>
                                        <p className="text-sm">
                                            {search || typeFilter !== 'all' || yearFilter !== 'all'
                                                ? 'Try adjusting your filters.'
                                                : 'All subjects for this semester have been completed or enrolled.'}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-6">
                                        {groupedSubjects.map(([yearLevelName, subjects]) => (
                                            <div key={yearLevelName}>
                                                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-3">
                                                    {yearLevelName}
                                                </h3>
                                                <div className="rounded-md border">
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow>
                                                                <TableHead className="w-12.5"></TableHead>
                                                                <TableHead>Code</TableHead>
                                                                <TableHead>Subject</TableHead>
                                                                <TableHead className="text-center">Units</TableHead>
                                                                <TableHead className="text-center">Hrs/Wk</TableHead>
                                                                <TableHead className="text-center">Type</TableHead>
                                                                <TableHead className="text-right">Price</TableHead>
                                                                <TableHead>Prerequisites</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {subjects.map(subject => {
                                                                const isSelected = selectedIds.includes(subject.id);
                                                                const disabled = !subject.prerequisites_met || hasActiveRequest;

                                                                return (
                                                                    <TableRow
                                                                        key={subject.id}
                                                                        className={`${isSelected ? 'bg-primary/5' : ''} ${disabled ? 'opacity-60' : 'cursor-pointer hover:bg-muted/50'}`}
                                                                        onClick={() => !disabled && toggleSubject(subject.id)}
                                                                    >
                                                                        <TableCell>
                                                                            {!subject.prerequisites_met ? (
                                                                                <TooltipProvider>
                                                                                    <Tooltip>
                                                                                        <TooltipTrigger asChild>
                                                                                            <div className="flex items-center justify-center">
                                                                                                <Lock className="h-4 w-4 text-muted-foreground" />
                                                                                            </div>
                                                                                        </TooltipTrigger>
                                                                                        <TooltipContent><p>Prerequisites not met</p></TooltipContent>
                                                                                    </Tooltip>
                                                                                </TooltipProvider>
                                                                            ) : (
                                                                                <Checkbox
                                                                                    checked={isSelected}
                                                                                    disabled={hasActiveRequest}
                                                                                    onCheckedChange={() => !hasActiveRequest && toggleSubject(subject.id)}
                                                                                    onClick={e => e.stopPropagation()}
                                                                                />
                                                                            )}
                                                                        </TableCell>
                                                                        <TableCell className="font-mono font-medium text-sm">{subject.code}</TableCell>
                                                                        <TableCell>
                                                                            <div>
                                                                                <p className="font-medium text-sm">{subject.name}</p>
                                                                                {subject.description && (
                                                                                    <p className="text-xs text-muted-foreground line-clamp-1">{subject.description}</p>
                                                                                )}
                                                                            </div>
                                                                        </TableCell>
                                                                        <TableCell className="text-center font-semibold">{subject.units}</TableCell>
                                                                        <TableCell className="text-center text-muted-foreground">{subject.hours_per_week ?? '—'}</TableCell>
                                                                        <TableCell className="text-center">
                                                                            <Badge variant="secondary" className={typeColors[subject.type] || ''}>
                                                                                {subject.type}
                                                                            </Badge>
                                                                        </TableCell>
                                                                        <TableCell className="text-right font-medium text-sm">
                                                                            {subject.selling_price > 0 ? formatPeso(subject.selling_price) : '—'}
                                                                        </TableCell>
                                                                        <TableCell>
                                                                            {subject.prerequisites.length === 0 ? (
                                                                                <span className="text-xs text-muted-foreground">None</span>
                                                                            ) : (
                                                                                <div className="flex flex-wrap gap-1">
                                                                                    {subject.prerequisites.map(p => (
                                                                                        <TooltipProvider key={p.id}>
                                                                                            <Tooltip>
                                                                                                <TooltipTrigger asChild>
                                                                                                    <Badge
                                                                                                        variant="outline"
                                                                                                        className={`text-xs ${p.completed ? 'border-green-500 text-green-700 dark:text-green-400' : 'border-red-500 text-red-700 dark:text-red-400'}`}
                                                                                                    >
                                                                                                        {p.completed && <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />}
                                                                                                        {!p.completed && <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />}
                                                                                                        {p.code}
                                                                                                    </Badge>
                                                                                                </TooltipTrigger>
                                                                                                <TooltipContent>
                                                                                                    <p>{p.name} — {p.completed ? 'Completed ✓' : 'Not yet completed'}</p>
                                                                                                </TooltipContent>
                                                                                            </Tooltip>
                                                                                        </TooltipProvider>
                                                                                    ))}
                                                                                </div>
                                                                            )}
                                                                        </TableCell>
                                                                    </TableRow>
                                                                );
                                                            })}
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Bottom Enroll Button */}
                                {selectedIds.length > 0 && (
                                    <div className="sticky bottom-4 z-10 flex justify-center">
                                        <Card className="shadow-lg border-primary/20">
                                            <CardContent className="py-3 px-6 flex items-center gap-4">
                                                <div className="text-sm">
                                                    <span className="font-semibold">{selectedIds.length}</span> subject{selectedIds.length > 1 ? 's' : ''} selected
                                                    <span className="text-muted-foreground ml-1">({selectedUnits} units · {formatPeso(selectedTotalPrice)})</span>
                                                </div>
                                                <Button size="sm" variant="ghost" onClick={() => setSelectedIds([])}>Clear</Button>
                                                <Button onClick={handleEnrollSubmit} disabled={submitting || wouldExceedMax || hasActiveRequest}>
                                                    <Plus className="h-4 w-4 mr-1" />
                                                    {submitting ? 'Submitting...' : 'Submit Enrollment Request'}
                                                </Button>
                                            </CardContent>
                                        </Card>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Alert>
                            <Info className="h-4 w-4" />
                            <AlertTitle>Enrollment Guidelines</AlertTitle>
                            <AlertDescription className="text-sm space-y-1">
                                <ul className="list-disc list-inside mt-1 space-y-0.5">
                                    <li>Regular load is <strong>{idealUnits} units</strong> per semester</li>
                                    <li>Minimum <strong>{minUnits} units</strong> (below is underload)</li>
                                    <li>Maximum <strong>{maxUnits} units</strong> per semester</li>
                                    <li>All prerequisite subjects must be completed before enrollment</li>
                                    <li>Your enrollment request must be approved by the registrar and accounting</li>
                                </ul>
                            </AlertDescription>
                        </Alert>
                    </TabsContent>

                    {/* ── Completed Subjects Tab ── */}
                    <TabsContent value="completed" className="mt-4">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-lg">
                                    <CheckSquare className="h-5 w-5 text-green-600" />
                                    Completed Subjects
                                </CardTitle>
                                <CardDescription>
                                    All subjects you have successfully completed.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {completedSubjects.length === 0 ? (
                                    <div className="text-center py-12 text-muted-foreground">
                                        <CheckSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                                        <p className="font-medium">No completed subjects yet</p>
                                        <p className="text-sm">Subjects you pass will appear here.</p>
                                    </div>
                                ) : (
                                    <div className="rounded-md border">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Code</TableHead>
                                                    <TableHead>Subject</TableHead>
                                                    <TableHead className="text-center">Units</TableHead>
                                                    <TableHead className="text-center">Type</TableHead>
                                                    <TableHead>School Year</TableHead>
                                                    <TableHead className="text-center">Semester</TableHead>
                                                    <TableHead className="text-center">Grade</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {completedSubjects.map(cs => (
                                                    <TableRow key={cs.id}>
                                                        <TableCell className="font-mono font-medium">{cs.code}</TableCell>
                                                        <TableCell>{cs.name}</TableCell>
                                                        <TableCell className="text-center">{cs.units}</TableCell>
                                                        <TableCell className="text-center">
                                                            <Badge variant="secondary" className={typeColors[cs.type] || ''}>
                                                                {cs.type}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell>{cs.school_year}</TableCell>
                                                        <TableCell className="text-center">
                                                            {cs.semester ? semesterLabels[cs.semester] ?? cs.semester : '—'}
                                                        </TableCell>
                                                        <TableCell className="text-center font-semibold">
                                                            {cs.grade ?? '—'}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>

            {/* Confirm Enrollment Request Dialog */}
            <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirm Enrollment Request</DialogTitle>
                        <DialogDescription>
                            Submit these subjects for approval — {activeSemesterLabel}, S.Y. {currentSchoolYear}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-2 max-h-[300px] overflow-y-auto">
                        {selectedSubjects.map(s => (
                            <div key={s.id} className="flex items-center justify-between text-sm border rounded-lg px-3 py-2">
                                <div>
                                    <span className="font-mono font-medium">{s.code}</span>
                                    <span className="ml-2">{s.name}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Badge variant="secondary">{s.units} units</Badge>
                                    {s.selling_price > 0 && (
                                        <span className="text-sm font-medium">{formatPeso(s.selling_price)}</span>
                                    )}
                                </div>
                            </div>
                        ))}
                        <Separator />
                        <div className="flex items-center justify-between font-semibold text-sm">
                            <span>Total Units</span>
                            <span>{selectedUnits} units</span>
                        </div>
                        {selectedTotalPrice > 0 && (
                            <div className="flex items-center justify-between font-semibold text-sm">
                                <span>Total Fees</span>
                                <span>{formatPeso(selectedTotalPrice)}</span>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setConfirmDialogOpen(false)}>Cancel</Button>
                        <Button onClick={confirmEnroll} disabled={submitting}>
                            {submitting ? 'Submitting...' : 'Submit Request'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Drop Subject Dialog */}
            <Dialog open={dropDialogOpen} onOpenChange={setDropDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Drop Subject</DialogTitle>
                        <DialogDescription>Are you sure you want to drop this subject?</DialogDescription>
                    </DialogHeader>
                    {subjectToDrop && (
                        <div className="py-2">
                            <div className="rounded-lg border p-3">
                                <p className="font-mono font-medium">{subjectToDrop.code}</p>
                                <p className="text-sm">{subjectToDrop.name}</p>
                                <p className="text-xs text-muted-foreground mt-1">{subjectToDrop.units} units</p>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDropDialogOpen(false)}>Cancel</Button>
                        <Button variant="destructive" onClick={confirmDrop} disabled={dropping}>
                            {dropping ? 'Dropping...' : 'Confirm Drop'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </StudentLayout>
    );
}
