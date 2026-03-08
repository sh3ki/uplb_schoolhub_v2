import { router } from '@inertiajs/react';
import { RefreshCcw } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

interface Department {
    id: number;
    name: string;
    classification: string;
}

interface Program {
    id: number;
    name: string;
    department_id: number;
}

interface YearLevel {
    id: number;
    name: string;
    department_id: number;
}

interface ReEnrollDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    studentId: number;
    studentName: string;
    departments: Department[];
    programs: Program[];
    yearLevels: YearLevel[];
    onSuccess?: () => void;
}

export function ReEnrollDialog({
    open,
    onOpenChange,
    studentId,
    studentName,
    departments,
    programs,
    yearLevels,
    onSuccess,
}: ReEnrollDialogProps) {
    const [classification, setClassification] = useState('');
    const [departmentId, setDepartmentId] = useState('');
    const [yearLevel, setYearLevel] = useState('');
    const [program, setProgram] = useState('__none__');
    const [autoClear, setAutoClear] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    if (!open) return null;

    const handleClose = () => {
        setClassification('');
        setDepartmentId('');
        setYearLevel('');
        setProgram('__none__');
        setAutoClear(false);
        setSubmitting(false);
        onOpenChange(false);
    };

    const handleSubmit = () => {
        if (!yearLevel) {
            toast.error('Please select a Year Level before submitting.');
            return;
        }
        setSubmitting(true);
        router.post(
            `/registrar/students/${studentId}/re-enroll`,
            {
                year_level: yearLevel,
                program: program !== '__none__' ? program : null,
                department_id: departmentId ? Number(departmentId) : null,
                auto_clear: autoClear,
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    toast.success(`${studentName} has been re-enrolled.`);
                    handleClose();
                    onSuccess?.();
                },
                onError: () => {
                    toast.error('Failed to re-enroll student.');
                    setSubmitting(false);
                },
            },
        );
    };

    const uniqueClassifications = [...new Set(departments.map((d) => d.classification))];
    const filteredDepts = departments.filter((d) => !classification || d.classification === classification);
    const filteredPrograms = programs.filter((p) => !departmentId || p.department_id === Number(departmentId));
    const filteredYearLevels = yearLevels.filter((yl) => !departmentId || yl.department_id === Number(departmentId));

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-background rounded-lg border shadow-lg w-full max-w-md p-6 space-y-4">
                <div>
                    <h2 className="text-lg font-semibold">Re-Enroll Student</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        Re-enrolling <strong>{studentName}</strong> for the current school year.
                    </p>
                </div>

                <div className="space-y-3">
                    {/* Classification */}
                    <div>
                        <Label htmlFor="re-enroll-classification">Classification</Label>
                        <Select
                            value={classification}
                            onValueChange={(v) => {
                                setClassification(v);
                                setDepartmentId('');
                            }}
                        >
                            <SelectTrigger id="re-enroll-classification" className="mt-1">
                                <SelectValue placeholder="Select classification..." />
                            </SelectTrigger>
                            <SelectContent>
                                {uniqueClassifications.map((cls) => (
                                    <SelectItem key={cls} value={cls}>
                                        {cls}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Department (shown when classification is selected) */}
                    {classification && (
                        <div>
                            <Label htmlFor="re-enroll-department">Department</Label>
                            <Select value={departmentId} onValueChange={setDepartmentId}>
                                <SelectTrigger id="re-enroll-department" className="mt-1">
                                    <SelectValue placeholder="Select department..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {filteredDepts.map((d) => (
                                        <SelectItem key={d.id} value={String(d.id)}>
                                            {d.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {/* Year Level */}
                    <div>
                        <Label htmlFor="re-enroll-year-level">
                            Year Level <span className="text-destructive">*</span>
                        </Label>
                        <Select value={yearLevel} onValueChange={setYearLevel}>
                            <SelectTrigger id="re-enroll-year-level" className="mt-1">
                                <SelectValue placeholder="Select year level..." />
                            </SelectTrigger>
                            <SelectContent>
                                {(filteredYearLevels.length > 0 ? filteredYearLevels : yearLevels).map((yl) => (
                                    <SelectItem key={yl.id} value={yl.name}>
                                        {yl.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Program (optional) */}
                    <div>
                        <Label htmlFor="re-enroll-program">Program (optional)</Label>
                        <Select value={program} onValueChange={setProgram}>
                            <SelectTrigger id="re-enroll-program" className="mt-1">
                                <SelectValue placeholder="Select program..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="__none__">— No program —</SelectItem>
                                {(filteredPrograms.length > 0 ? filteredPrograms : programs).map((p) => (
                                    <SelectItem key={p.id} value={p.name}>
                                        {p.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Auto-clear */}
                    <div className="flex items-center gap-2 pt-1">
                        <Checkbox
                            id="re-enroll-auto-clear"
                            checked={autoClear}
                            onCheckedChange={(v) => setAutoClear(!!v)}
                        />
                        <Label htmlFor="re-enroll-auto-clear" className="cursor-pointer text-sm">
                            Auto-grant Registrar clearance (skip to pending-accounting)
                        </Label>
                    </div>
                </div>

                <div className="flex gap-2 justify-end pt-2">
                    <Button variant="outline" onClick={handleClose}>
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} disabled={!yearLevel || submitting}>
                        <RefreshCcw className="mr-2 h-4 w-4" />
                        Re-Enroll Student
                    </Button>
                </div>
            </div>
        </div>
    );
}
