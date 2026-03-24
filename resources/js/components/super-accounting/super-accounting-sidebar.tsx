import { Link, usePage } from '@inertiajs/react';
import {
    BookOpen,
    Calculator,
    Calendar,
    FileCheck,
    Globe,
    LayoutDashboard,
    LayoutGrid,
    Megaphone,
    MessageCircle,
    Rows3,
    RotateCcw,
    ShieldCheck,
    ScrollText,
    UserX,
    Users,
} from 'lucide-react';
import { PhilippinePeso } from '@/components/icons/philippine-peso';
import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import type { NavItem } from '@/types';

interface AppSettings {
    app_name?: string;
    logo_url?: string | null;
    primary_color?: string;
    sidebar_color?: string;
    sidebar_font_size?: string;
}

export function SuperAccountingSidebar() {
    const { announcementCount, pendingDocumentCount, pendingDropRequestCount, pendingTransferRequestCount, pendingOnlineTransactionCount, pendingRefundCount, pendingPromissoryCount, appSettings } = usePage<{ announcementCount: number; pendingDocumentCount?: number; pendingDropRequestCount?: number; pendingTransferRequestCount?: number; pendingOnlineTransactionCount?: number; pendingRefundCount?: number; pendingPromissoryCount?: number; appSettings?: AppSettings }>().props;
    const appName = appSettings?.app_name || 'SchoolHub';
    const logoUrl = appSettings?.logo_url;
    const sidebarColor = appSettings?.sidebar_color || undefined;
    const sidebarFontSize = appSettings?.sidebar_font_size ? `${appSettings.sidebar_font_size}px` : undefined;

    const mainNavItems: NavItem[] = [
        {
            title: 'Account Dashboard',
            href: '/super-accounting/account-dashboard',
            icon: LayoutGrid,
        },
        {
            title: 'Main Dashboard',
            href: '/super-accounting/dashboard',
            icon: LayoutDashboard,
        },
        {
            title: 'Announcements',
            href: '/super-accounting/announcements',
            icon: Megaphone,
            badge: announcementCount || undefined,
        },
        {
            title: 'Chat',
            href: '/super-accounting/chat',
            icon: MessageCircle,
        },
        {
            title: 'Fee Management',
            href: '/super-accounting/fee-management',
            icon: Calculator,
        },
        {
            // Physical refund requests — super-accounting exclusive
            title: 'Refund Requests',
            href: '/super-accounting/refunds',
            icon: RotateCcw,
            badge: pendingRefundCount || undefined,
        },
        {
            title: 'Student Accounts',
            href: '/super-accounting/student-accounts?status=overdue',
            icon: Users,
        },
        {
            title: 'Promissory Notes',
            href: '/super-accounting/promissory-notes',
            icon: ScrollText,
            badge: pendingPromissoryCount || undefined,
        },
        {
            title: 'Reports',
            href: '/super-accounting/reports',
            icon: BookOpen,
        },
        {
            title: 'Masterlist',
            href: '/super-accounting/masterlist',
            icon: Rows3,
        },
        {
            title: 'Online Transactions',
            href: '/super-accounting/online-transactions',
            icon: Globe,
            badge: pendingOnlineTransactionCount || undefined,
        },
        {
            title: 'Document Approvals',
            href: '/super-accounting/document-approvals',
            icon: FileCheck,
            badge: pendingDocumentCount || undefined,
        },
        {
            title: 'Drop Approvals',
            href: '/super-accounting/drop-approvals',
            icon: UserX,
            badge: pendingDropRequestCount || undefined,
        },
        {
            title: 'Transfer Requests',
            href: '/super-accounting/transfer-requests',
            icon: UserX,
            badge: pendingTransferRequestCount || undefined,
        },
        {
            title: 'Exam Approval',
            href: '/super-accounting/exam-approval',
            icon: ShieldCheck,
        },
        {
            title: 'Calendar View',
            href: '/super-accounting/calendar',
            icon: Calendar,
        },
    ];

    return (
        <Sidebar variant="inset" style={{
            ...(sidebarColor ? { '--sidebar': sidebarColor } as React.CSSProperties : {}),
            ...(sidebarFontSize ? { fontSize: sidebarFontSize } : {}),
        }}>
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href="/super-accounting/dashboard">
                                {logoUrl ? (
                                    <img src={logoUrl} alt={appName} className="size-8 rounded-lg object-contain bg-white" />
                                ) : (
                                    <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                                        <PhilippinePeso className="size-4" />
                                    </div>
                                )}
                                <div className="grid flex-1 text-left text-sm leading-tight">
                                    <span className="truncate font-semibold">{appName}</span>
                                    <span className="truncate text-xs">Super Accounting Portal</span>
                                </div>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>
            <SidebarContent>
                <NavMain items={mainNavItems} label="Main Navigation" />
            </SidebarContent>
            <SidebarFooter>
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
