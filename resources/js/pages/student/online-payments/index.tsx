import { Head, router, useForm } from '@inertiajs/react';
import { CreditCard, Upload, CheckCircle2, XCircle, Clock, AlertTriangle, DollarSign, Receipt, Send, UserMinus, Eye } from 'lucide-react';
import { useState, useRef } from 'react';
import { toast } from 'sonner';
import { Pagination } from '@/components/ui/pagination';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { PdfViewer } from '@/components/ui/pdf-viewer';
import StudentLayout from '@/layouts/student/student-layout';

interface FeeItem {
    id: number;
    name: string;
    amount: number;
    category: string;
}

interface FeeSummary {
    total_fees: number;
    total_discount: number;
    total_paid: number;
    balance: number;
}

interface OnlinePayment {
    id: number;
    reference_number: string;
    amount: number;
    payment_method: string;
    status: 'pending' | 'verified' | 'completed' | 'failed' | 'refunded';
    submitted_at: string;
    verified_at: string | null;
    notes: string | null;
    payment_proof_url?: string | null;
    payment_proof_path?: string | null;
}

interface PaginatedRecentPayments {
    data: OnlinePayment[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number;
    to: number;
    links: { url: string | null; label: string; active: boolean }[];
}

interface Props {
    feeItems: FeeItem[];
    summary: FeeSummary;
    feeRecords: Array<{
        id: number;
        school_year: string;
        total_amount: number;
        total_paid: number;
        grant_discount: number;
        balance: number;
    }>;
    schoolYears: string[];
    selectedSchoolYear: string;
    feeYearSummaries: Array<{
        school_year: string;
        total_fees: number;
        total_discount: number;
        total_paid: number;
        balance: number;
    }>;
    recentPayments: PaginatedRecentPayments;
    paymentMethods: { value: string; label: string }[];
    enrollmentStatus?: string;
    isDropped?: boolean;
    transferFee?: {
        status: string;
        registrar_status: string;
        accounting_status: string;
        amount: number;
        paid_amount: number;
        balance: number;
        paid: boolean;
        or_number: string | null;
        finalized_at: string | null;
    } | null;
}

const statusConfig: Record<string, { label: string; icon: any; bgColor: string; textColor: string }> = {
    pending: {
        label: 'Pending Verification',
        icon: Clock,
        bgColor: 'bg-yellow-100',
        textColor: 'text-yellow-700',
    },
    completed: {
        label: 'Completed',
        icon: CheckCircle2,
        bgColor: 'bg-green-100',
        textColor: 'text-green-700',
    },
    verified: {
        label: 'Verified',
        icon: CheckCircle2,
        bgColor: 'bg-green-100',
        textColor: 'text-green-700',
    },
    failed: {
        label: 'Failed',
        icon: XCircle,
        bgColor: 'bg-red-100',
        textColor: 'text-red-700',
    },
    refunded: {
        label: 'Refunded',
        icon: AlertTriangle,
        bgColor: 'bg-blue-100',
        textColor: 'text-blue-700',
    },
};

function formatCurrency(amount: number): string {
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
        hour: '2-digit',
        minute: '2-digit',
    });
}

export default function OnlinePayment({ feeItems, summary, schoolYears, selectedSchoolYear, feeYearSummaries, recentPayments, paymentMethods, enrollmentStatus, isDropped = false, transferFee = null }: Props) {
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [viewerOpen, setViewerOpen] = useState(false);
    const [viewerTitle, setViewerTitle] = useState('Payment Proof');
    const [viewerFilePath, setViewerFilePath] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const form = useForm({
        school_year: selectedSchoolYear,
        amount: '',
        payment_method: 'gcash',
        reference_number: '',
        bank_name: '',
        receipt_image: null as File | null,
        notes: '',
        is_transfer_payment: false,
    });

    const selectedFeeSummary = feeYearSummaries.find((fee) => fee.school_year === form.data.school_year);
    const hasTransferFeeFlow = !!transferFee && transferFee.registrar_status === 'approved' && transferFee.accounting_status !== 'rejected' && transferFee.amount > 0;
    const transferTotalFees = hasTransferFeeFlow ? Math.max(0, transferFee.amount) : 0;
    const transferTotalPaid = hasTransferFeeFlow ? Math.max(0, transferFee.paid_amount || 0) : 0;
    const transferFeeBalance = hasTransferFeeFlow ? Math.max(0, transferFee.balance ?? (transferTotalFees - transferTotalPaid)) : 0;
    const summaryTotalFees = hasTransferFeeFlow ? transferTotalFees : (selectedFeeSummary?.total_fees ?? summary.total_fees);
    const summaryTotalDiscount = hasTransferFeeFlow ? 0 : (selectedFeeSummary?.total_discount ?? summary.total_discount);
    const summaryTotalPaid = hasTransferFeeFlow ? transferTotalPaid : (selectedFeeSummary?.total_paid ?? summary.total_paid);
    const summaryBalance = hasTransferFeeFlow ? transferFeeBalance : (selectedFeeSummary?.balance ?? summary.balance);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            form.setData('receipt_image', file);
            // Create preview URL
            const url = URL.createObjectURL(file);
            setPreviewUrl(url);
        }
    };

    const clearFile = () => {
        form.setData('receipt_image', null);
        setPreviewUrl(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const openProofViewer = (payment: OnlinePayment) => {
        const proofPath = payment.payment_proof_url || payment.payment_proof_path;
        if (!proofPath) {
            toast.error('No uploaded file found for this submission.');
            return;
        }

        setViewerTitle(`Payment Proof - ${payment.reference_number}`);
        setViewerFilePath(proofPath);
        setViewerOpen(true);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        form.setData('is_transfer_payment', hasTransferFeeFlow);
        form.post('/student/online-payments', {
            forceFormData: true,
            onSuccess: () => {
                toast.success('Changes saved successfully');
                form.reset();
                clearFile();
            },
        });
    };

    const handleSchoolYearChange = (schoolYear: string) => {
        form.setData('school_year', schoolYear);
        router.get('/student/online-payments', { school_year: schoolYear }, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    // Group fee items by category
    const groupedFeeItems = feeItems.reduce((acc, item) => {
        if (!acc[item.category]) {
            acc[item.category] = [];
        }
        acc[item.category].push(item);
        return acc;
    }, {} as Record<string, FeeItem[]>);

    return (
        <StudentLayout>
            <Head title="Online Payment" />

            <div className="space-y-6 p-6">
                {/* Dropped Student Banner */}
                {isDropped && (
                    <Card className="border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800">
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-red-800 dark:text-red-400">
                                <UserMinus className="h-5 w-5" />
                                Account Dropped
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-red-700 dark:text-red-300">
                                Your enrollment has been dropped. Online payments are disabled. Please visit the accounting office for any refund concerns.
                            </p>
                        </CardContent>
                    </Card>
                )}

                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Online Payment</h1>
                        <p className="text-muted-foreground">
                            {isDropped ? 'View your payment history' : 'Submit your payment details for verification'}
                        </p>
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Fees</CardTitle>
                            <Receipt className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{formatCurrency(summaryTotalFees)}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Discounts</CardTitle>
                            <DollarSign className="h-4 w-4 text-green-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-green-600">-{formatCurrency(summaryTotalDiscount)}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Paid</CardTitle>
                            <CheckCircle2 className="h-4 w-4 text-blue-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-blue-600">{formatCurrency(summaryTotalPaid)}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Balance</CardTitle>
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-red-600">{formatCurrency(summaryBalance)}</div>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column - Fee Breakdown & Payment Form */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Fee Breakdown */}
                        <Card>
                            <CardHeader>
                                <CardTitle>{hasTransferFeeFlow ? 'Transfer Out Payment' : 'Fee Breakdown'}</CardTitle>
                                <CardDescription>
                                    {hasTransferFeeFlow
                                        ? 'Your transfer out request is now in transfer fee processing mode.'
                                        : 'Your assigned fees based on your classification'}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {hasTransferFeeFlow ? (
                                    <div className="space-y-3 text-sm">
                                        <div className="flex items-center justify-between rounded-md border p-3">
                                            <span className="font-medium">Transfer Out Fee</span>
                                            <span className="font-semibold">{formatCurrency(transferFeeBalance)}</span>
                                        </div>
                                        <div className="flex items-center justify-between rounded-md border p-3">
                                            <span className="font-medium">Status</span>
                                            <Badge className={transferFee?.paid ? 'bg-green-100 text-green-700 border-green-200' : 'bg-amber-100 text-amber-700 border-amber-200'}>
                                                {transferFee?.paid ? 'Paid' : 'Unpaid'}
                                            </Badge>
                                        </div>
                                        {transferFee?.or_number && (
                                            <div className="text-muted-foreground">OR Number: {transferFee.or_number}</div>
                                        )}
                                        <p className="text-muted-foreground">
                                            Submit your online transfer out payment below. Super-accounting verification will update registrar finalization eligibility.
                                        </p>
                                    </div>
                                ) : (
                                    Object.keys(groupedFeeItems).length === 0 ? (
                                        <p className="text-center py-8 text-muted-foreground">
                                            No fees assigned yet.
                                        </p>
                                    ) : (
                                        <div className="space-y-6">
                                            {Object.entries(groupedFeeItems).map(([category, items]) => (
                                                <div key={category}>
                                                    <h4 className="font-semibold text-sm text-muted-foreground mb-2">{category}</h4>
                                                    <Table>
                                                        <TableBody>
                                                            {items.map((item) => (
                                                                <TableRow key={item.id}>
                                                                    <TableCell>{item.name}</TableCell>
                                                                    <TableCell className="text-right font-medium">
                                                                        {formatCurrency(item.amount)}
                                                                    </TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            ))}
                                            <div className="flex justify-between py-3 border-t font-semibold">
                                                <span>Total</span>
                                                <span>{formatCurrency(summary.total_fees)}</span>
                                            </div>
                                        </div>
                                    )
                                )}
                            </CardContent>
                        </Card>

                        {/* Payment Submission Form */}
                        {!isDropped && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <CreditCard className="h-5 w-5" />
                                    Submit Payment
                                </CardTitle>
                                <CardDescription>
                                    Fill in your payment details. Your payment will be verified by accounting.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={handleSubmit} className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="grid gap-2">
                                            <Label htmlFor="school_year">{hasTransferFeeFlow ? 'Transfer Out Fee *' : 'Fee / School Year *'}</Label>
                                            {hasTransferFeeFlow ? (
                                                <Input
                                                    id="school_year"
                                                    value={`Transfer Fee Balance: ${formatCurrency(transferFeeBalance)}`}
                                                    readOnly
                                                />
                                            ) : (
                                                <select
                                                    id="school_year"
                                                    value={form.data.school_year}
                                                    onChange={(e) => handleSchoolYearChange(e.target.value)}
                                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                                    required
                                                >
                                                    {schoolYears.map((year) => {
                                                        const yearSummary = feeYearSummaries.find((fee) => fee.school_year === year);
                                                        return (
                                                            <option key={year} value={year}>
                                                                {year} — Balance: {formatCurrency(yearSummary?.balance ?? 0)}
                                                            </option>
                                                        );
                                                    })}
                                                </select>
                                            )}
                                            {form.errors.school_year && (
                                                <p className="text-sm text-red-500">{form.errors.school_year}</p>
                                            )}
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="amount">Payment Amount *</Label>
                                            <Input
                                                id="amount"
                                                type="number"
                                                step="0.01"
                                                min="1"
                                                max={hasTransferFeeFlow ? undefined : (selectedFeeSummary?.balance ?? summary.balance)}
                                                value={form.data.amount}
                                                onChange={(e) => form.setData('amount', e.target.value)}
                                                placeholder="0.00"
                                                required
                                            />
                                            {hasTransferFeeFlow && transferFeeBalance > 0 && (
                                                <p className="text-xs text-muted-foreground">
                                                    Required minimum for verification: {formatCurrency(transferFeeBalance)} (exact or greater).
                                                </p>
                                            )}
                                            {form.errors.amount && (
                                                <p className="text-sm text-red-500">{form.errors.amount}</p>
                                            )}
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="payment_method">Payment Method *</Label>
                                            <select
                                                id="payment_method"
                                                value={form.data.payment_method}
                                                onChange={(e) => form.setData('payment_method', e.target.value)}
                                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                                required
                                            >
                                                {paymentMethods.map((method) => (
                                                    <option key={method.value} value={method.value}>
                                                        {method.label}
                                                    </option>
                                                ))}
                                            </select>
                                            {form.errors.payment_method && (
                                                <p className="text-sm text-red-500">{form.errors.payment_method}</p>
                                            )}
                                        </div>
                                    </div>

                                    {form.data.payment_method === 'bank_transfer' && (
                                        <div className="grid gap-2">
                                            <Label htmlFor="bank_name">Bank Name *</Label>
                                            <Input
                                                id="bank_name"
                                                value={form.data.bank_name}
                                                onChange={(e) => form.setData('bank_name', e.target.value)}
                                                placeholder="e.g. BDO, BPI, Metrobank"
                                                required
                                            />
                                            {form.errors.bank_name && (
                                                <p className="text-sm text-red-500">{form.errors.bank_name}</p>
                                            )}
                                        </div>
                                    )}

                                    <div className="grid gap-2">
                                        <Label htmlFor="reference_number">Reference Number *</Label>
                                        <Input
                                            id="reference_number"
                                            value={form.data.reference_number}
                                            onChange={(e) => form.setData('reference_number', e.target.value)}
                                            placeholder="Enter transaction reference number"
                                            required
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            This is the reference number from your payment provider (e.g., GCash transaction ID)
                                        </p>
                                        {form.errors.reference_number && (
                                            <p className="text-sm text-red-500">{form.errors.reference_number}</p>
                                        )}
                                    </div>

                                    <div className="grid gap-2">
                                        <Label>Receipt/Screenshot *</Label>
                                        <div className="border-2 border-dashed rounded-lg p-6 text-center">
                                            {previewUrl ? (
                                                <div className="space-y-4">
                                                    <img
                                                        src={previewUrl}
                                                        alt="Receipt preview"
                                                        className="max-h-48 mx-auto rounded-lg"
                                                    />
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={clearFile}
                                                    >
                                                        Remove
                                                    </Button>
                                                </div>
                                            ) : (
                                                <div className="space-y-2">
                                                    <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                                                    <p className="text-sm text-muted-foreground">
                                                        Upload your payment receipt or screenshot
                                                    </p>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        onClick={() => fileInputRef.current?.click()}
                                                    >
                                                        Choose File
                                                    </Button>
                                                </div>
                                            )}
                                            <input
                                                ref={fileInputRef}
                                                type="file"
                                                accept="image/*"
                                                onChange={handleFileChange}
                                                className="hidden"
                                            />
                                        </div>
                                        {form.errors.receipt_image && (
                                            <p className="text-sm text-red-500">{form.errors.receipt_image}</p>
                                        )}
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="notes">Notes (Optional)</Label>
                                        <Textarea
                                            id="notes"
                                            value={form.data.notes}
                                            onChange={(e) => form.setData('notes', e.target.value)}
                                            placeholder="Any additional notes..."
                                            rows={2}
                                        />
                                    </div>

                                    <Button
                                        type="submit"
                                        className="w-full"
                                        disabled={form.processing || !form.data.amount || !form.data.reference_number}
                                    >
                                        <Send className="h-4 w-4 mr-2" />
                                        {form.processing ? 'Submitting...' : 'Submit Payment'}
                                    </Button>
                                </form>
                            </CardContent>
                        </Card>
                        )}
                    </div>

                    {/* Right Column - Recent Payments */}
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Recent Submissions</CardTitle>
                                <CardDescription>Your recent payment submissions</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {!hasTransferFeeFlow && feeYearSummaries.length > 0 && (
                                    <div className="mb-4 rounded-md border p-3">
                                        <p className="mb-2 text-sm font-semibold">Balances by School Year</p>
                                        <div className="space-y-1 text-sm">
                                            {feeYearSummaries.map((fee) => (
                                                <div key={fee.school_year} className="flex items-center justify-between">
                                                    <span>{fee.school_year}</span>
                                                    <span className={fee.balance > 0 ? 'font-semibold text-red-600' : 'text-green-600'}>
                                                        {formatCurrency(fee.balance)}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {recentPayments.data.length === 0 ? (
                                    <p className="text-center py-8 text-muted-foreground">
                                        No payment submissions yet.
                                    </p>
                                ) : (
                                    <div className="space-y-4">
                                        {recentPayments.data.map((payment) => {
                                            const status = statusConfig[payment.status] || statusConfig.pending;
                                            const StatusIcon = status.icon;
                                            return (
                                                <div key={payment.id} className="border rounded-lg p-4">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="font-medium">{formatCurrency(payment.amount)}</span>
                                                        <div className="flex items-center gap-2">
                                                            {(payment.payment_proof_url || payment.payment_proof_path) && (
                                                                <Button
                                                                    type="button"
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={() => openProofViewer(payment)}
                                                                >
                                                                    <Eye className="h-4 w-4" />
                                                                </Button>
                                                            )}
                                                            <Badge className={`${status.bgColor} ${status.textColor} border-0`}>
                                                                <StatusIcon className="h-3 w-3 mr-1" />
                                                                {status.label}
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                    <div className="text-sm text-muted-foreground space-y-1">
                                                        <p>Ref: {payment.reference_number}</p>
                                                        <p>Method: {payment.payment_method.toUpperCase()}</p>
                                                        <p>Submitted: {formatDate(payment.submitted_at)}</p>
                                                        {payment.verified_at && (
                                                            <p className="text-green-600">Verified: {formatDate(payment.verified_at)}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        <Pagination data={recentPayments} />
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Instructions */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Payment Instructions</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                                    <li>Complete your payment through any supported method</li>
                                    <li>Take a screenshot of your payment confirmation</li>
                                    <li>Fill in the form with accurate details</li>
                                    <li>Upload your receipt/screenshot</li>
                                    <li>Submit and wait for verification</li>
                                </ol>
                                <div className="mt-4 p-3 rounded-lg bg-yellow-50 text-yellow-700 text-sm">
                                    <AlertTriangle className="h-4 w-4 inline-block mr-1" />
                                    Your payment will be reflected after verification by accounting staff.
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>

            {viewerFilePath && (
                <PdfViewer
                    open={viewerOpen}
                    onOpenChange={setViewerOpen}
                    title={viewerTitle}
                    filePath={viewerFilePath}
                />
            )}
        </StudentLayout>
    );
}
