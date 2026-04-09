import { Head, router, usePage } from '@inertiajs/react';
import { useForm } from '@inertiajs/react';
import { Link } from '@inertiajs/react';
import { 
    ArrowLeft, 
    Calendar, 
    FileText, 
    Receipt, 
    Plus,
    Check,
    X,
    Clock,
    AlertTriangle,
    GraduationCap,
    User,
    RefreshCw,
    CreditCard,
    Printer,
    Scale,
    History,
    CheckCircle2,
    ShieldCheck,
    ShieldX,
    Pencil,
    Trash2,
} from 'lucide-react';
import { PhilippinePeso } from '@/components/icons/philippine-peso';
import { useState, useMemo, useEffect } from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/page-header';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Pagination } from '@/components/ui/pagination';
import { Textarea } from '@/components/ui/textarea';
import SuperAccountingLayout from '@/layouts/super-accounting/super-accounting-layout';

interface Student {
    id: number;
    full_name: string;
    lrn: string;
    email: string;
    program: string | null;
    year_level: string | null;
    section: string | null;
    student_photo_url: string | null;
    enrollment_status: string;
    department: string | null;
    classification: string | null;
}

interface FeeItemDetail {
    id: number;
    name: string;
    amount: number;
}

interface FeeCategory {
    category_id: number;
    category_name: string;
    items: FeeItemDetail[];
}

interface Fee {
    id: number;
    school_year: string;
    total_amount: number;
    grant_discount: number;
    total_paid: number;
    balance: number;
    status: 'unpaid' | 'partial' | 'paid' | 'overdue';
    is_overdue: boolean;
    due_date: string | null;
    categories: FeeCategory[];
    processed_by?: string | null;
    processed_at?: string | null;
    reason?: string | null;
    notes?: string | null;
    carried_forward_balance: number;
    carried_forward_from: string | null;
}

interface Payment {
    id: number;
    payment_date: string;
    or_number: string;
    amount: number;
    payment_for: string;
    payment_mode: string | null;
    notes: string | null;
    recorded_by: string;
    school_year: string | null;
    created_at: string;
    type?: 'on-site' | 'online';
    transaction_type?: 'fee' | 'document' | 'refund';
}

interface PromissoryNote {
    id: number;
    student_fee_id: number;
    submitted_date: string;
    due_date: string;
    amount: number | null;
    reason: string;
    status: 'pending' | 'approved' | 'declined' | 'fulfilled';
    school_year: string;
    reviewed_by: string | null;
    reviewed_at: string | null;
    review_notes: string | null;
}

interface Grant {
    id: number;
    name: string;
    discount_amount: number;
    school_year: string;
    status: string;
}

interface Summary {
    total_fees: number;
    total_discount: number;
    total_paid: number;
    total_balance: number;
    previous_balance: number;
    current_fees_balance: number;
}

interface Cashier {
    id: number;
    name: string;
}

interface BalanceAdjustment {
    id: number;
    amount: number;
    reason: string;
    school_year: string | null;
    notes: string | null;
    adjusted_by: string;
    created_at: string;
}

interface FeeEditRow {
    id: string;
    school_year: string;
    total_amount: number;
    grant_discount: number;
    total_paid: number;
    balance: number;
    status: 'unpaid' | 'partial' | 'paid' | 'overdue';
    processed_by: string;
    processed_at: string;
    reason?: string;
    notes?: string;
    is_history: boolean;
}

interface EnrollmentClearance {
    id: number;
    accounting_clearance: boolean;
    accounting_cleared_at: string | null;
    accounting_notes: string | null;
}

interface Props {
    student: Student;
    fees: Fee[];
    payments: Payment[];
    promissoryNotes: PromissoryNote[];
    grants: Grant[];
    summary: Summary;
    currentSchoolYear?: string;
    cashiers?: Cashier[];
    balanceAdjustments: BalanceAdjustment[];
    paymentFeeOptions?: Array<{
        id: number;
        school_year: string;
        total_amount: number;
        balance: number;
    }>;
    feeEditRows: FeeEditRow[];
    enrollmentClearance?: EnrollmentClearance | null;
    currentUser: {
        id: number;
        name: string;
    };
}

function formatCurrency(amount: number | null): string {
    if (amount === null || amount === undefined) {
        return 'N/A';
    }
    return `₱${amount.toLocaleString('en-PH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-PH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
}

function formatDateTime(dateString: string): string {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) {
        return dateString;
    }

    return date.toLocaleString('en-PH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    });
}

function formatTime(timeString: string): string {
    const parsed = new Date(`1970-01-01T${timeString}`);
    if (!Number.isNaN(parsed.getTime())) {
        return parsed.toLocaleTimeString('en-PH', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
        });
    }

    return timeString;
}

function renderPesoAmount(amount: number | null, className = '') {
    const safeAmount = amount ?? 0;

    return (
        <span className={`inline-flex items-center gap-1 ${className}`.trim()}>
            <PhilippinePeso className="h-3.5 w-3.5" />
            {safeAmount.toLocaleString('en-PH', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            })}
        </span>
    );
}

export default function PaymentProcess({ student, fees, payments, promissoryNotes, grants, summary, cashiers = [], balanceAdjustments, paymentFeeOptions = [], feeEditRows = [], enrollmentClearance = null, currentUser }: Props) {
    const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
    const [isPromissoryDialogOpen, setIsPromissoryDialogOpen] = useState(false);
    const [isAddBalanceDialogOpen, setIsAddBalanceDialogOpen] = useState(false);
    const [clearanceDialog, setClearanceDialog] = useState(false);
    const [clearanceLoading, setClearanceLoading] = useState(false);
    const [selectedSchoolYear, setSelectedSchoolYear] = useState<string>('all');
    const [schoolYearPage, setSchoolYearPage] = useState(1);

    const [amountReceived, setAmountReceived] = useState<string>('');
    const fallbackPaymentOptions = fees.map((fee) => ({
        id: fee.id,
        school_year: fee.school_year,
        total_amount: fee.total_amount,
        balance: fee.balance,
    }));

    const normalizedPaymentOptions = (paymentFeeOptions.length > 0 ? paymentFeeOptions : fallbackPaymentOptions)
        .slice()
        .sort((a, b) => b.school_year.localeCompare(a.school_year));

    const defaultSelectedFeeId = normalizedPaymentOptions.length > 0
        ? 'all'
        : '';

    const [selectedFeeId, setSelectedFeeId] = useState<string>(
        defaultSelectedFeeId
    );

    const isAllSelection = selectedFeeId === 'all';

    const selectedFee = useMemo(
        () => isAllSelection ? undefined : normalizedPaymentOptions.find((fee) => fee.id.toString() === selectedFeeId),
        [normalizedPaymentOptions, selectedFeeId, isAllSelection]
    );

    const selectedDetailedFee = useMemo(
        () => isAllSelection ? undefined : fees.find((fee) => fee.id.toString() === selectedFeeId),
        [fees, selectedFeeId, isAllSelection]
    );

    const allOptionBalance = useMemo(
        () => normalizedPaymentOptions.reduce((total, fee) => total + fee.balance, 0),
        [normalizedPaymentOptions]
    );

    const activeSummary = useMemo(() => {
        if (isAllSelection) {
            const totalFees = normalizedPaymentOptions.reduce((total, fee) => total + fee.total_amount, 0);
            const totalDiscount = fees.reduce((total, fee) => total + (fee.grant_discount || 0), 0);
            const totalPaid = fees.reduce((total, fee) => total + (fee.total_paid || 0), 0);
            const totalBalance = normalizedPaymentOptions.reduce((total, fee) => total + fee.balance, 0);
            const latestSchoolYear = fees
                .map((fee) => fee.school_year?.trim() || '')
                .filter(Boolean)
                .sort((a, b) => b.localeCompare(a))[0] || '';
            const allPreviousBalance = fees
                .filter((fee) => (fee.school_year?.trim() || '') < latestSchoolYear)
                .reduce((total, fee) => total + fee.balance, 0);

            return {
                total_fees: totalFees,
                total_discount: totalDiscount,
                total_paid: totalPaid,
                total_balance: totalBalance,
                previous_balance: allPreviousBalance,
                current_fees_balance: totalBalance,
            };
        }

        if (!selectedFee && !selectedDetailedFee) {
            return {
                total_fees: summary.total_fees,
                total_discount: summary.total_discount,
                total_paid: summary.total_paid,
                total_balance: summary.total_balance,
                previous_balance: summary.previous_balance || 0,
                current_fees_balance: summary.current_fees_balance || summary.total_balance,
            };
        }

        const selectedSchoolYear = (
            selectedDetailedFee?.school_year
            ?? selectedFee?.school_year
            ?? ''
        ).trim();

        const previousBalance = fees
            .filter((fee) => fee.school_year.trim() < selectedSchoolYear)
            .reduce((total, fee) => total + fee.balance, 0);

        const totalFees = selectedDetailedFee?.total_amount ?? selectedFee?.total_amount ?? 0;
        const totalDiscount = selectedDetailedFee?.grant_discount ?? 0;
        const totalPaid = selectedDetailedFee?.total_paid ?? 0;
        const totalBalance = selectedDetailedFee?.balance ?? selectedFee?.balance ?? 0;

        return {
            total_fees: totalFees,
            total_discount: totalDiscount,
            total_paid: totalPaid,
            total_balance: totalBalance,
            previous_balance: previousBalance,
            current_fees_balance: totalBalance,
        };
    }, [isAllSelection, selectedFee, selectedDetailedFee, fees, summary, normalizedPaymentOptions]);

    useEffect(() => {
        if (!normalizedPaymentOptions.length) {
            if (selectedFeeId !== '') {
                setSelectedFeeId('');
            }
            return;
        }

        const selectedExists = selectedFeeId === 'all' || normalizedPaymentOptions.some((fee) => fee.id.toString() === selectedFeeId);
        if (!selectedExists) {
            setSelectedFeeId(defaultSelectedFeeId);
        }
    }, [normalizedPaymentOptions, selectedFeeId, defaultSelectedFeeId]);

    // Payment allocation calculation
    const paymentAllocation = useMemo(() => {
        const amount = parseFloat(amountReceived) || 0;
        const previousBalance = activeSummary.previous_balance || 0;
        const currentFeesBalance = activeSummary.current_fees_balance || activeSummary.total_balance;
        
        let previousBalancePaid = 0;
        let currentFeesPaid = 0;
        let remainingAmount = amount;
        
        // First, pay off previous balance
        if (previousBalance > 0 && remainingAmount > 0) {
            previousBalancePaid = Math.min(previousBalance, remainingAmount);
            remainingAmount -= previousBalancePaid;
        }
        
        // Then, pay current fees
        if (currentFeesBalance > 0 && remainingAmount > 0) {
            currentFeesPaid = Math.min(currentFeesBalance, remainingAmount);
            remainingAmount -= currentFeesPaid;
        }
        
        return {
            previousBalancePaid,
            currentFeesPaid,
            remainingPreviousBalance: Math.max(0, previousBalance - previousBalancePaid),
            remainingCurrentFeesBalance: Math.max(0, currentFeesBalance - currentFeesPaid),
            change: Math.max(0, remainingAmount),
        };
    }, [amountReceived, activeSummary]);

    const feesWithBalance = useMemo(() => fees.filter((fee) => fee.balance > 0), [fees]);

    const paymentForm = useForm({
        student_id: student.id.toString(),
        student_fee_id: '',
        payment_date: new Date().toISOString().split('T')[0],
        or_number: '',
        amount: '',
        payment_mode: 'CASH',
        reference_number: '',
        bank_name: '',
        payment_for: 'tuition',
        notes: '',
        print_receipt: true,
    });

    const promissoryForm = useForm({
        student_id: student.id,
        student_fee_id: '',
        amount: '',
        due_date: '',
        reason: '',
    });

    const balanceForm = useForm({
        student_fee_id: feesWithBalance.length > 0 ? feesWithBalance[0].id.toString() : (fees.length > 0 ? fees[0].id.toString() : ''),
        amount: '',
        reason: '',
        notes: '',
    });

    const [isAddSchoolYearDialogOpen, setIsAddSchoolYearDialogOpen] = useState(false);

    const addSchoolYearForm = useForm({
        school_year: '',
        total_amount: '',
        reason: '',
    });

    const handleAddSchoolYearSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        addSchoolYearForm.post(`/super-accounting/payments/process/${student.id}/add-school-year`, {
            onSuccess: () => {
                setIsAddSchoolYearDialogOpen(false);
                addSchoolYearForm.reset();
                toast.success('School year fee record created.');
            },
            onError: () => toast.error('Failed to create fee record.'),
        });
    };

    const [isEditFeeDialogOpen, setIsEditFeeDialogOpen] = useState(false);
    const [editingFee, setEditingFee] = useState<Fee | null>(null);

    const editFeeForm = useForm({
        school_year: '',
        total_amount: '',
        grant_discount: '',
        total_paid: '',
        balance: '',
        status: 'unpaid',
        reason: '',
    });

    const openEditFeeDialog = (fee: Fee) => {
        setEditingFee(fee);
        editFeeForm.setData({
            school_year: fee.school_year,
            total_amount: fee.total_amount.toString(),
            grant_discount: fee.grant_discount.toString(),
            total_paid: fee.total_paid.toString(),
            balance: fee.balance.toString(),
            status: fee.status,
            reason: fee.reason || '',
        });
        setIsEditFeeDialogOpen(true);
    };

    const handleEditFeeSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingFee) return;
        editFeeForm.patch(`/super-accounting/payments/process/${student.id}/fees/${editingFee.id}`, {
            onSuccess: () => {
                setIsEditFeeDialogOpen(false);
                setEditingFee(null);
                editFeeForm.reset();
                toast.success('Fee record updated.');
            },
            onError: () => toast.error('Failed to update fee record.'),
        });
    };

    const handleAddBalanceSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        balanceForm.post(`/super-accounting/payments/process/${student.id}/add-balance`, {
            onSuccess: () => {
                setIsAddBalanceDialogOpen(false);
                balanceForm.reset();
                toast.success('Balance added successfully');
            },
            onError: () => {
                toast.error('Failed to add balance');
            },
        });
    };

    const handlePaymentSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        paymentForm.post('/super-accounting/payments', {
            onSuccess: () => {
                setIsPaymentDialogOpen(false);
                paymentForm.reset();
            },
        });
    };

    const handleMakePayment = (e: React.FormEvent) => {
        e.preventDefault();
        const amount = parseFloat(amountReceived) || 0;
        if (amount <= 0) return;
        if (!selectedFeeId) return;
        if (selectedFeeId === 'all') {
            toast.error('Select a specific school year before posting payment.');
            return;
        }
        
        router.post('/super-accounting/payments', {
            student_id: student.id.toString(),
            student_fee_id: selectedFeeId,
            payment_date: paymentForm.data.payment_date,
            or_number: paymentForm.data.or_number,
            amount: amountReceived,
            payment_mode: 'CASH',
            payment_for: 'tuition',
            notes: paymentForm.data.notes,
            print_receipt: false,
        }, {
            onSuccess: () => {
                setAmountReceived('');
                paymentForm.reset();
                toast.success('Payment recorded successfully');
            },
        });
    };

    const handlePrintCurrentTransaction = () => {
        const amount = parseFloat(amountReceived) || 0;

        if (selectedFeeId === 'all') {
            toast.error('Select a specific school year before printing.');
            return;
        }

        if (amount <= 0 || !selectedFee) {
            toast.error('Enter a valid payment amount and select a fee before printing.');
            return;
        }

        const paymentDate = paymentForm.data.payment_date || new Date().toISOString().split('T')[0];
        const orNumber = paymentForm.data.or_number?.trim() || 'Pending OR Number';
        const receiptWindow = window.open('', '_blank', 'width=760,height=920');

        if (!receiptWindow) {
            toast.error('Unable to open print window. Please allow pop-ups and try again.');
            return;
        }

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Payment Receipt</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 24px; color: #111827; }
                    .receipt { border: 1px solid #d1d5db; border-radius: 10px; padding: 20px; max-width: 680px; margin: 0 auto; }
                    .header { display: flex; justify-content: space-between; align-items: start; margin-bottom: 16px; }
                    .title { font-size: 20px; font-weight: 700; margin: 0; }
                    .subtitle { color: #4b5563; margin-top: 4px; font-size: 12px; }
                    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 20px; margin-top: 12px; }
                    .label { color: #6b7280; font-size: 12px; margin-bottom: 2px; }
                    .value { font-size: 14px; font-weight: 600; }
                    .amount { margin-top: 18px; padding: 12px; border-radius: 8px; background: #eff6ff; }
                    .amount .value { font-size: 22px; color: #1d4ed8; }
                    .notes { margin-top: 12px; padding-top: 10px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #374151; }
                    .footer { margin-top: 18px; font-size: 11px; color: #6b7280; text-align: center; }
                </style>
            </head>
            <body>
                <div class="receipt">
                    <div class="header">
                        <div>
                            <p class="title">Payment Transaction Receipt</p>
                            <p class="subtitle">Generated from Payment Processing</p>
                        </div>
                        <div style="text-align:right;">
                            <div class="label">OR Number</div>
                            <div class="value">${orNumber}</div>
                        </div>
                    </div>
                    <div class="grid">
                        <div><div class="label">Student</div><div class="value">${student.full_name}</div></div>
                        <div><div class="label">Student No.</div><div class="value">${student.lrn}</div></div>
                        <div><div class="label">School Year</div><div class="value">${selectedFee.school_year}</div></div>
                        <div><div class="label">Payment Date</div><div class="value">${paymentDate}</div></div>
                        <div><div class="label">Cashier</div><div class="value">${currentUser.name}</div></div>
                        <div><div class="label">Payment For</div><div class="value">Tuition</div></div>
                    </div>
                    <div class="amount">
                        <div class="label">Current Transaction Amount</div>
                        <div class="value">${formatCurrency(amount)}</div>
                    </div>
                    <div class="notes">${paymentForm.data.notes?.trim() ? `Notes: ${paymentForm.data.notes.trim()}` : 'No additional notes.'}</div>
                    <div class="footer">This printout includes only the current transaction details.</div>
                </div>
                <script>window.onload = function() { window.print(); };</script>
            </body>
            </html>
        `;

        receiptWindow.document.open();
        receiptWindow.document.write(html);
        receiptWindow.document.close();
    };

    const handlePromissorySubmit = (e: React.FormEvent) => {
        e.preventDefault();
        promissoryForm.post('/super-accounting/promissory-notes', {
            onSuccess: () => {
                setIsPromissoryDialogOpen(false);
                promissoryForm.reset();
            },
        });
    };

    const handleRefresh = () => {
        router.reload({ only: ['promissoryNotes'] });
    };

    const handleClearanceToggle = () => {
        const newStatus = !enrollmentClearance?.accounting_clearance;
        setClearanceLoading(true);
        router.put(`/super-accounting/clearance/${student.id}`, {
            status: newStatus,
        }, {
            onSuccess: () => {
                setClearanceDialog(false);
                setClearanceLoading(false);
                toast.success(newStatus
                    ? (student.enrollment_status === 'dropped' ? 'Drop clearance set for accounting.' : 'Student cleared for accounting.')
                    : 'Clearance removed.');
            },
            onError: () => {
                setClearanceLoading(false);
                toast.error('Failed to update clearance.');
            },
        });
    };

    const handleApprovePromissory = (noteId: number) => {
        router.post(`/super-accounting/promissory-notes/${noteId}/approve`);
    };

    const handleDeclinePromissory = (noteId: number) => {
        router.post(`/super-accounting/promissory-notes/${noteId}/decline`);
    };

    const getStatusBadge = (status: string) => {
        const configs: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; color: string }> = {
            paid: { label: 'Fully Paid', variant: 'default', color: 'bg-green-100 text-green-700' },
            unpaid: { label: 'Unpaid', variant: 'secondary', color: 'bg-yellow-100 text-yellow-700' },
            partial: { label: 'Partial', variant: 'outline', color: 'bg-blue-100 text-blue-700' },
            overdue: { label: 'Overdue', variant: 'destructive', color: 'bg-red-100 text-red-700' },
            approved: { label: 'Approved', variant: 'default', color: 'bg-green-100 text-green-700' },
            declined: { label: 'Declined', variant: 'destructive', color: 'bg-red-100 text-red-700' },
            fulfilled: { label: 'Fulfilled', variant: 'default', color: 'bg-blue-100 text-blue-700' },
            active: { label: 'Active', variant: 'default', color: 'bg-green-100 text-green-700' },
            inactive: { label: 'Inactive', variant: 'secondary', color: 'bg-gray-100 text-gray-700' },
            graduated: { label: 'Graduated', variant: 'default', color: 'bg-blue-100 text-blue-700' },
            withdrawn: { label: 'Withdrawn', variant: 'destructive', color: 'bg-red-100 text-red-700' },
        };
        const config = configs[status] || configs.unpaid;
        return <Badge className={config.color}>{config.label}</Badge>;
    };

    const filteredFees = selectedSchoolYear === 'all' 
        ? fees 
        : fees.filter(f => f.school_year === selectedSchoolYear);

    const schoolYearRows = useMemo(() => {
        const feeRows = filteredFees.map((fee) => ({
            id: `fee-${fee.id}`,
            school_year: fee.school_year,
            total_amount: fee.total_amount,
            grant_discount: fee.grant_discount,
            total_paid: fee.total_paid,
            balance: fee.balance,
            status: fee.status,
            processed_by: fee.processed_by || '-',
            processed_at: fee.processed_at || '',
            reason: fee.reason || '',
            notes: fee.notes || '',
            is_history: false,
        }));

        const coveredYears = new Set(
            feeRows.map((row) => row.school_year.trim()).filter(Boolean)
        );

        // Fallback rows ensure every existing student-fee year remains editable,
        // even if the dynamic fee resolver does not emit a canonical row.
        const fallbackRows = normalizedPaymentOptions
            .filter((fee) => selectedSchoolYear === 'all' || fee.school_year === selectedSchoolYear)
            .filter((fee) => !coveredYears.has(fee.school_year.trim()))
            .map((fee) => {
                const paidForYear = payments
                    .filter((payment) => payment.school_year === fee.school_year)
                    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

                const normalizedPaid = Math.max(0, paidForYear);
                const derivedStatus: FeeEditRow['status'] = fee.balance <= 0
                    ? 'paid'
                    : (normalizedPaid > 0 ? 'partial' : 'unpaid');

                return {
                    id: `fee-option-${fee.id}`,
                    school_year: fee.school_year,
                    total_amount: fee.total_amount,
                    grant_discount: 0,
                    total_paid: normalizedPaid,
                    balance: fee.balance,
                    status: derivedStatus,
                    processed_by: '-',
                    processed_at: '',
                    reason: '',
                    notes: '',
                    is_history: false,
                };
            });

        return [...feeRows, ...fallbackRows].sort((a, b) => {
            const yearCompare = b.school_year.localeCompare(a.school_year);
            if (yearCompare !== 0) return yearCompare;
            const aTime = new Date(a.processed_at || 0).getTime();
            const bTime = new Date(b.processed_at || 0).getTime();
            return bTime - aTime;
        });
    }, [filteredFees, normalizedPaymentOptions, payments, selectedSchoolYear]);

    const schoolYearPerPage = 15;
    const schoolYearLastPage = Math.max(1, Math.ceil(schoolYearRows.length / schoolYearPerPage));
    const safeSchoolYearPage = Math.min(schoolYearPage, schoolYearLastPage);
    const schoolYearStart = (safeSchoolYearPage - 1) * schoolYearPerPage;
    const pagedSchoolYearRows = schoolYearRows.slice(schoolYearStart, schoolYearStart + schoolYearPerPage);

    const schoolYearPaginationData = {
        current_page: safeSchoolYearPage,
        last_page: schoolYearLastPage,
        per_page: schoolYearPerPage,
        total: schoolYearRows.length,
        from: schoolYearRows.length === 0 ? 0 : schoolYearStart + 1,
        to: Math.min(schoolYearStart + schoolYearPerPage, schoolYearRows.length),
        links: Array.from({ length: schoolYearLastPage }, (_, index) => {
            const page = index + 1;
            return {
                url: `#school-year-page-${page}`,
                label: page.toString(),
                active: page === safeSchoolYearPage,
            };
        }),
    };

    const schoolYears = [...new Set(fees.map(f => f.school_year))];

    const syFilteredPayments = selectedSchoolYear === 'all'
        ? payments
        : payments.filter(p => p.school_year === selectedSchoolYear);

    const syFilteredAdjustments = selectedSchoolYear === 'all'
        ? balanceAdjustments
        : balanceAdjustments.filter(a => a.school_year === selectedSchoolYear);

    const syFilteredGrants = selectedSchoolYear === 'all'
        ? grants
        : grants.filter(g => g.school_year === selectedSchoolYear);

    const syFilteredPromissoryNotes = selectedSchoolYear === 'all'
        ? promissoryNotes
        : promissoryNotes.filter(n => n.school_year === selectedSchoolYear);

    return (
        <SuperAccountingLayout>
            <Head title={`Payment Processing - ${student.full_name}`} />

            <div className="space-y-6 p-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/super-accounting/student-accounts">
                            <Button variant="outline" size="sm">
                                <ArrowLeft className="h-4 w-4 mr-2" />
                                Back
                            </Button>
                        </Link>
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight">Payment Processing</h1>
                            <p className="text-muted-foreground">
                                Process payments and manage account for {student.full_name}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Dialog open={isAddSchoolYearDialogOpen} onOpenChange={setIsAddSchoolYearDialogOpen}>
                            <DialogTrigger asChild>
                                <Button variant="outline" className="border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100">
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add School Year
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[460px]">
                                <form onSubmit={handleAddSchoolYearSubmit}>
                                    <DialogHeader>
                                        <DialogTitle>Add School Year Fee Record</DialogTitle>
                                        <DialogDescription>
                                            Manually create a fee record for a specific school year for {student.full_name}.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="grid gap-4 py-4">
                                        <div className="grid gap-2">
                                            <Label>School Year *</Label>
                                            <Input
                                                value={addSchoolYearForm.data.school_year}
                                                onChange={(e) => addSchoolYearForm.setData('school_year', e.target.value)}
                                                placeholder="e.g. 2024-2025"
                                            />
                                            {addSchoolYearForm.errors.school_year && (
                                                <p className="text-sm text-red-500">{addSchoolYearForm.errors.school_year}</p>
                                            )}
                                        </div>
                                        <div className="grid gap-2">
                                            <Label>Total Amount (₱) *</Label>
                                            <Input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                value={addSchoolYearForm.data.total_amount}
                                                onChange={(e) => addSchoolYearForm.setData('total_amount', e.target.value)}
                                                placeholder="0.00"
                                                className="text-lg font-semibold"
                                            />
                                            {addSchoolYearForm.errors.total_amount && (
                                                <p className="text-sm text-red-500">{addSchoolYearForm.errors.total_amount}</p>
                                            )}
                                        </div>
                                        <div className="grid gap-2">
                                            <Label>Reason *</Label>
                                            <Textarea
                                                value={addSchoolYearForm.data.reason}
                                                onChange={(e) => addSchoolYearForm.setData('reason', e.target.value)}
                                                placeholder="e.g. Manual fee entry for previous school year..."
                                                rows={2}
                                                required
                                            />
                                            {addSchoolYearForm.errors.reason && (
                                                <p className="text-sm text-red-500">{addSchoolYearForm.errors.reason}</p>
                                            )}
                                        </div>
                                        <div className="rounded-md border border-blue-200 bg-blue-50 p-3">
                                            <div className="flex items-center gap-2 text-blue-700">
                                                <AlertTriangle className="h-4 w-4" />
                                                <span className="text-sm font-medium">This action is permanently logged and visible to the Owner.</span>
                                            </div>
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <Button type="button" variant="outline" onClick={() => setIsAddSchoolYearDialogOpen(false)}>
                                            Cancel
                                        </Button>
                                        <Button
                                            type="submit"
                                            disabled={addSchoolYearForm.processing || !addSchoolYearForm.data.school_year || !addSchoolYearForm.data.total_amount || !addSchoolYearForm.data.reason}
                                            className="bg-blue-600 hover:bg-blue-700"
                                        >
                                            <Plus className="h-4 w-4 mr-2" />
                                            Create Record
                                        </Button>
                                    </DialogFooter>
                                </form>
                            </DialogContent>
                        </Dialog>
                        {/* Add Balance intentionally hidden per request. */}
                        {/* <Dialog open={isAddBalanceDialogOpen} onOpenChange={setIsAddBalanceDialogOpen}>
                            <DialogTrigger asChild>
                                <Button variant="outline" className="border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100">
                                    <Scale className="h-4 w-4 mr-2" />
                                    Add Balance
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[500px]">
                                <form onSubmit={handleAddBalanceSubmit}>
                                    <DialogHeader>
                                        <DialogTitle>Add Balance to Student Account</DialogTitle>
                                        <DialogDescription>
                                            Add additional balance to {student.full_name}'s account. This action is logged and auditable by the Owner.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="grid gap-4 py-4">
                                        <div className="grid gap-2">
                                            <Label>Fee / School Year *</Label>
                                            {fees.length > 0 ? (
                                                <Select
                                                    value={balanceForm.data.student_fee_id}
                                                    onValueChange={(val) => balanceForm.setData('student_fee_id', val)}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select school year" />
                                                    </SelectTrigger>
                                                    <SelectContent position="popper">
                                                        {fees.map((fee) => (
                                                            <SelectItem key={fee.id} value={fee.id.toString()}>
                                                                {fee.school_year} — Current Balance: {formatCurrency(fee.balance)}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            ) : (
                                                <div className="rounded-md border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                                                    No fee records found
                                                </div>
                                            )}
                                            {balanceForm.errors.student_fee_id && (
                                                <p className="text-sm text-red-500">{balanceForm.errors.student_fee_id}</p>
                                            )}
                                        </div>
                                        <div className="grid gap-2">
                                            <Label>Amount to Add (₱) *</Label>
                                            <Input
                                                type="number"
                                                step="0.01"
                                                min="0.01"
                                                value={balanceForm.data.amount}
                                                onChange={(e) => balanceForm.setData('amount', e.target.value)}
                                                placeholder="0.00"
                                                className="text-lg font-semibold"
                                            />
                                            {balanceForm.errors.amount && (
                                                <p className="text-sm text-red-500">{balanceForm.errors.amount}</p>
                                            )}
                                        </div>
                                        <div className="grid gap-2">
                                            <Label>Reason *</Label>
                                            <Textarea
                                                value={balanceForm.data.reason}
                                                onChange={(e) => balanceForm.setData('reason', e.target.value)}
                                                placeholder="e.g. Late enrollment fee, Additional lab fee, Penalty..."
                                                rows={2}
                                            />
                                            {balanceForm.errors.reason && (
                                                <p className="text-sm text-red-500">{balanceForm.errors.reason}</p>
                                            )}
                                        </div>
                                        <div className="grid gap-2">
                                            <Label>Notes (Optional)</Label>
                                            <Textarea
                                                value={balanceForm.data.notes}
                                                onChange={(e) => balanceForm.setData('notes', e.target.value)}
                                                placeholder="Additional notes..."
                                                rows={2}
                                            />
                                        </div>
                                        <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
                                            <div className="flex items-center gap-2 text-amber-700">
                                                <AlertTriangle className="h-4 w-4" />
                                                <span className="text-sm font-medium">This action is permanently logged and visible to the Owner.</span>
                                            </div>
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <Button type="button" variant="outline" onClick={() => setIsAddBalanceDialogOpen(false)}>
                                            Cancel
                                        </Button>
                                        <Button
                                            type="submit"
                                            disabled={balanceForm.processing || !balanceForm.data.amount || !balanceForm.data.reason || !balanceForm.data.student_fee_id}
                                            className="bg-amber-600 hover:bg-amber-700"
                                        >
                                            <Scale className="h-4 w-4 mr-2" />
                                            Add Balance
                                        </Button>
                                    </DialogFooter>
                                </form>
                            </DialogContent>
                        </Dialog> */}
                    </div>
                    <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
                        <DialogTrigger asChild>
                            {/* <Button>
                                <Plus className="h-4 w-4 mr-2" />
                                Record Payment
                            </Button> */}
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[500px]">
                            <form onSubmit={handlePaymentSubmit}>
                                <DialogHeader>
                                    <DialogTitle>Record Payment</DialogTitle>
                                    <DialogDescription>
                                        Record a new payment for {student.full_name}
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="grid gap-4 py-4">
                                    <div className="grid gap-2">
                                        <Label>Fee / School Year</Label>
                                        <Select
                                            value={paymentForm.data.student_fee_id}
                                            onValueChange={(val) => paymentForm.setData('student_fee_id', val)}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select fee" />
                                            </SelectTrigger>
                                            <SelectContent position="popper">
                                                {fees.filter(f => f.balance > 0).map((fee) => (
                                                    <SelectItem key={fee.id} value={fee.id.toString()}>
                                                        {fee.school_year} - Balance: {formatCurrency(fee.balance)}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="grid gap-2">
                                            <Label>Payment Date</Label>
                                            <Input
                                                type="date"
                                                value={paymentForm.data.payment_date}
                                                onChange={(e) => paymentForm.setData('payment_date', e.target.value)}
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label>OR Number</Label>
                                            <Input
                                                value={paymentForm.data.or_number}
                                                onChange={(e) => paymentForm.setData('or_number', e.target.value)}
                                                placeholder="Official Receipt #"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="grid gap-2">
                                            <Label>Amount</Label>
                                            <Input
                                                type="number"
                                                step="0.01"
                                                min="0.01"
                                                value={paymentForm.data.amount}
                                                onChange={(e) => paymentForm.setData('amount', e.target.value)}
                                                placeholder="0.00"
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label>Payment Mode</Label>
                                            <Select
                                                value={paymentForm.data.payment_mode}
                                                onValueChange={(val) => paymentForm.setData('payment_mode', val)}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select mode" />
                                                </SelectTrigger>
                                                <SelectContent position="popper">
                                                    <SelectItem value="CASH">Cash</SelectItem>
                                                    <SelectItem value="GCASH">GCash</SelectItem>
                                                    <SelectItem value="BANK">Bank Transfer</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    {(paymentForm.data.payment_mode === 'GCASH' || paymentForm.data.payment_mode === 'BANK') && (
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="grid gap-2">
                                                <Label>Reference Number</Label>
                                                <Input
                                                    value={paymentForm.data.reference_number}
                                                    onChange={(e) => paymentForm.setData('reference_number', e.target.value)}
                                                    placeholder="Transaction/Reference #"
                                                />
                                            </div>
                                            {paymentForm.data.payment_mode === 'BANK' && (
                                                <div className="grid gap-2">
                                                    <Label>Bank Name</Label>
                                                    <Input
                                                        value={paymentForm.data.bank_name}
                                                        onChange={(e) => paymentForm.setData('bank_name', e.target.value)}
                                                        placeholder="Name of bank"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    <div className="grid gap-2">
                                        <Label>Payment For</Label>
                                        <Select
                                            value={paymentForm.data.payment_for}
                                            onValueChange={(val) => paymentForm.setData('payment_for', val)}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select type" />
                                            </SelectTrigger>
                                            <SelectContent position="popper">
                                                <SelectItem value="registration">Registration</SelectItem>
                                                <SelectItem value="tuition">Tuition</SelectItem>
                                                <SelectItem value="misc">Miscellaneous</SelectItem>
                                                <SelectItem value="books">Books</SelectItem>
                                                <SelectItem value="other">Other</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="grid gap-2">
                                        <Label>Notes (Optional)</Label>
                                        <Textarea
                                            value={paymentForm.data.notes}
                                            onChange={(e) => paymentForm.setData('notes', e.target.value)}
                                            placeholder="Additional notes..."
                                            rows={2}
                                        />
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button type="button" variant="outline" onClick={() => setIsPaymentDialogOpen(false)}>
                                        Cancel
                                    </Button>
                                    <Button type="submit" disabled={paymentForm.processing}>
                                        Record Payment
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>

                {/* Student Info Card */}
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-6">
                            <Avatar className="h-16 w-16">
                                <AvatarImage 
                                    src={student.student_photo_url || undefined} 
                                    alt={student.full_name} 
                                />
                                <AvatarFallback className="bg-primary/10 text-primary text-xl font-semibold">
                                    {student.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                                <div className="flex items-center gap-3">
                                    <h3 className="text-xl font-semibold">{student.full_name}</h3>
                                    {grants.length > 0 && (
                                        <Badge className="bg-green-100 text-green-700 border-green-200">
                                            {(() => {
                                                const totalDiscount = activeSummary.total_discount;
                                                const totalFees = activeSummary.total_fees;
                                                if (totalFees > 0 && totalDiscount > 0) {
                                                    const discountPercent = Math.round((totalDiscount / totalFees) * 100);
                                                    return `${discountPercent}% Discount`;
                                                }
                                                return 'Grant Applied';
                                            })()}
                                        </Badge>
                                    )}
                                </div>
                                <p className="text-muted-foreground">Student No.: {student.lrn}</p>
                                <div className="mt-2 flex flex-wrap gap-2 text-sm">
                                    {student.classification && (
                                        <Badge variant="outline" className="capitalize bg-background">{student.classification}</Badge>
                                    )}
                                    {student.department && (
                                        <Badge variant="outline" className="bg-background">{student.department}</Badge>
                                    )}
                                    {student.program && (
                                        <Badge variant="outline" className="bg-background">{student.program}</Badge>
                                    )}
                                    {student.year_level && (
                                        <Badge variant="outline" className="bg-background">{student.year_level}</Badge>
                                    )}
                                    {student.section && (
                                        <Badge variant="outline" className="bg-background">{student.section}</Badge>
                                    )}
                                </div>
                                {/* Grant Info */}
                                {grants.length > 0 && (
                                    <div className="flex items-center gap-2 mt-2">
                                        <span className="text-sm text-green-600 font-medium">
                                            Grant: {grants.map(g => `${g.name} (${formatCurrency(g.discount_amount)})`).join(', ')}
                                        </span>
                                    </div>
                                )}
                                {/* Progress Bar */}
                                <div className="mt-3">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs text-muted-foreground">Payment Progress</span>
                                        <span className="text-xs font-medium">
                                            {(() => {
                                                // Simple calculation: what percentage of net amount has been paid
                                                const netAmount = activeSummary.total_fees - activeSummary.total_discount;
                                                if (netAmount <= 0 || activeSummary.total_paid >= netAmount) return '100% Paid';
                                                if (activeSummary.total_paid <= 0) return '0% Paid';
                                                const percent = Math.floor((activeSummary.total_paid / netAmount) * 100);
                                                return `${percent}% Paid`;
                                            })()}
                                        </span>
                                    </div>
                                    <Progress 
                                        value={(() => {
                                            const netAmount = activeSummary.total_fees - activeSummary.total_discount;
                                            if (netAmount <= 0) return 100;
                                            if (activeSummary.total_paid <= 0) return 0;
                                            const percent = (activeSummary.total_paid / netAmount) * 100;
                                            return Math.min(Math.max(percent, 0), 100);
                                        })()}
                                        className="h-2"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-5 gap-4 text-center">
                                <div>
                                    <p className="text-sm text-muted-foreground">Total Fees</p>
                                    <p className="text-lg font-semibold">{formatCurrency(activeSummary.total_fees)}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Discounts</p>
                                    <p className="text-lg font-semibold text-green-600">-{formatCurrency(activeSummary.total_discount)}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Total Paid</p>
                                    <p className="text-lg font-semibold text-blue-600">{formatCurrency(activeSummary.total_paid)}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Balance</p>
                                    <p className="text-lg font-semibold text-red-600">{formatCurrency(activeSummary.total_balance)}</p>
                                </div>
                                <div className="flex flex-col items-center gap-1">
                                    <p className="text-sm text-muted-foreground">Clearance</p>
                                    {enrollmentClearance?.accounting_clearance ? (
                                        <>
                                            <Badge className="bg-green-100 text-green-700 border-green-200">
                                                <ShieldCheck className="mr-1 h-3 w-3" />
                                                Cleared
                                            </Badge>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="text-xs h-6 px-2 mt-0.5"
                                                onClick={() => setClearanceDialog(true)}
                                            >
                                                <ShieldX className="mr-1 h-3 w-3" />
                                                Remove
                                            </Button>
                                        </>
                                    ) : (
                                        <>
                                            <Badge variant="secondary" className="bg-orange-100 text-orange-700">
                                                <Clock className="mr-1 h-3 w-3" />
                                                Pending
                                            </Badge>
                                            <Button
                                                size="sm"
                                                className={`text-xs h-6 px-2 mt-0.5 ${student.enrollment_status === 'dropped' ? 'bg-red-600 hover:bg-red-700' : ''}`}
                                                onClick={() => setClearanceDialog(true)}
                                            >
                                                <CheckCircle2 className="mr-1 h-3 w-3" />
                                                {student.enrollment_status === 'dropped' ? 'Drop' : 'Clear'}
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Tabs */}
                <Tabs defaultValue="make-payment" className="w-full">
                    <TabsList className="grid w-full grid-cols-5">
                        <TabsTrigger value="make-payment" className="flex items-center gap-2">
                            <CreditCard className="h-4 w-4" />
                            Make Payment
                        </TabsTrigger>
                        <TabsTrigger value="breakdown" className="flex items-center gap-2">
                            <PhilippinePeso className="h-4 w-4" />
                            Fee Breakdown
                        </TabsTrigger>
                        <TabsTrigger value="school-year" className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            School Year
                        </TabsTrigger>
                        <TabsTrigger value="promissory" className="flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            Promissory
                        </TabsTrigger>
                        <TabsTrigger value="transactions" className="flex items-center gap-2">
                            <PhilippinePeso className="h-4 w-4" />
                            Transactions
                        </TabsTrigger>
                    </TabsList>

                    {/* Tab 0: Make Payment */}
                    <TabsContent value="make-payment" className="space-y-4">
                        <form onSubmit={handleMakePayment}>
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                {/* Left Column - Payment Form */}
                                <div className="lg:col-span-2 space-y-4">
                                    {/* Payment Details Card */}
                                    <Card>
                                        <CardHeader>
                                            <CardTitle>Payment Details</CardTitle>
                                            <CardDescription>Enter payment information</CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            {/* Fee / School Year Selector */}
                                            <div className="grid gap-2">
                                                <Label>Fee / School Year *</Label>
                                                {normalizedPaymentOptions.length > 0 ? (
                                                    <Select
                                                        value={selectedFeeId}
                                                        onValueChange={setSelectedFeeId}
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Select fee / school year" />
                                                        </SelectTrigger>
                                                        <SelectContent position="popper">
                                                            <SelectItem value="all">
                                                                All School Years — Balance: {formatCurrency(allOptionBalance)}
                                                            </SelectItem>
                                                            {normalizedPaymentOptions.map((fee) => (
                                                                <SelectItem key={fee.id} value={fee.id.toString()}>
                                                                    {fee.school_year} — Balance: {formatCurrency(fee.balance)}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                ) : (
                                                    <div className="rounded-md border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                                                        No fee records found for this student
                                                    </div>
                                                )}
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="grid gap-2">
                                                    <Label htmlFor="or_number">OR Number *</Label>
                                                    <Input
                                                        id="or_number"
                                                        value={paymentForm.data.or_number}
                                                        onChange={(e) => paymentForm.setData('or_number', e.target.value)}
                                                        placeholder="Official Receipt #"
                                                        required
                                                    />
                                                </div>
                                                <div className="grid gap-2">
                                                    <Label htmlFor="payment_date">Payment Date *</Label>
                                                    <Input
                                                        id="payment_date"
                                                        type="date"
                                                        value={paymentForm.data.payment_date}
                                                        onChange={(e) => paymentForm.setData('payment_date', e.target.value)}
                                                        required
                                                    />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="grid gap-2">
                                                    <Label>Payment Method</Label>
                                                    <div className="flex items-center gap-2 p-3 border rounded-md bg-muted/50">
                                                        <PhilippinePeso className="h-4 w-4 text-green-600" />
                                                        <span className="font-medium">Cash</span>
                                                    </div>
                                                </div>
                                                <div className="grid gap-2">
                                                    <Label htmlFor="amount_received">Amount Received *</Label>
                                                    <Input
                                                        id="amount_received"
                                                        type="number"
                                                        step="0.01"
                                                        min="0.01"
                                                        value={amountReceived}
                                                        onChange={(e) => setAmountReceived(e.target.value)}
                                                        placeholder="0.00"
                                                        required
                                                        className="text-lg font-semibold"
                                                    />
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    {/* Payment Breakdown Card */}
                                    <Card>
                                        <CardHeader>
                                            <CardTitle>Payment Breakdown</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="space-y-3">
                                                <div className="flex justify-between py-2 border-b">
                                                    <span className="text-muted-foreground">Current Fees Balance</span>
                                                    <span className="font-medium">{formatCurrency(activeSummary.current_fees_balance || activeSummary.total_balance)}</span>
                                                </div>
                                                <div className="flex justify-between py-2 bg-blue-50 px-3 rounded-md">
                                                    <span className="font-medium text-blue-700">Amount Received</span>
                                                    <span className="font-bold text-blue-700">{formatCurrency(parseFloat(amountReceived) || 0)}</span>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    {/* Payment Allocation disabled per request. */}
                                    {/* <Card>
                                        <CardHeader>
                                            <CardTitle>Payment Allocation</CardTitle>
                                            <CardDescription>How the payment will be applied</CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="space-y-3">
                                                <div className="flex justify-between py-2 border-b">
                                                    <span className="text-muted-foreground">Previous Balance Paid</span>
                                                    <span className="font-medium text-green-600">{formatCurrency(paymentAllocation.previousBalancePaid)}</span>
                                                </div>
                                                <div className="flex justify-between py-2 border-b">
                                                    <span className="text-muted-foreground">Current Fees Paid</span>
                                                    <span className="font-medium text-green-600">{formatCurrency(paymentAllocation.currentFeesPaid)}</span>
                                                </div>
                                                <div className="flex justify-between py-2 border-b">
                                                    <span className="text-muted-foreground">Remaining Previous Balance</span>
                                                    <span className="font-medium text-red-600">{formatCurrency(paymentAllocation.remainingPreviousBalance)}</span>
                                                </div>
                                                <div className="flex justify-between py-2 border-b">
                                                    <span className="text-muted-foreground">Remaining Current Fees Balance</span>
                                                    <span className="font-medium text-red-600">{formatCurrency(paymentAllocation.remainingCurrentFeesBalance)}</span>
                                                </div>
                                                {paymentAllocation.change > 0 && (
                                                    <div className="flex justify-between py-2 bg-yellow-50 px-3 rounded-md">
                                                        <span className="font-medium text-yellow-700">Change</span>
                                                        <span className="font-bold text-yellow-700">{formatCurrency(paymentAllocation.change)}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card> */}
                                </div>

                                {/* Right Column - Fee Summary & Actions */}
                                <div className="space-y-4">
                                    {/* Fee Summary Card */}
                                    <Card>
                                        <CardHeader>
                                            <CardTitle>Fee Summary</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="space-y-3">
                                                <div className="flex justify-between py-2 border-b">
                                                    <span className="text-muted-foreground">Total Fees</span>
                                                    <span className="font-medium">{formatCurrency(activeSummary.total_fees)}</span>
                                                </div>
                                                {activeSummary.total_discount > 0 && (
                                                    <div className="flex justify-between py-2 border-b">
                                                        <span className="text-muted-foreground">Discount</span>
                                                        <span className="font-medium text-green-600">-{formatCurrency(activeSummary.total_discount)}</span>
                                                    </div>
                                                )}
                                                <div className="flex justify-between py-2 border-b">
                                                    <span className="text-muted-foreground">Total Paid</span>
                                                    <span className="font-medium text-blue-600">{formatCurrency(activeSummary.total_paid)}</span>
                                                </div>
                                                <div className="flex justify-between py-3 bg-red-50 px-3 rounded-md">
                                                    <span className="font-semibold text-red-700">Balance Due</span>
                                                    <span className="font-bold text-red-700">{formatCurrency(activeSummary.total_balance)}</span>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    {/* Cashier & Options */}
                                    <Card>
                                        <CardHeader>
                                            <CardTitle>Processing Options</CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            <div className="grid gap-2">
                                                <Label>Cashier</Label>
                                                <Input 
                                                    value={currentUser.name} 
                                                    disabled 
                                                    className="bg-muted"
                                                />
                                            </div>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={handlePrintCurrentTransaction}
                                                disabled={!selectedFeeId || selectedFeeId === 'all' || !amountReceived || parseFloat(amountReceived) <= 0}
                                                className="w-full"
                                            >
                                                    <Printer className="h-4 w-4" />
                                                    Print Current Transaction
                                            </Button>
                                            <div className="grid gap-2">
                                                <Label htmlFor="notes">Notes (Optional)</Label>
                                                <Textarea
                                                    id="notes"
                                                    value={paymentForm.data.notes}
                                                    onChange={(e) => paymentForm.setData('notes', e.target.value)}
                                                    placeholder="Additional notes..."
                                                    rows={2}
                                                />
                                            </div>
                                        </CardContent>
                                    </Card>

                                    {/* Balance Adjustments History disabled per request. */}
                                    {/* {balanceAdjustments.length > 0 && (
                                        <Card>
                                            <CardHeader className="pb-3">
                                                <CardTitle className="flex items-center gap-2 text-base">
                                                    <History className="h-4 w-4 text-amber-600" />
                                                    Balance Adjustments
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="space-y-3 max-h-48 overflow-y-auto">
                                                    {balanceAdjustments.map((adj) => (
                                                        <div key={adj.id} className="border rounded-md p-2.5 bg-amber-50/50">
                                                            <div className="flex justify-between items-start">
                                                                <span className="text-sm font-medium text-amber-800">+{formatCurrency(adj.amount)}</span>
                                                                <span className="text-xs text-muted-foreground">{adj.school_year}</span>
                                                            </div>
                                                            <p className="text-xs text-muted-foreground mt-1">{adj.reason}</p>
                                                            <div className="flex justify-between items-center mt-1.5">
                                                                <span className="text-xs text-muted-foreground">by {adj.adjusted_by}</span>
                                                                <span className="text-xs text-muted-foreground">{adj.created_at}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    )} */}

                                    {/* Action Button */}
                                    <Button 
                                        type="submit" 
                                        className="w-full h-12 text-lg"
                                        disabled={!amountReceived || parseFloat(amountReceived) <= 0 || !paymentForm.data.or_number || !selectedFeeId || selectedFeeId === 'all'}
                                    >
                                        <PhilippinePeso className="h-5 w-5 mr-2" />
                                        Record Payment
                                    </Button>
                                </div>
                            </div>
                        </form>
                    </TabsContent>

                    {/* Tab 1: Payment Breakdown */}
                    <TabsContent value="breakdown" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Fee Breakdown by Category</CardTitle>
                                <CardDescription>
                                    View detailed breakdown of all fees across school years
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {fees.length === 0 ? (
                                    <p className="text-center py-8 text-muted-foreground">No fees found.</p>
                                ) : (
                                    <div className="space-y-6">
                                        {fees.map((fee) => (
                                            <div key={fee.id} className="border rounded-lg p-4">
                                                <div className="flex items-center justify-between mb-4">
                                                    <div className="flex items-center gap-3">
                                                        <GraduationCap className="h-5 w-5 text-primary" />
                                                        <div>
                                                            <h4 className="font-semibold">School Year</h4>
                                                            <p className="text-sm text-muted-foreground">{fee.school_year}</p>
                                                        </div>
                                                        {getStatusBadge(fee.status)}
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-sm text-muted-foreground">Balance</p>
                                                        <p className="font-semibold text-red-600">{renderPesoAmount(fee.balance)}</p>
                                                    </div>
                                                </div>

                                                {/* Display by Category */}
                                                {fee.categories && fee.categories.length > 0 ? (
                                                    <div className="space-y-4">
                                                        {fee.categories.map((category) => (
                                                            <div key={category.category_id} className="border rounded-md p-3 bg-background">
                                                                <h5 className="font-semibold mb-2 flex items-center gap-2">
                                                                    <span className="text-foreground">{category.category_name}</span>
                                                                </h5>
                                                                <Table>
                                                                    <TableHeader>
                                                                        <TableRow>
                                                                            <TableHead>Fee Item</TableHead>
                                                                            <TableHead className="text-right">Amount</TableHead>
                                                                        </TableRow>
                                                                    </TableHeader>
                                                                    <TableBody>
                                                                        {category.items.map((item) => (
                                                                            <TableRow key={item.id}>
                                                                                <TableCell className="text-foreground">{item.name}</TableCell>
                                                                                <TableCell className="text-right text-foreground">{renderPesoAmount(item.amount)}</TableCell>
                                                                            </TableRow>
                                                                        ))}
                                                                    </TableBody>
                                                                </Table>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="text-center py-8 text-muted-foreground">No fee items assigned</p>
                                                )}

                                                <div className="flex justify-end gap-6 mt-4 pt-4 border-t text-sm">
                                                    <div>
                                                        <span className="text-muted-foreground">Total: </span>
                                                        <span className="font-medium">{renderPesoAmount(fee.total_amount)}</span>
                                                    </div>
                                                    {fee.grant_discount > 0 && (
                                                        <div>
                                                            <span className="text-muted-foreground">Discount: </span>
                                                            <span className="font-medium text-green-600">- {renderPesoAmount(fee.grant_discount)}</span>
                                                        </div>
                                                    )}
                                                    <div>
                                                        <span className="text-muted-foreground">Paid: </span>
                                                        <span className="font-medium text-blue-600">{renderPesoAmount(fee.total_paid)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Grants/Scholarships */}
                        {grants.length > 0 && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Grants & Scholarships</CardTitle>
                                    <CardDescription>Applied discounts and scholarships</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Grant Name</TableHead>
                                                <TableHead>School Year</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead className="text-right">Discount Amount</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {grants.map((grant) => (
                                                <TableRow key={grant.id}>
                                                    <TableCell className="font-medium">{grant.name}</TableCell>
                                                    <TableCell>{grant.school_year}</TableCell>
                                                    <TableCell>{getStatusBadge(grant.status)}</TableCell>
                                                    <TableCell className="text-right text-green-600">
                                                        - {renderPesoAmount(grant.discount_amount)}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>
                        )}
                    </TabsContent>

                    {/* Tab 2: School Year History */}
                    <TabsContent value="school-year" className="space-y-4">
                        {/* Previous Balance Rollover Banner */}
                        {summary.previous_balance > 0 && (
                            <Card className="border-amber-200 bg-amber-50">
                                <CardContent className="pt-4 pb-4">
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="flex items-center gap-3">
                                            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
                                            <div>
                                                <p className="font-medium text-amber-800">
                                                    Outstanding Previous Balance: {formatCurrency(summary.previous_balance)}
                                                </p>
                                              
                                            </div>
                                        </div>
                                        {/* <Button
                                            size="sm"
                                            variant="outline"
                                            className="flex-shrink-0 border-amber-400 text-amber-800 hover:bg-amber-100"
                                            onClick={() => {
                                                if (confirm(`Carry forward ₱${summary.previous_balance.toLocaleString('en-PH', { minimumFractionDigits: 2 })} from previous school year(s) to the current year record?`)) {
                                                    router.post(`/super-accounting/payments/process/${student.id}/carry-forward`, {}, {
                                                        preserveScroll: true,
                                                    });
                                                }
                                            }}
                                        >
                                            <RefreshCw className="mr-1.5 h-4 w-4" />
                                            Carry Forward
                                        </Button> */}
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* School Year Tab Filter */}
                        <div className="flex items-center gap-2 flex-wrap">
                            <button
                                type="button"
                                onClick={() => {
                                    setSelectedSchoolYear('all');
                                    setSchoolYearPage(1);
                                }}
                                className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                                    selectedSchoolYear === 'all'
                                        ? 'bg-primary text-primary-foreground border-primary'
                                        : 'bg-background text-muted-foreground border-border hover:border-primary/60 hover:text-foreground'
                                }`}
                            >
                                All Years
                            </button>
                            {schoolYears.map((sy) => (
                                <button
                                    key={sy}
                                    type="button"
                                    onClick={() => {
                                        setSelectedSchoolYear(sy);
                                        setSchoolYearPage(1);
                                    }}
                                    className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                                        selectedSchoolYear === sy
                                            ? 'bg-primary text-primary-foreground border-primary'
                                            : 'bg-background text-muted-foreground border-border hover:border-primary/60 hover:text-foreground'
                                    }`}
                                >
                                    {sy}
                                </button>
                            ))}
                        </div>

                        {/* Fee Overview */}
                        <Card>
                            <CardHeader className="pb-3">
                                <div className="flex items-center gap-2">
                                    <Receipt className="h-5 w-5 text-primary" />
                                    <div>
                                        <CardTitle className="text-base">
                                            {selectedSchoolYear === 'all' ? 'All School Years — Fee Overview' : `${selectedSchoolYear} — Fee Overview`}
                                        </CardTitle>
                                        <CardDescription>Fee totals, discounts, and balance summary</CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {schoolYearRows.length === 0 ? (
                                    <p className="text-center py-6 text-muted-foreground text-sm">No fee records found.</p>
                                ) : (
                                    <>
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>School Year</TableHead>
                                                    <TableHead className="text-right">Total Fees</TableHead>
                                                    <TableHead className="text-right">Discount</TableHead>
                                                    <TableHead className="text-right">Paid</TableHead>
                                                    <TableHead className="text-right">Balance</TableHead>
                                                    <TableHead>Status</TableHead>
                                                    <TableHead>Processed By</TableHead>
                                                    <TableHead>Reason / Notes</TableHead>
                                                    <TableHead>Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {pagedSchoolYearRows.map((row) => {
                                                    const linkedFee = (
                                                        filteredFees.find((fee) => `fee-${fee.id}` === row.id)
                                                        ?? filteredFees.find((fee) => fee.school_year === row.school_year)
                                                        ?? (() => {
                                                            const fallback = normalizedPaymentOptions.find((fee) => fee.school_year === row.school_year);
                                                            if (!fallback) return null;

                                                            return {
                                                                id: fallback.id,
                                                                school_year: fallback.school_year,
                                                                total_amount: fallback.total_amount,
                                                                grant_discount: 0,
                                                                total_paid: row.total_paid,
                                                                balance: fallback.balance,
                                                                status: row.status,
                                                                is_overdue: row.status === 'overdue',
                                                                due_date: null,
                                                                categories: [],
                                                                processed_by: row.processed_by || null,
                                                                processed_at: row.processed_at || null,
                                                                reason: row.reason || null,
                                                                notes: row.notes || null,
                                                                carried_forward_balance: 0,
                                                                carried_forward_from: null,
                                                            } as Fee;
                                                        })()
                                                    );

                                                    return (
                                                        <TableRow key={row.id} className={row.is_history ? 'bg-slate-50/70' : ''}>
                                                            <TableCell className="font-medium">
                                                                {row.school_year}
                                                                {row.is_history && (
                                                                    <Badge variant="outline" className="ml-2 text-[10px]">Edited Snapshot</Badge>
                                                                )}
                                                            </TableCell>
                                                            <TableCell className="text-right">{formatCurrency(row.total_amount)}</TableCell>
                                                            <TableCell className="text-right text-green-600">
                                                                {row.grant_discount > 0 ? `-${formatCurrency(row.grant_discount)}` : '-'}
                                                            </TableCell>
                                                            <TableCell className="text-right text-blue-600">{formatCurrency(row.total_paid)}</TableCell>
                                                            <TableCell className="text-right font-medium text-red-600">{formatCurrency(row.balance)}</TableCell>
                                                            <TableCell>{getStatusBadge(row.status)}</TableCell>
                                                            <TableCell>
                                                                <div className="text-sm">
                                                                    <p className="font-medium">{row.processed_by || '-'}</p>
                                                                    {row.processed_at && <p className="text-xs text-muted-foreground">{formatDateTime(row.processed_at)}</p>}
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="max-w-[260px]">
                                                                {(row.reason || row.notes) ? (
                                                                    <div className="text-xs">
                                                                        <p>{row.reason || row.notes}</p>
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-xs text-muted-foreground">-</span>
                                                                )}
                                                            </TableCell>
                                                            <TableCell>
                                                                {linkedFee ? (
                                                                    <div className="flex items-center gap-1">
                                                                        <Button
                                                                            size="sm"
                                                                            variant="ghost"
                                                                            className="h-7 w-7 p-0 text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                                                                            onClick={() => openEditFeeDialog(linkedFee)}
                                                                            title="Edit fee record"
                                                                        >
                                                                            <Pencil className="h-3.5 w-3.5" />
                                                                        </Button>
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-xs text-muted-foreground">-</span>
                                                                )}
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                })}
                                            </TableBody>
                                            {filteredFees.length > 1 && (
                                                <tfoot>
                                                    <TableRow className="font-semibold bg-muted/50 border-t-2">
                                                        <TableCell className="text-muted-foreground text-sm">TOTAL</TableCell>
                                                        <TableCell className="text-right">{formatCurrency(filteredFees.reduce((s, f) => s + f.total_amount, 0))}</TableCell>
                                                        <TableCell className="text-right text-green-600">
                                                            {filteredFees.reduce((s, f) => s + f.grant_discount, 0) > 0
                                                                ? `-${formatCurrency(filteredFees.reduce((s, f) => s + f.grant_discount, 0))}`
                                                                : '-'}
                                                        </TableCell>
                                                        <TableCell className="text-right text-blue-600">{formatCurrency(filteredFees.reduce((s, f) => s + f.total_paid, 0))}</TableCell>
                                                        <TableCell className="text-right font-bold text-red-600">
                                                            {formatCurrency(selectedSchoolYear === 'all' ? summary.total_balance : filteredFees.reduce((s, f) => s + f.balance, 0))}
                                                        </TableCell>
                                                        <TableCell colSpan={3} />
                                                    </TableRow>
                                                </tfoot>
                                            )}
                                        </Table>
                                        <Pagination data={schoolYearPaginationData} onPageChange={setSchoolYearPage} />
                                    </>
                                )}
                            </CardContent>
                        </Card>

                        {/* Payments Received */}
                        <Card>
                            <CardHeader className="pb-3">
                                <div className="flex items-center gap-2">
                                    <CreditCard className="h-5 w-5 text-blue-600" />
                                    <div>
                                        <CardTitle className="text-base">Payments Received</CardTitle>
                                        <CardDescription>All payment transactions on record</CardDescription>
                                    </div>
                                    {syFilteredPayments.length > 0 && (
                                        <Badge className="ml-auto bg-blue-100 text-blue-700 hover:bg-blue-100">
                                            {syFilteredPayments.length} record{syFilteredPayments.length !== 1 ? 's' : ''}
                                        </Badge>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent>
                                {syFilteredPayments.length === 0 ? (
                                    <p className="text-center py-6 text-muted-foreground text-sm">No payments recorded.</p>
                                ) : (
                                    <>
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Date</TableHead>
                                                    <TableHead>OR Number</TableHead>
                                                    {selectedSchoolYear === 'all' && <TableHead>School Year</TableHead>}
                                                    <TableHead>Payment For</TableHead>
                                                    <TableHead>Mode</TableHead>
                                                    <TableHead className="text-right">Amount</TableHead>
                                                    <TableHead>Notes</TableHead>
                                                    <TableHead>Recorded By</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {syFilteredPayments.map((payment) => (
                                                    <TableRow key={payment.id}>
                                                        <TableCell className="text-sm">
                                                            <div>{formatDate(payment.payment_date)}</div>
                                                            <div className="text-xs text-muted-foreground">{formatTime(payment.created_at)}</div>
                                                        </TableCell>
                                                        <TableCell className="font-mono text-xs">{payment.or_number || '-'}</TableCell>
                                                        {selectedSchoolYear === 'all' && (
                                                            <TableCell className="text-xs text-muted-foreground">{payment.school_year || '-'}</TableCell>
                                                        )}
                                                        <TableCell>
                                                            <Badge variant="outline" className="capitalize text-xs">{payment.payment_for || 'General'}</Badge>
                                                        </TableCell>
                                                        <TableCell className="text-xs uppercase">{payment.payment_mode || 'CASH'}</TableCell>
                                                        <TableCell className="text-right font-medium">
                                                            <span className={payment.amount < 0 ? 'text-red-600' : 'text-green-600'}>
                                                                {payment.amount < 0 ? '-' : '+'}{formatCurrency(Math.abs(payment.amount))}
                                                            </span>
                                                        </TableCell>
                                                        <TableCell className="max-w-[140px] truncate text-xs text-muted-foreground">{payment.notes || '-'}</TableCell>
                                                        <TableCell className="text-xs">{payment.recorded_by}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                        <div className="flex justify-end pt-3 border-t mt-3">
                                            <div className="text-right">
                                                <p className="text-xs text-muted-foreground">Total Paid</p>
                                                <p className="text-lg font-semibold text-green-600">
                                                    {formatCurrency(syFilteredPayments.reduce((s, p) => s + p.amount, 0))}
                                                </p>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </CardContent>
                        </Card>

                        {/* Balance Adjustments disabled per request. */}
                        {/* <Card>
                            <CardHeader className="pb-3">
                                <div className="flex items-center gap-2">
                                    <Scale className="h-5 w-5 text-amber-600" />
                                    <div>
                                        <CardTitle className="text-base">Balance Adjustments</CardTitle>
                                        <CardDescription>Manual balance additions applied to this account</CardDescription>
                                    </div>
                                    {syFilteredAdjustments.length > 0 && (
                                        <Badge className="ml-auto bg-amber-100 text-amber-700 hover:bg-amber-100">
                                            {syFilteredAdjustments.length} record{syFilteredAdjustments.length !== 1 ? 's' : ''}
                                        </Badge>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent>
                                {syFilteredAdjustments.length === 0 ? (
                                    <p className="text-center py-6 text-muted-foreground text-sm">No balance adjustments recorded.</p>
                                ) : (
                                    <>
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Date</TableHead>
                                                    {selectedSchoolYear === 'all' && <TableHead>School Year</TableHead>}
                                                    <TableHead>Reason</TableHead>
                                                    <TableHead className="text-right">Amount</TableHead>
                                                    <TableHead>Notes</TableHead>
                                                    <TableHead>Adjusted By</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {syFilteredAdjustments.map((adj) => (
                                                    <TableRow key={adj.id}>
                                                        <TableCell className="text-xs whitespace-nowrap">{adj.created_at}</TableCell>
                                                        {selectedSchoolYear === 'all' && (
                                                            <TableCell className="text-xs text-muted-foreground">{adj.school_year || '-'}</TableCell>
                                                        )}
                                                        <TableCell className="text-sm">{adj.reason}</TableCell>
                                                        <TableCell className="text-right font-medium text-amber-600">{formatCurrency(adj.amount)}</TableCell>
                                                        <TableCell className="max-w-[140px] truncate text-xs text-muted-foreground">{adj.notes || '-'}</TableCell>
                                                        <TableCell className="text-xs">{adj.adjusted_by}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                        <div className="flex justify-end pt-3 border-t mt-3">
                                            <div className="text-right">
                                                <p className="text-xs text-muted-foreground">Total Adjustments</p>
                                                <p className="text-lg font-semibold text-amber-600">
                                                    {formatCurrency(syFilteredAdjustments.reduce((s, a) => s + a.amount, 0))}
                                                </p>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </CardContent>
                        </Card> */}

                        {/* Grants & Discounts Applied */}
                        <Card>
                            <CardHeader className="pb-3">
                                <div className="flex items-center gap-2">
                                    <GraduationCap className="h-5 w-5 text-green-600" />
                                    <div>
                                        <CardTitle className="text-base">Grants & Discounts Applied</CardTitle>
                                        <CardDescription>Scholarships and discounts credited to this account</CardDescription>
                                    </div>
                                    {syFilteredGrants.length > 0 && (
                                        <Badge className="ml-auto bg-green-100 text-green-700 hover:bg-green-100">
                                            {syFilteredGrants.length} record{syFilteredGrants.length !== 1 ? 's' : ''}
                                        </Badge>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent>
                                {syFilteredGrants.length === 0 ? (
                                    <p className="text-center py-6 text-muted-foreground text-sm">No grants or discounts applied.</p>
                                ) : (
                                    <>
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Grant / Scholarship</TableHead>
                                                    {selectedSchoolYear === 'all' && <TableHead>School Year</TableHead>}
                                                    <TableHead>Status</TableHead>
                                                    <TableHead className="text-right">Discount Amount</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {syFilteredGrants.map((grant) => (
                                                    <TableRow key={grant.id}>
                                                        <TableCell className="font-medium">{grant.name}</TableCell>
                                                        {selectedSchoolYear === 'all' && (
                                                            <TableCell className="text-xs text-muted-foreground">{grant.school_year || '-'}</TableCell>
                                                        )}
                                                        <TableCell>{getStatusBadge(grant.status)}</TableCell>
                                                        <TableCell className="text-right font-medium text-green-600">-{formatCurrency(grant.discount_amount)}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                        <div className="flex justify-end pt-3 border-t mt-3">
                                            <div className="text-right">
                                                <p className="text-xs text-muted-foreground">Total Discounts</p>
                                                <p className="text-lg font-semibold text-green-600">
                                                    -{formatCurrency(syFilteredGrants.reduce((s, g) => s + g.discount_amount, 0))}
                                                </p>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </CardContent>
                        </Card>

                        {/* Promissory Notes */}
                        <Card>
                            <CardHeader className="pb-3">
                                <div className="flex items-center gap-2">
                                    <FileText className="h-5 w-5 text-purple-600" />
                                    <div>
                                        <CardTitle className="text-base">Promissory Notes</CardTitle>
                                        <CardDescription>Payment commitment agreements from this student</CardDescription>
                                    </div>
                                    {syFilteredPromissoryNotes.length > 0 && (
                                        <Badge className="ml-auto bg-purple-100 text-purple-700 hover:bg-purple-100">
                                            {syFilteredPromissoryNotes.length} record{syFilteredPromissoryNotes.length !== 1 ? 's' : ''}
                                        </Badge>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent>
                                {syFilteredPromissoryNotes.length === 0 ? (
                                    <p className="text-center py-6 text-muted-foreground text-sm">No promissory notes on record.</p>
                                ) : (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Submitted</TableHead>
                                                {selectedSchoolYear === 'all' && <TableHead>School Year</TableHead>}
                                                <TableHead>Due Date</TableHead>
                                                <TableHead className="text-right">Amount</TableHead>
                                                <TableHead>Reason</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead>Reviewed By</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {syFilteredPromissoryNotes.map((note) => (
                                                <TableRow key={note.id}>
                                                    <TableCell className="text-xs whitespace-nowrap">{formatDate(note.submitted_date)}</TableCell>
                                                    {selectedSchoolYear === 'all' && (
                                                        <TableCell className="text-xs text-muted-foreground">{note.school_year || '-'}</TableCell>
                                                    )}
                                                    <TableCell className="text-xs whitespace-nowrap">{formatDate(note.due_date)}</TableCell>
                                                    <TableCell className="text-right">{formatCurrency(note.amount)}</TableCell>
                                                    <TableCell className="max-w-[150px] truncate text-xs">{note.reason}</TableCell>
                                                    <TableCell>{getStatusBadge(note.status)}</TableCell>
                                                    <TableCell className="text-xs">{note.reviewed_by || '-'}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Tab 3: Promissory Notes */}
                    <TabsContent value="promissory" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle>Promissory Notes</CardTitle>
                                        <CardDescription>
                                            View and manage promissory note requests from this student
                                        </CardDescription>
                                    </div>
                                    <div className="flex gap-2">
                                        <Dialog open={isPromissoryDialogOpen} onOpenChange={setIsPromissoryDialogOpen}>
                                            <DialogTrigger asChild>
                                                {/* <Button className="bg-green-600 hover:bg-green-700">
                                                    <Plus className="h-4 w-4 mr-2" />
                                                    New Promissory Note
                                                </Button> */}
                                            </DialogTrigger>
                                            <DialogContent className="sm:max-w-[500px]">
                                                <form onSubmit={handlePromissorySubmit}>
                                                    <DialogHeader>
                                                        <DialogTitle>Create Promissory Note</DialogTitle>
                                                        <DialogDescription>
                                                            Create a new promissory note for {student.full_name}
                                                        </DialogDescription>
                                                    </DialogHeader>
                                                    <div className="grid gap-4 py-4">
                                                        <div className="grid gap-2">
                                                            <Label>Fee / School Year</Label>
                                                            <Select
                                                                value={promissoryForm.data.student_fee_id}
                                                                onValueChange={(val) => promissoryForm.setData('student_fee_id', val)}
                                                            >
                                                                <SelectTrigger>
                                                                    <SelectValue placeholder="Select fee" />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {fees.filter(f => f.balance > 0).map((fee) => (
                                                                        <SelectItem key={fee.id} value={fee.id.toString()}>
                                                                            {fee.school_year} - Balance: {formatCurrency(fee.balance)}
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                            {promissoryForm.errors.student_fee_id && (
                                                                <p className="text-sm text-red-500">{promissoryForm.errors.student_fee_id}</p>
                                                            )}
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-4">
                                                            <div className="grid gap-2">
                                                                <Label>Amount</Label>
                                                                <Input
                                                                    type="number"
                                                                    step="0.01"
                                                                    min="0.01"
                                                                    value={promissoryForm.data.amount}
                                                                    onChange={(e) => promissoryForm.setData('amount', e.target.value)}
                                                                    placeholder="0.00"
                                                                />
                                                                {promissoryForm.errors.amount && (
                                                                    <p className="text-sm text-red-500">{promissoryForm.errors.amount}</p>
                                                                )}
                                                            </div>
                                                            <div className="grid gap-2">
                                                                <Label>Due Date</Label>
                                                                <Input
                                                                    type="date"
                                                                    value={promissoryForm.data.due_date}
                                                                    onChange={(e) => promissoryForm.setData('due_date', e.target.value)}
                                                                    min={new Date(Date.now() + 86400000).toISOString().split('T')[0]}
                                                                />
                                                                {promissoryForm.errors.due_date && (
                                                                    <p className="text-sm text-red-500">{promissoryForm.errors.due_date}</p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <DialogFooter>
                                                        <Button type="button" variant="outline" onClick={() => setIsPromissoryDialogOpen(false)}>
                                                            Cancel
                                                        </Button>
                                                        <Button type="submit" disabled={promissoryForm.processing}>
                                                            Create Note
                                                        </Button>
                                                    </DialogFooter>
                                                </form>
                                            </DialogContent>
                                        </Dialog>
                                        <Button variant="outline" className="bg-cyan-500 hover:bg-cyan-600 text-white" onClick={handleRefresh}>
                                            <RefreshCw className="h-4 w-4 mr-2" />
                                            Refresh
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {promissoryNotes.length === 0 ? (
                                    <p className="text-center py-8 text-muted-foreground">
                                        No promissory notes found for this student.
                                    </p>
                                ) : (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>School Year</TableHead>
                                                <TableHead>Submitted</TableHead>
                                                <TableHead>Due Date</TableHead>
                                                <TableHead className="text-right">Amount</TableHead>
                                                <TableHead>Reason</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead className="text-right">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {promissoryNotes.map((note) => (
                                                <TableRow key={note.id}>
                                                    <TableCell className="font-medium">{note.school_year}</TableCell>
                                                    <TableCell>{formatDate(note.submitted_date)}</TableCell>
                                                    <TableCell>{formatDate(note.due_date)}</TableCell>
                                                    <TableCell className="text-right">{formatCurrency(note.amount)}</TableCell>
                                                    <TableCell className="max-w-xs truncate">{note.reason}</TableCell>
                                                    <TableCell>{getStatusBadge(note.status)}</TableCell>
                                                    <TableCell className="text-right">
                                                        {note.status === 'pending' && (
                                                            <div className="flex justify-end gap-2">
                                                                <Button
                                                                    size="sm"
                                                                    variant="default"
                                                                    className="h-8"
                                                                    onClick={() => handleApprovePromissory(note.id)}
                                                                >
                                                                    <Check className="h-3 w-3 mr-1" />
                                                                    Approve
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    variant="destructive"
                                                                    className="h-8"
                                                                    onClick={() => handleDeclinePromissory(note.id)}
                                                                >
                                                                    <X className="h-3 w-3 mr-1" />
                                                                    Decline
                                                                </Button>
                                                            </div>
                                                        )}
                                                        {note.status !== 'pending' && note.reviewed_by && (
                                                            <span className="text-xs text-muted-foreground">
                                                                by {note.reviewed_by}
                                                            </span>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Tab 4: Transaction Details */}
                    <TabsContent value="transactions" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Transaction History</CardTitle>
                                <CardDescription>
                                    Complete payment transaction history
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {payments.length === 0 ? (
                                    <p className="text-center py-8 text-muted-foreground">
                                        No payment transactions found.
                                    </p>
                                ) : (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Date</TableHead>
                                                <TableHead>OR Number</TableHead>
                                                <TableHead>Payment For</TableHead>
                                                <TableHead className="text-right">Amount</TableHead>
                                                <TableHead>Mode of Payment</TableHead>
                                                <TableHead>Type</TableHead>
                                                <TableHead>Notes</TableHead>
                                                <TableHead>Recorded By</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {payments.map((payment) => (
                                                <TableRow key={payment.id}>
                                                    <TableCell>
                                                        <div className="flex flex-col">
                                                            <span>{formatDate(payment.payment_date)}</span>
                                                            <span className="text-xs text-muted-foreground">{formatTime(payment.created_at)}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="font-mono">
                                                        {payment.or_number || '-'}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline">
                                                            {payment.payment_for || 'General'}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right font-medium">
                                                        <span className={payment.amount < 0 ? 'text-red-600' : 'text-green-600'}>
                                                            {payment.amount < 0 ? '-' : '+'}{formatCurrency(Math.abs(payment.amount))}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline">
                                                            {(payment.payment_mode || 'N/A').toUpperCase()}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        {payment.transaction_type === 'refund' ? (
                                                            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300">
                                                                Refunded
                                                            </Badge>
                                                        ) : (
                                                            <Badge variant={payment.type === 'online' ? 'secondary' : 'default'}>
                                                                {payment.type === 'online'
                                                                    ? 'Online'
                                                                    : (payment.transaction_type === 'document' ? 'Document' : 'On-site')}
                                                            </Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="max-w-xs truncate text-muted-foreground">
                                                        {payment.notes || '-'}
                                                    </TableCell>
                                                    <TableCell>{payment.recorded_by}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                )}

                                {/* Summary at bottom */}
                                {payments.length > 0 && (
                                    <div className="flex justify-end pt-4 border-t mt-4">
                                        <div className="text-right">
                                            <p className="text-sm text-muted-foreground">Total Payments</p>
                                            <p className="text-xl font-semibold text-green-600">
                                                {formatCurrency(payments.reduce((sum, p) => sum + p.amount, 0))}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>

            {/* Clearance Confirmation Dialog */}
            <AlertDialog open={clearanceDialog} onOpenChange={setClearanceDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {enrollmentClearance?.accounting_clearance ? 'Remove Clearance?' : (student.enrollment_status === 'dropped' ? 'Drop Student?' : 'Clear Student?')}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {enrollmentClearance?.accounting_clearance ? (
                                <>
                                    Are you sure you want to remove accounting clearance for <strong>{student.full_name}</strong>?
                                </>
                            ) : student.enrollment_status === 'dropped' ? (
                                <>
                                    This will set accounting clearance for the drop process of <strong>{student.full_name}</strong>. This allows the registrar to mark the student as officially dropped.
                                </>
                            ) : (
                                <>
                                    Are you sure you want to clear <strong>{student.full_name}</strong> for accounting?
                                    {summary.total_balance > 0 && (
                                        <span className="block mt-2 text-orange-600">
                                            <AlertTriangle className="inline mr-1 h-4 w-4" />
                                            Note: This student still has an outstanding balance of {formatCurrency(summary.total_balance)}.
                                        </span>
                                    )}
                                </>
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={clearanceLoading}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleClearanceToggle} disabled={clearanceLoading}>
                            {clearanceLoading ? 'Processing...' : (enrollmentClearance?.accounting_clearance ? 'Remove Clearance' : (student.enrollment_status === 'dropped' ? 'Drop Student' : 'Clear Student'))}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Edit Fee Dialog */}
            <Dialog open={isEditFeeDialogOpen} onOpenChange={setIsEditFeeDialogOpen}>
                <DialogContent className="sm:max-w-[460px] max-h-[90vh] overflow-hidden">
                    <form onSubmit={handleEditFeeSubmit} className="flex max-h-[82vh] flex-col">
                        <DialogHeader>
                            <DialogTitle>Edit Fee Record — {editingFee?.school_year}</DialogTitle>
                            <DialogDescription>
                                Update the school year fee values. Changes are permanently logged.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid flex-1 gap-4 overflow-y-auto py-4 pr-1">
                            <div className="grid gap-2">
                                <Label>School Year</Label>
                                <Input
                                    value={editFeeForm.data.school_year}
                                    onChange={(e) => editFeeForm.setData('school_year', e.target.value)}
                                    placeholder="YYYY-YYYY"
                                />
                                {editFeeForm.errors.school_year && (
                                    <p className="text-sm text-red-500">{editFeeForm.errors.school_year}</p>
                                )}
                            </div>
                            <div className="grid gap-2">
                                <Label>Total Fees (₱)</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={editFeeForm.data.total_amount}
                                    onChange={(e) => editFeeForm.setData('total_amount', e.target.value)}
                                />
                                {editFeeForm.errors.total_amount && (
                                    <p className="text-sm text-red-500">{editFeeForm.errors.total_amount}</p>
                                )}
                            </div>
                            {/*
                            <div className="grid gap-2">
                                <Label>Discount (₱)</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={editFeeForm.data.grant_discount}
                                    onChange={(e) => editFeeForm.setData('grant_discount', e.target.value)}
                                />
                                {editFeeForm.errors.grant_discount && (
                                    <p className="text-sm text-red-500">{editFeeForm.errors.grant_discount}</p>
                                )}
                            </div>
                            <div className="grid gap-2">
                                <Label>Paid (₱)</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={editFeeForm.data.total_paid}
                                    onChange={(e) => editFeeForm.setData('total_paid', e.target.value)}
                                />
                                {editFeeForm.errors.total_paid && (
                                    <p className="text-sm text-red-500">{editFeeForm.errors.total_paid}</p>
                                )}
                            </div>
                            <div className="grid gap-2">
                                <Label>Balance (₱)</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={editFeeForm.data.balance}
                                    onChange={(e) => editFeeForm.setData('balance', e.target.value)}
                                />
                                {editFeeForm.errors.balance && (
                                    <p className="text-sm text-red-500">{editFeeForm.errors.balance}</p>
                                )}
                            </div>
                            */}
                            <div className="grid gap-2">
                                <Label>Status</Label>
                                <Select value={editFeeForm.data.status} onValueChange={(value) => editFeeForm.setData('status', value as 'unpaid' | 'partial' | 'paid' | 'overdue')}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="unpaid">Unpaid</SelectItem>
                                        <SelectItem value="partial">Partial</SelectItem>
                                        <SelectItem value="paid">Paid</SelectItem>
                                        <SelectItem value="overdue">Overdue</SelectItem>
                                    </SelectContent>
                                </Select>
                                {editFeeForm.errors.status && (
                                    <p className="text-sm text-red-500">{editFeeForm.errors.status}</p>
                                )}
                            </div>
                            <div className="grid gap-2">
                                <Label>Reason *</Label>
                                <Textarea
                                    value={editFeeForm.data.reason}
                                    onChange={(e) => editFeeForm.setData('reason', e.target.value)}
                                    placeholder="e.g. Corrected school-year fee data"
                                    rows={2}
                                    required
                                />
                                {editFeeForm.errors.reason && (
                                    <p className="text-sm text-red-500">{editFeeForm.errors.reason}</p>
                                )}
                            </div>
                            <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
                                <div className="flex items-center gap-2 text-amber-700">
                                    <AlertTriangle className="h-4 w-4" />
                                    <span className="text-sm font-medium">This action is permanently logged and visible in the audit trail.</span>
                                </div>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsEditFeeDialogOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={editFeeForm.processing || !editFeeForm.data.reason}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Save Changes
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </SuperAccountingLayout>
    );
}
