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
    CheckCircle2,
    ShieldCheck,
    ShieldX,
} from 'lucide-react';
import { PhilippinePeso } from '@/components/icons/philippine-peso';
import { useEffect, useState, useMemo } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import AccountingLayout from '@/layouts/accounting-layout';
import OwnerLayout from '@/layouts/owner/owner-layout';

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
    status: 'paid' | 'overdue' | 'pending';
    is_overdue: boolean;
    due_date: string | null;
    categories: FeeCategory[];
    carried_forward_balance: number;
    carried_forward_from: string | null;
}

interface Payment {
    id: number;
    payment_date: string;
    or_number: string;
    amount: number;
    payment_for: string;
    payment_mode: string;
    bank_name?: string | null;
    notes: string | null;
    recorded_by: string;
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
    paymentFeeOptions?: Array<{
        id: number;
        school_year: string;
        total_amount: number;
        balance: number;
    }>;
    cashiers?: Cashier[];
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

export default function PaymentProcess({ student, fees, payments, promissoryNotes, grants, summary, paymentFeeOptions = [], cashiers = [], enrollmentClearance = null, currentUser }: Props) {
    const page = usePage();
    const currentPath = page.url || '';
    const routePrefix = currentPath.startsWith('/owner/') ? 'owner' : 'accounting';
    const basePath = `/${routePrefix}`;
    const isOwnerView = routePrefix === 'owner';
    const ProcessLayout = isOwnerView ? OwnerLayout : AccountingLayout;

    const defaultTab = useMemo(() => {
        if (typeof window === 'undefined') {
            return isOwnerView ? 'breakdown' : 'make-payment';
        }

        const requestedTab = new URLSearchParams(window.location.search).get('tab') || '';
        const allowedTabs = isOwnerView
            ? ['breakdown', 'school-year', 'promissory', 'transactions']
            : ['make-payment', 'breakdown', 'school-year', 'promissory', 'transactions'];
        return allowedTabs.includes(requestedTab) ? requestedTab : (isOwnerView ? 'breakdown' : 'make-payment');
    }, [isOwnerView]);

    const [activeTab, setActiveTab] = useState<string>(defaultTab);
    const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
    const [isPromissoryDialogOpen, setIsPromissoryDialogOpen] = useState(false);
    const [clearanceDialog, setClearanceDialog] = useState(false);
    const [clearanceLoading, setClearanceLoading] = useState(false);
    const [selectedSchoolYear, setSelectedSchoolYear] = useState<string>('all');
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
            const totalBalance = normalizedPaymentOptions.reduce((total, fee) => total + fee.balance, 0);

            return {
                total_fees: totalFees,
                total_discount: summary.total_discount,
                total_paid: summary.total_paid,
                total_balance: totalBalance,
                previous_balance: summary.previous_balance || 0,
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

    const handlePaymentSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        paymentForm.post(`${basePath}/payments`, {
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
        
        router.post(`${basePath}/payments`, {
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
        promissoryForm.post(`${basePath}/promissory-notes`, {
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
        router.put(`${basePath}/clearance/${student.id}`, {
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
        router.post(`${basePath}/promissory-notes/${noteId}/approve`);
    };

    const handleDeclinePromissory = (noteId: number) => {
        router.post(`${basePath}/promissory-notes/${noteId}/decline`);
    };

    const getStatusBadge = (status: string) => {
        const configs: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; color: string }> = {
            paid: { label: 'Fully Paid', variant: 'default', color: 'bg-green-100 text-green-700' },
            pending: { label: 'Pending', variant: 'secondary', color: 'bg-yellow-100 text-yellow-700' },
            overdue: { label: 'Overdue', variant: 'destructive', color: 'bg-red-100 text-red-700' },
            approved: { label: 'Approved', variant: 'default', color: 'bg-green-100 text-green-700' },
            declined: { label: 'Declined', variant: 'destructive', color: 'bg-red-100 text-red-700' },
            fulfilled: { label: 'Fulfilled', variant: 'default', color: 'bg-blue-100 text-blue-700' },
            active: { label: 'Active', variant: 'default', color: 'bg-green-100 text-green-700' },
            inactive: { label: 'Inactive', variant: 'secondary', color: 'bg-gray-100 text-gray-700' },
            graduated: { label: 'Graduated', variant: 'default', color: 'bg-blue-100 text-blue-700' },
            withdrawn: { label: 'Withdrawn', variant: 'destructive', color: 'bg-red-100 text-red-700' },
        };
        const config = configs[status] || configs.pending;
        return <Badge className={config.color}>{config.label}</Badge>;
    };

    const filteredFees = selectedSchoolYear === 'all' 
        ? fees 
        : fees.filter(f => f.school_year === selectedSchoolYear);

    const schoolYears = [...new Set(fees.map(f => f.school_year))];

    return (
        <ProcessLayout>
            <Head title={`Payment Processing - ${student.full_name}`} />

            <div className="space-y-6 p-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href={`${basePath}/student-accounts`}>
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
                                                {normalizedPaymentOptions.map((fee) => (
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
                                    {isOwnerView ? (
                                        <Badge variant="outline">View Only</Badge>
                                    ) : enrollmentClearance?.accounting_clearance ? (
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
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className={`grid w-full ${isOwnerView ? 'grid-cols-4' : 'grid-cols-5'}`}>
                        {!isOwnerView && (
                            <TabsTrigger value="make-payment" className="flex items-center gap-2">
                                <CreditCard className="h-4 w-4" />
                                Make Payment
                            </TabsTrigger>
                        )}
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
                    {!isOwnerView && <TabsContent value="make-payment" className="space-y-4">
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
                                                    <span className="text-muted-foreground">Previous Balance</span>
                                                    <span className="font-medium">{formatCurrency(activeSummary.previous_balance || 0)}</span>
                                                </div>
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

                                    {/* Payment Allocation Card */}
                                    <Card>
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
                                    </Card>
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
                    }

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

                    {/* Tab 2: School Year Details */}
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
                                      
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle>School Year Summary</CardTitle>
                                        <CardDescription>
                                            Fee status and payments per school year
                                        </CardDescription>
                                    </div>
                                    <Select value={selectedSchoolYear} onValueChange={setSelectedSchoolYear}>
                                        <SelectTrigger className="w-48">
                                            <SelectValue placeholder="Filter by school year" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All School Years</SelectItem>
                                            {schoolYears.map((sy) => (
                                                <SelectItem key={sy} value={sy}>{sy}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {filteredFees.length === 0 ? (
                                    <p className="text-center py-8 text-muted-foreground">No school year data found.</p>
                                ) : (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>School Year</TableHead>
                                                <TableHead className="text-right">Total Fees</TableHead>
                                                <TableHead className="text-right">Discount</TableHead>
                                                <TableHead className="text-right">Paid</TableHead>
                                                <TableHead className="text-right">Balance</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead>Due Date</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredFees.map((fee) => (
                                                <TableRow key={fee.id} className={fee.is_overdue ? 'bg-red-50' : ''}>
                                                    <TableCell className="font-medium">
                                                        {fee.school_year}
                                                    </TableCell>
                                                    <TableCell className="text-right">{formatCurrency(fee.total_amount)}</TableCell>
                                                    <TableCell className="text-right text-green-600">
                                                        {fee.grant_discount > 0 ? `-${formatCurrency(fee.grant_discount)}` : '-'}
                                                    </TableCell>
                                                    <TableCell className="text-right text-blue-600">{formatCurrency(fee.total_paid)}</TableCell>
                                                    <TableCell className="text-right font-medium text-red-600">
                                                        {formatCurrency(fee.balance)}
                                                    </TableCell>
                                                    <TableCell>{getStatusBadge(fee.status)}</TableCell>
                                                    <TableCell>
                                                        {fee.due_date ? formatDate(fee.due_date) : '-'}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                        {filteredFees.length > 0 && (
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
                                                    <TableCell colSpan={2} />
                                                </TableRow>
                                            </tfoot>
                                        )}
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
                                                                    {normalizedPaymentOptions.map((fee) => (
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
                                                        <div className="grid gap-2">
                                                            <Label>Reason</Label>
                                                            <Textarea
                                                                value={promissoryForm.data.reason}
                                                                onChange={(e) => promissoryForm.setData('reason', e.target.value)}
                                                                placeholder="Reason for promissory note..."
                                                                rows={3}
                                                            />
                                                            {promissoryForm.errors.reason && (
                                                                <p className="text-sm text-red-500">{promissoryForm.errors.reason}</p>
                                                            )}
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
                                                        {!isOwnerView && note.status === 'pending' && (
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
                                                        {(isOwnerView || note.status !== 'pending') && note.reviewed_by && (
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
                                                <TableHead>Notes</TableHead>
                                                <TableHead>Type</TableHead>
                                                <TableHead>Recorded By</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {payments.map((payment) => (
                                                <TableRow key={payment.id}>
                                                    <TableCell>
                                                        {formatDate(payment.payment_date)}
                                                        {payment.created_at && (
                                                            <span className="block text-xs text-muted-foreground">
                                                                {payment.created_at}
                                                            </span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="font-mono">
                                                        {payment.or_number || '-'}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline">
                                                            {payment.payment_for || 'General'}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right font-medium text-green-600">
                                                        <span className={payment.amount < 0 ? 'text-red-600' : 'text-green-600'}>
                                                            {payment.amount < 0 ? '-' : '+'}{formatCurrency(Math.abs(payment.amount))}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="font-medium">
                                                        {payment.payment_mode || 'CASH'}
                                                    </TableCell>
                                                    <TableCell className="max-w-xs truncate text-muted-foreground">
                                                        {payment.payment_mode === 'BANK' && payment.bank_name
                                                            ? `Bank: ${payment.bank_name}${payment.notes ? ` · ${payment.notes}` : ''}`
                                                            : (payment.notes || '-')}
                                                    </TableCell>
                                                    <TableCell>
                                                        {payment.transaction_type === 'refund' ? (
                                                            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300">
                                                                Refunded
                                                            </Badge>
                                                        ) : payment.transaction_type === 'document' ? (
                                                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">
                                                                Document Request
                                                            </Badge>
                                                        ) : (
                                                            <Badge variant="outline" className={payment.type === 'online' ? 'bg-blue-50 text-blue-700 border-blue-300' : 'bg-gray-50 text-gray-700'}>
                                                                {payment.type === 'online' ? 'Online' : 'On-site'}
                                                            </Badge>
                                                        )}
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
            {!isOwnerView && <AlertDialog open={clearanceDialog} onOpenChange={setClearanceDialog}>
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
            </AlertDialog>}
        </ProcessLayout>
    );
}
