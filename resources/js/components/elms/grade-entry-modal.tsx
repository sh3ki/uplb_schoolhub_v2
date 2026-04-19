import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

type GradeItem = {
    title: string;
    score: string;
};

type GradeBreakdown = {
    written_works: GradeItem[];
    performance_tasks: GradeItem[];
    examinations: GradeItem[];
    weights: {
        written_works: number;
        performance_tasks: number;
        examinations: number;
    };
};

interface GradeEntryModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    studentName: string;
    studentNumber?: string | null;
    studentSubjectId: number;
    initialBreakdown?: any;
    processing?: boolean;
    onSubmit: (payload: {
        action: 'save' | 'post';
        student_subject_id: number;
        notes: string;
        breakdown: {
            written_works: Array<{ title: string; score: number | null }>;
            performance_tasks: Array<{ title: string; score: number | null }>;
            examinations: Array<{ title: string; score: number | null }>;
            weights: {
                written_works: number;
                performance_tasks: number;
                examinations: number;
            };
        };
    }) => void;
}

const defaultBreakdown: GradeBreakdown = {
    written_works: [
        { title: 'Quiz 1', score: '' },
        { title: 'Quiz 2', score: '' },
    ],
    performance_tasks: [
        { title: 'Task 1', score: '' },
        { title: 'Task 2', score: '' },
    ],
    examinations: [
        { title: 'Midterm', score: '' },
        { title: 'Final', score: '' },
    ],
    weights: {
        written_works: 30,
        performance_tasks: 50,
        examinations: 20,
    },
};

const toItems = (items: any[] | undefined, fallback: GradeItem[]): GradeItem[] => {
    if (!Array.isArray(items) || items.length === 0) {
        return fallback;
    }

    return items.map((item) => ({
        title: item?.title ?? '',
        score: item?.score !== null && item?.score !== undefined ? String(item.score) : '',
    }));
};

const toAverage = (items: GradeItem[]): number | null => {
    const scores = items
        .map((item) => Number(item.score))
        .filter((score) => !Number.isNaN(score));

    if (scores.length === 0) return null;
    const total = scores.reduce((sum, score) => sum + score, 0);
    return Number((total / scores.length).toFixed(2));
};

export function GradeEntryModal({
    open,
    onOpenChange,
    studentName,
    studentNumber,
    studentSubjectId,
    initialBreakdown,
    processing,
    onSubmit,
}: GradeEntryModalProps) {
    const [breakdown, setBreakdown] = useState<GradeBreakdown>(defaultBreakdown);
    const [notes, setNotes] = useState('');

    useEffect(() => {
        const loaded = initialBreakdown ?? defaultBreakdown;
        setBreakdown({
            written_works: toItems(loaded?.written_works, defaultBreakdown.written_works),
            performance_tasks: toItems(loaded?.performance_tasks, defaultBreakdown.performance_tasks),
            examinations: toItems(loaded?.examinations, defaultBreakdown.examinations),
            weights: {
                written_works: Number(loaded?.weights?.written_works ?? 30),
                performance_tasks: Number(loaded?.weights?.performance_tasks ?? 50),
                examinations: Number(loaded?.weights?.examinations ?? 20),
            },
        });
        setNotes('');
    }, [initialBreakdown, open]);

    const averages = useMemo(() => {
        return {
            writtenWorks: toAverage(breakdown.written_works),
            performanceTasks: toAverage(breakdown.performance_tasks),
            examinations: toAverage(breakdown.examinations),
        };
    }, [breakdown]);

    const finalGrade = useMemo(() => {
        const ww = averages.writtenWorks ?? 0;
        const pt = averages.performanceTasks ?? 0;
        const ex = averages.examinations ?? 0;
        const totalWeight = breakdown.weights.written_works + breakdown.weights.performance_tasks + breakdown.weights.examinations;

        if (totalWeight <= 0) return 0;

        return Number((
            (ww * breakdown.weights.written_works) +
            (pt * breakdown.weights.performance_tasks) +
            (ex * breakdown.weights.examinations)
        ) / totalWeight).toFixed(2);
    }, [averages, breakdown.weights]);

    const updateCategoryItem = (category: keyof Omit<GradeBreakdown, 'weights'>, index: number, key: keyof GradeItem, value: string) => {
        setBreakdown((prev) => {
            const next = [...prev[category]];
            next[index] = { ...next[index], [key]: value };
            return { ...prev, [category]: next };
        });
    };

    const addCategoryItem = (category: keyof Omit<GradeBreakdown, 'weights'>) => {
        setBreakdown((prev) => ({
            ...prev,
            [category]: [...prev[category], { title: '', score: '' }],
        }));
    };

    const removeCategoryItem = (category: keyof Omit<GradeBreakdown, 'weights'>, index: number) => {
        setBreakdown((prev) => {
            if (prev[category].length <= 1) {
                return prev;
            }

            const next = prev[category].filter((_, i) => i !== index);
            return { ...prev, [category]: next };
        });
    };

    const setWeight = (key: keyof GradeBreakdown['weights'], value: string) => {
        const numeric = Number(value);
        setBreakdown((prev) => ({
            ...prev,
            weights: {
                ...prev.weights,
                [key]: Number.isNaN(numeric) ? 0 : numeric,
            },
        }));
    };

    const serialize = () => ({
        written_works: breakdown.written_works.map((item) => ({
            title: item.title,
            score: item.score !== '' ? Number(item.score) : null,
        })),
        performance_tasks: breakdown.performance_tasks.map((item) => ({
            title: item.title,
            score: item.score !== '' ? Number(item.score) : null,
        })),
        examinations: breakdown.examinations.map((item) => ({
            title: item.title,
            score: item.score !== '' ? Number(item.score) : null,
        })),
        weights: breakdown.weights,
    });

    const handleSave = () => {
        onSubmit({
            action: 'save',
            student_subject_id: studentSubjectId,
            notes,
            breakdown: serialize(),
        });
    };

    const handlePost = () => {
        onSubmit({
            action: 'post',
            student_subject_id: studentSubjectId,
            notes,
            breakdown: serialize(),
        });
    };

    const renderCategory = (
        title: string,
        category: keyof Omit<GradeBreakdown, 'weights'>,
        average: number | null,
    ) => (
        <div className="rounded-xl border bg-muted/20 p-3">
            <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold">{title}</p>
                <Button type="button" variant="outline" size="sm" onClick={() => addCategoryItem(category)}>
                    <Plus className="mr-1 h-3.5 w-3.5" /> Add Item
                </Button>
            </div>
            <div className="space-y-2">
                {breakdown[category].map((item, index) => (
                    <div key={`${category}-${index}`} className="flex items-center gap-2">
                        <Input
                            value={item.title}
                            onChange={(e) => updateCategoryItem(category, index, 'title', e.target.value)}
                            placeholder="Title"
                            className="h-8"
                        />
                        <Input
                            type="number"
                            min={0}
                            max={100}
                            value={item.score}
                            onChange={(e) => updateCategoryItem(category, index, 'score', e.target.value)}
                            placeholder="Score"
                            className="h-8 w-24"
                        />
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeCategoryItem(category, index)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                    </div>
                ))}
            </div>
            <div className="mt-2 text-right text-xs text-muted-foreground">
                Average: <span className="font-semibold text-foreground">{average ?? '-'}</span>
            </div>
        </div>
    );

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Grade Entry</DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="rounded-lg border p-3 text-sm">
                        <p className="font-semibold">{studentName}</p>
                        <p className="text-muted-foreground">{studentNumber || 'No student number available'}</p>
                    </div>

                    <div className="grid grid-cols-1 gap-3 rounded-lg border bg-muted/10 p-3 sm:grid-cols-4">
                        <div>
                            <Label className="text-xs">W Weight</Label>
                            <Input
                                type="number"
                                min={0}
                                max={100}
                                value={breakdown.weights.written_works}
                                onChange={(e) => setWeight('written_works', e.target.value)}
                                className="h-8"
                            />
                        </div>
                        <div>
                            <Label className="text-xs">P Weight</Label>
                            <Input
                                type="number"
                                min={0}
                                max={100}
                                value={breakdown.weights.performance_tasks}
                                onChange={(e) => setWeight('performance_tasks', e.target.value)}
                                className="h-8"
                            />
                        </div>
                        <div>
                            <Label className="text-xs">E Weight</Label>
                            <Input
                                type="number"
                                min={0}
                                max={100}
                                value={breakdown.weights.examinations}
                                onChange={(e) => setWeight('examinations', e.target.value)}
                                className="h-8"
                            />
                        </div>
                        <div className="rounded-md bg-primary/10 p-2 text-center">
                            <p className="text-xs text-muted-foreground">Final Grade</p>
                            <p className="text-xl font-bold text-primary">{finalGrade}</p>
                        </div>
                    </div>

                    {renderCategory('Written Works', 'written_works', averages.writtenWorks)}
                    {renderCategory('Performance Tasks', 'performance_tasks', averages.performanceTasks)}
                    {renderCategory('Examinations', 'examinations', averages.examinations)}

                    <div className="grid gap-2">
                        <Label htmlFor="grade_notes">Teacher Notes</Label>
                        <Textarea
                            id="grade_notes"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={3}
                            placeholder="Optional note"
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={handleSave} disabled={processing}>
                        Save Draft
                    </Button>
                    <Button type="button" onClick={handlePost} disabled={processing}>
                        Post to Student Portal
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
