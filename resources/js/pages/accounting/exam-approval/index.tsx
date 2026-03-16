import { Head } from '@inertiajs/react';
import { ChevronDown, Printer, Users } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import AccountingLayout from '@/layouts/accounting-layout';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface FullyPaidStudent {
    id: number;
    full_name: string;
    first_name: string;
    last_name: string;
    lrn: string;
    gender: string;
    classification?: string;
    department?: string;
    program?: string;
    year_level?: string;
    section?: string;
    student_photo_url: string | null;
    total_amount: number;
    total_paid: number;
    balance: number;
    payment_status: string;
        payment_status: 'paid' | 'partial' | 'unpaid' | 'overdue';
    school_year: string;
}

interface Props {
    fullyPaidMale: FullyPaidStudent[];
    fullyPaidFemale: FullyPaidStudent[];
}

export default function ExamApprovalIndex({
    fullyPaidMale,
    fullyPaidFemale,
}: Props) {
    const [fpYearLevel, setFpYearLevel] = useState('all');
    const [fpSection, setFpSection] = useState('all');
    const [fpProgram, setFpProgram] = useState('all');
    const [fpClassification, setFpClassification] = useState('all');
    const [fpDepartment, setFpDepartment] = useState('all');

    const ALL_STATUSES = ['paid', 'partial', 'overdue', 'unpaid'];
    const [fpStatus, setFpStatus] = useState<string[]>(['paid', 'partial', 'overdue', 'unpaid']);
    const toggleStatus = (status: string) =>
        setFpStatus(prev => prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]);

    const formatCurrency = (amount: string | number) => {
        return `₱${parseFloat(amount.toString()).toLocaleString('en-PH', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })}`;
    };

    // Derive unique filter values from all paid students
    const allPaid = [...fullyPaidMale, ...fullyPaidFemale];
    const fpUnique = <T,>(key: keyof FullyPaidStudent) =>
        [...new Set(allPaid.map(s => s[key] as T).filter(Boolean))] as T[];

    const applyFpFilters = (list: FullyPaidStudent[]) => list.filter(s =>
        (fpYearLevel === 'all' || s.year_level === fpYearLevel) &&
        (fpSection === 'all' || s.section === fpSection) &&
        (fpProgram === 'all' || s.program === fpProgram) &&
        (fpClassification === 'all' || s.classification === fpClassification) &&
        (fpDepartment === 'all' || s.department === fpDepartment) &&
        (fpStatus.length === ALL_STATUSES.length || fpStatus.includes(s.payment_status))
    );

    const filteredMale = applyFpFilters(fullyPaidMale);
    const filteredFemale = applyFpFilters(fullyPaidFemale);

    const classificationLabels: Record<string, string> = {
        new: 'New',
        transferee: 'Transferee',
        returnee: 'Returnee',
    };

    return (
        <AccountingLayout>
            <Head title="Exam Approval" />

            <div className="space-y-6 p-6">
                <div className="flex items-start justify-between">
                    <PageHeader
                        title="Exam Approval"
                        description="Students eligible to take exams"
                    />
                    <Button variant="outline" onClick={() => window.print()}>
                        <Printer className="h-4 w-4 mr-2" />
                        Print
                    </Button>
                </div>
            </div>
            {/* Eligible Students (Non-Overdue) — Male / Female Tables */}
            <div className="space-y-4 p-6 pt-0">
                <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-blue-600" />
                    <h2 className="text-lg font-semibold">Eligible Students</h2>
                    <Badge className="bg-blue-100 text-blue-800 border border-blue-200">
                        {fullyPaidMale.length + fullyPaidFemale.length} total
                    </Badge>
                </div>

                {/* Fully paid filters */}
                <div className="flex flex-wrap gap-2">
                    <Select value={fpClassification} onValueChange={setFpClassification}>
                        <SelectTrigger className="w-36"><SelectValue placeholder="Classification" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Types</SelectItem>
                            {fpUnique<string>('classification').map(v => (
                                <SelectItem key={v} value={v}>{classificationLabels[v] ?? v}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select value={fpDepartment} onValueChange={setFpDepartment}>
                        <SelectTrigger className="w-44"><SelectValue placeholder="Department" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Departments</SelectItem>
                            {fpUnique<string>('department').map(v => (
                                <SelectItem key={v} value={v}>{v}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select value={fpProgram} onValueChange={setFpProgram}>
                        <SelectTrigger className="w-40"><SelectValue placeholder="Program" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Programs</SelectItem>
                            {fpUnique<string>('program').map(v => (
                                <SelectItem key={v} value={v}>{v}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select value={fpYearLevel} onValueChange={setFpYearLevel}>
                        <SelectTrigger className="w-36"><SelectValue placeholder="Year Level" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Year Levels</SelectItem>
                            {fpUnique<string>('year_level').map(v => (
                                <SelectItem key={v} value={v}>{v}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select value={fpSection} onValueChange={setFpSection}>
                        <SelectTrigger className="w-36"><SelectValue placeholder="Section" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Sections</SelectItem>
                            {fpUnique<string>('section').map(v => (
                                <SelectItem key={v} value={v}>{v}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="h-9 gap-1">
                                Status
                                {fpStatus.length < ALL_STATUSES.length && (
                                    <Badge className="ml-1 rounded-full px-1 py-0 text-xs bg-primary text-primary-foreground">
                                        {fpStatus.length}
                                    </Badge>
                                )}
                                <ChevronDown className="h-4 w-4 opacity-50" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuLabel>Payment Status</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {ALL_STATUSES.map(status => (
                                <DropdownMenuCheckboxItem
                                    key={status}
                                    checked={fpStatus.includes(status)}
                                    onCheckedChange={() => toggleStatus(status)}
                                >
                                    {status === 'paid' ? 'Fully Paid' : status.charAt(0).toUpperCase() + status.slice(1)}
                                </DropdownMenuCheckboxItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                    {(fpClassification !== 'all' || fpDepartment !== 'all' || fpProgram !== 'all' || fpYearLevel !== 'all' || fpSection !== 'all' || fpStatus.length !== ALL_STATUSES.length) && (
                        <Button variant="ghost" size="sm" onClick={() => { setFpClassification('all'); setFpDepartment('all'); setFpProgram('all'); setFpYearLevel('all'); setFpSection('all'); setFpStatus([...ALL_STATUSES]); }}>
                            Clear filters
                        </Button>
                    )}
                </div>

                <Tabs defaultValue="male">
                    <TabsList>
                        <TabsTrigger value="male">Male ({filteredMale.length})</TabsTrigger>
                        <TabsTrigger value="female">Female ({filteredFemale.length})</TabsTrigger>
                    </TabsList>

                    {(['male', 'female'] as const).map((gender) => {
                        const students = gender === 'male' ? filteredMale : filteredFemale;
                        return (
                            <TabsContent key={gender} value={gender}>
                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-base capitalize">{gender} Students</CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-0">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="w-10">#</TableHead>
                                                    <TableHead>Student</TableHead>
                                                    <TableHead>LRN</TableHead>
                                                    <TableHead>Classification</TableHead>
                                                    <TableHead>Department</TableHead>
                                                    <TableHead>Program</TableHead>
                                                    <TableHead>Year / Section</TableHead>
                                                    <TableHead className="text-right">Total Paid</TableHead>
                                                    <TableHead className="text-right">Balance</TableHead>
                                                    <TableHead>Status</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {students.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={10} className="text-center py-6 text-muted-foreground">
                                                            No eligible {gender} students.
                                                        </TableCell>
                                                    </TableRow>
                                                ) : (
                                                    students.map((student, idx) => (
                                                        <TableRow key={student.id}>
                                                            <TableCell className="text-muted-foreground text-sm">{idx + 1}</TableCell>
                                                            <TableCell>
                                                                <div className="flex items-center gap-2">
                                                                    <Avatar className="h-8 w-8">
                                                                        <AvatarImage src={student.student_photo_url ?? undefined} />
                                                                        <AvatarFallback className="text-xs">{student.first_name?.[0]}{student.last_name?.[0]}</AvatarFallback>
                                                                    </Avatar>
                                                                    <div className="font-medium text-sm">{student.full_name}</div>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="text-sm font-mono text-muted-foreground">{student.lrn}</TableCell>
                                                            <TableCell className="text-sm">
                                                                <Badge variant="outline" className="capitalize text-xs">{classificationLabels[student.classification ?? ''] ?? student.classification ?? '—'}</Badge>
                                                            </TableCell>
                                                            <TableCell className="text-sm">{student.department || '—'}</TableCell>
                                                            <TableCell className="text-sm">{student.program || '—'}</TableCell>
                                                            <TableCell className="text-sm">{[student.year_level, student.section].filter(Boolean).join(' – ') || '—'}</TableCell>
                                                            <TableCell className="text-right text-green-600 font-medium text-sm">{formatCurrency(student.total_paid)}</TableCell>
                                                            <TableCell className={`text-right font-medium text-sm ${student.balance > 0 ? 'text-orange-600' : 'text-green-600'}`}>{student.balance > 0 ? formatCurrency(student.balance) : 'Paid'}</TableCell>
                                                            <TableCell>
                                                                {student.payment_status === 'paid' ? (
                                                                    <Badge className="bg-green-500 text-xs">Fully Paid</Badge>
                                                                ) : student.payment_status === 'partial' ? (
                                                                    <Badge className="bg-yellow-500 text-xs">Partial</Badge>
                                                                ) : student.payment_status === 'overdue' ? (
                                                                    <Badge className="bg-red-500 text-xs">Overdue</Badge>
                                                                ) : (
                                                                    <Badge variant="outline" className="text-xs">Unpaid</Badge>
                                                                )}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))
                                                )}
                                            </TableBody>
                                        </Table>
                                    </CardContent>
                                </Card>
                            </TabsContent>
                        );
                    })}
                </Tabs>
            </div>
        </AccountingLayout>
    );
}
