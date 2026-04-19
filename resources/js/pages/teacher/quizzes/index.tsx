import { Head, Link, router } from '@inertiajs/react';
import {
    FileQuestion,
    Plus,
    Search,
    Eye,
    Edit,
    Trash2,
    MoreHorizontal,
    BookOpen,
    Clock,
    Users,
    CheckCircle,
    XCircle,
    BarChart,
} from 'lucide-react';
import { useState } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import TeacherLayout from '@/layouts/teacher/teacher-layout';
import type { BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Quizzes',
        href: '/teacher/quizzes',
    },
];

interface Subject {
    id: number;
    name: string;
    code: string;
}

interface Quiz {
    id: number;
    title: string;
    description: string | null;
    subject_id: number;
    time_limit_minutes: number | null;
    passing_score: number;
    max_attempts: number;
    is_published: boolean;
    is_active: boolean;
    available_from: string | null;
    available_until: string | null;
    created_at: string;
    subject: Subject;
    questions_count: number;
    attempts_count: number;
}

interface Props {
    quizzes: {
        data: Quiz[];
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
        from: number;
        to: number;
        links: any[];
    };
    subjects: Subject[];
    filters: {
        search?: string;
        subject_id?: string;
        status?: string;
    };
}

export default function QuizzesIndex({ quizzes, subjects, filters }: Props) {
    const [search, setSearch] = useState(filters.search || '');
    const [subjectId, setSubjectId] = useState(filters.subject_id || 'all');
    const [status, setStatus] = useState(filters.status || 'all');
    const [deleteQuiz, setDeleteQuiz] = useState<Quiz | null>(null);
    const [createOpen, setCreateOpen] = useState(false);
    const [createKind, setCreateKind] = useState<'quiz' | 'exam' | 'long_test' | 'activity' | 'assignment'>('quiz');
    const [createSubjectId, setCreateSubjectId] = useState<string>('');
    const [createDepartment, setCreateDepartment] = useState('Basic Education');
    const [createGradeLevel, setCreateGradeLevel] = useState('Grade 7');
    const [createSection, setCreateSection] = useState('');
    const [createTitle, setCreateTitle] = useState('');
    const [createDescription, setCreateDescription] = useState('');
    const [createDeadline, setCreateDeadline] = useState('');
    const [createTimeLimit, setCreateTimeLimit] = useState('60');
    const [createTotalScore, setCreateTotalScore] = useState('5');

    const handleFilter = (newFilters: Partial<typeof filters>) => {
        router.get('/teacher/quizzes', {
            search: newFilters.search ?? search,
            subject_id: newFilters.subject_id ?? subjectId,
            status: newFilters.status ?? status,
        }, {
            preserveState: true,
            replace: true,
        });
    };

    const handleTogglePublish = (quiz: Quiz) => {
        router.post(`/teacher/quizzes/${quiz.id}/toggle-publish`, {}, {
            preserveScroll: true,
        });
    };

    const handleToggleActive = (quiz: Quiz) => {
        router.post(`/teacher/quizzes/${quiz.id}/toggle-active`, {}, {
            preserveScroll: true,
        });
    };

    const handleDelete = () => {
        if (deleteQuiz) {
            router.delete(`/teacher/quizzes/${deleteQuiz.id}`, {
                preserveScroll: true,
                onSuccess: () => setDeleteQuiz(null),
            });
        }
    };

    const formatDate = (dateString: string | null) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    };

    const stats = {
        total: quizzes.total,
        published: quizzes.data.filter(q => q.is_published).length,
        draft: quizzes.data.filter(q => !q.is_published).length,
        totalAttempts: quizzes.data.reduce((acc, q) => acc + q.attempts_count, 0),
    };

    const handleOpenCreator = () => {
        const query = new URLSearchParams();
        query.set('mode', createKind);
        if (createSubjectId) {
            query.set('subject_id', createSubjectId);
        }
        if (createDepartment) {
            query.set('department', createDepartment);
        }
        if (createGradeLevel) {
            query.set('grade_level', createGradeLevel);
        }
        if (createSection) {
            query.set('section', createSection);
        }
        if (createTitle) {
            query.set('title', createTitle);
        }
        if (createDescription) {
            query.set('description', createDescription);
        }
        if (createDeadline) {
            query.set('deadline', createDeadline);
        }
        if (createTimeLimit) {
            query.set('time_limit', createTimeLimit);
        }
        if (createTotalScore) {
            query.set('total_score', createTotalScore);
        }

        router.get(`/teacher/quizzes/create?${query.toString()}`);
    };

    return (
        <TeacherLayout breadcrumbs={breadcrumbs}>
            <Head title="Quizzes" />

            <div className="flex flex-col gap-6 p-6">
                {/* Header */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Quizzes</h1>
                        <p className="text-muted-foreground">
                            Create and manage quizzes for your subjects
                        </p>
                    </div>
                    <Button onClick={() => setCreateOpen(true)}>
                            <Plus className="mr-2 h-4 w-4" />
                            Create Quiz / Exam
                    </Button>
                </div>

                {/* Stats Cards */}
                <div className="grid gap-4 md:grid-cols-4">
                    <Card>
                        <CardContent className="flex items-center gap-4 p-6">
                            <div className="rounded-full bg-blue-100 p-3 dark:bg-blue-900">
                                <FileQuestion className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Total Quizzes</p>
                                <p className="text-2xl font-bold">{stats.total}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="flex items-center gap-4 p-6">
                            <div className="rounded-full bg-green-100 p-3 dark:bg-green-900">
                                <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Published</p>
                                <p className="text-2xl font-bold">{stats.published}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="flex items-center gap-4 p-6">
                            <div className="rounded-full bg-yellow-100 p-3 dark:bg-yellow-900">
                                <Edit className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Draft</p>
                                <p className="text-2xl font-bold">{stats.draft}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="flex items-center gap-4 p-6">
                            <div className="rounded-full bg-purple-100 p-3 dark:bg-purple-900">
                                <Users className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Total Attempts</p>
                                <p className="text-2xl font-bold">{stats.totalAttempts}</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Filters */}
                <Card>
                    <CardContent className="p-4">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    placeholder="Search quizzes..."
                                    value={search}
                                    onChange={(e) => {
                                        setSearch(e.target.value);
                                        handleFilter({ search: e.target.value });
                                    }}
                                    className="pl-9"
                                />
                            </div>
                            <Select
                                value={subjectId}
                                onValueChange={(value) => {
                                    setSubjectId(value);
                                    handleFilter({ subject_id: value });
                                }}
                            >
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="Filter by Subject" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Subjects</SelectItem>
                                    {subjects.map((subject) => (
                                        <SelectItem key={subject.id} value={subject.id.toString()}>
                                            {subject.code} - {subject.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select
                                value={status}
                                onValueChange={(value) => {
                                    setStatus(value);
                                    handleFilter({ status: value });
                                }}
                            >
                                <SelectTrigger className="w-[150px]">
                                    <SelectValue placeholder="Filter by Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Status</SelectItem>
                                    <SelectItem value="published">Published</SelectItem>
                                    <SelectItem value="draft">Draft</SelectItem>
                                    <SelectItem value="active">Active</SelectItem>
                                    <SelectItem value="inactive">Inactive</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </CardContent>
                </Card>

                {/* Quizzes Table */}
                <Card>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Quiz</TableHead>
                                    <TableHead>Subject</TableHead>
                                    <TableHead>Questions</TableHead>
                                    <TableHead>Time Limit</TableHead>
                                    <TableHead>Attempts</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {quizzes.data.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-8">
                                            <div className="flex flex-col items-center gap-2">
                                                <FileQuestion className="h-8 w-8 text-muted-foreground" />
                                                <p className="text-muted-foreground">No quizzes found</p>
                                                <Button size="sm" onClick={() => setCreateOpen(true)}>
                                                        <Plus className="mr-2 h-4 w-4" />
                                                        Create your first quiz/exam
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    quizzes.data.map((quiz) => (
                                        <TableRow key={quiz.id}>
                                            <TableCell>
                                                <div>
                                                    <p className="font-medium">{quiz.title}</p>
                                                    {quiz.description && (
                                                        <p className="text-sm text-muted-foreground line-clamp-1">
                                                            {quiz.description}
                                                        </p>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline">
                                                    <BookOpen className="mr-1 h-3 w-3" />
                                                    {quiz.subject.code}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>{quiz.questions_count}</TableCell>
                                            <TableCell>
                                                {quiz.time_limit_minutes ? (
                                                    <span className="flex items-center gap-1">
                                                        <Clock className="h-3 w-3" />
                                                        {quiz.time_limit_minutes} min
                                                    </span>
                                                ) : (
                                                    'Unlimited'
                                                )}
                                            </TableCell>
                                            <TableCell>{quiz.attempts_count}</TableCell>
                                            <TableCell>
                                                <div className="flex flex-col gap-1">
                                                    <Badge variant={quiz.is_published ? 'default' : 'secondary'}>
                                                        {quiz.is_published ? 'Published' : 'Draft'}
                                                    </Badge>
                                                    {!quiz.is_active && (
                                                        <Badge variant="destructive">Inactive</Badge>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem asChild>
                                                            <Link href={`/teacher/quizzes/${quiz.id}`}>
                                                                <Eye className="mr-2 h-4 w-4" />
                                                                View
                                                            </Link>
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem asChild>
                                                            <Link href={`/teacher/quizzes/${quiz.id}/edit`}>
                                                                <Edit className="mr-2 h-4 w-4" />
                                                                Edit
                                                            </Link>
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem asChild>
                                                            <Link href={`/teacher/quizzes/${quiz.id}/results`}>
                                                                <BarChart className="mr-2 h-4 w-4" />
                                                                Results
                                                            </Link>
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem onClick={() => handleTogglePublish(quiz)}>
                                                            {quiz.is_published ? (
                                                                <>
                                                                    <XCircle className="mr-2 h-4 w-4" />
                                                                    Unpublish
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <CheckCircle className="mr-2 h-4 w-4" />
                                                                    Publish
                                                                </>
                                                            )}
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => handleToggleActive(quiz)}>
                                                            {quiz.is_active ? (
                                                                <>
                                                                    <XCircle className="mr-2 h-4 w-4" />
                                                                    Deactivate
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <CheckCircle className="mr-2 h-4 w-4" />
                                                                    Activate
                                                                </>
                                                            )}
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem
                                                            className="text-destructive"
                                                            onClick={() => setDeleteQuiz(quiz)}
                                                        >
                                                            <Trash2 className="mr-2 h-4 w-4" />
                                                            Delete
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* Pagination */}
                {quizzes.last_page > 1 && (
                    <div className="flex justify-center">
                        <Pagination data={quizzes} />
                    </div>
                )}
            </div>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={!!deleteQuiz} onOpenChange={() => setDeleteQuiz(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Quiz</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete "{deleteQuiz?.title}"? This action cannot be
                            undone and will remove all questions and student attempts.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Create Quizzes & Exams</DialogTitle>
                        <DialogDescription>
                            Configure the assessment details before opening the full question builder.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <p className="text-sm font-medium">Assessment Type</p>
                            <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                                {[
                                    { key: 'quiz', label: 'Quiz' },
                                    { key: 'exam', label: 'Exam' },
                                    { key: 'long_test', label: 'Long Test' },
                                    { key: 'activity', label: 'Activity' },
                                    { key: 'assignment', label: 'Assignment' },
                                ].map((item) => (
                                    <Button
                                        key={item.key}
                                        type="button"
                                        variant={createKind === item.key ? 'default' : 'outline'}
                                        onClick={() => setCreateKind(item.key as 'quiz' | 'exam' | 'long_test' | 'activity' | 'assignment')}
                                        className="h-9"
                                    >
                                        {item.label}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            <div className="space-y-2">
                                <p className="text-sm font-medium">Department</p>
                                <Input value={createDepartment} onChange={(e) => setCreateDepartment(e.target.value)} placeholder="Department" />
                            </div>
                            <div className="space-y-2">
                                <p className="text-sm font-medium">Grade Level</p>
                                <Select value={createGradeLevel} onValueChange={setCreateGradeLevel}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select grade" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'].map((grade) => (
                                            <SelectItem key={grade} value={grade}>{grade}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <p className="text-sm font-medium">Section</p>
                                <Input value={createSection} onChange={(e) => setCreateSection(e.target.value)} placeholder="e.g. St. Philomena" />
                            </div>
                            <div className="space-y-2">
                                <p className="text-sm font-medium">Subject</p>
                                <Select value={createSubjectId} onValueChange={setCreateSubjectId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Choose subject" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {subjects.map((subject) => (
                                            <SelectItem key={subject.id} value={subject.id.toString()}>
                                                {subject.code} - {subject.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <p className="text-sm font-medium">Title</p>
                            <Input value={createTitle} onChange={(e) => setCreateTitle(e.target.value)} placeholder="e.g. Quarter 1 Algebra Quiz" />
                        </div>

                        <div className="space-y-2">
                            <p className="text-sm font-medium">Description / Instructions</p>
                            <Input value={createDescription} onChange={(e) => setCreateDescription(e.target.value)} placeholder="Provide instructions for students..." />
                        </div>

                        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                            <div className="space-y-2">
                                <p className="text-sm font-medium">Deadline</p>
                                <Input type="date" value={createDeadline} onChange={(e) => setCreateDeadline(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <p className="text-sm font-medium">Time Limit (minutes)</p>
                                <Input type="number" min={1} value={createTimeLimit} onChange={(e) => setCreateTimeLimit(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <p className="text-sm font-medium">Total Score</p>
                                <Input type="number" min={1} value={createTotalScore} onChange={(e) => setCreateTotalScore(e.target.value)} />
                            </div>
                        </div>

                        <div className="rounded-md border p-3 text-xs text-muted-foreground">
                            Question setup will continue in the full quiz builder page after you click Continue.
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                        <Button onClick={handleOpenCreator}>Continue</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </TeacherLayout>
    );
}
