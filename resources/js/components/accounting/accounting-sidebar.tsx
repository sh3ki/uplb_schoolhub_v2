import { Link, usePage } from '@inertiajs/react';
import {
    Calendar,
    ClipboardCheck,
    CreditCard,
    FileCheck,
    Gift,
    Globe,
    LayoutDashboard,
    LayoutGrid,
    Megaphone,
    MessageCircle,
    Rows3,
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

export function AccountingSidebar() {
    const { announcementCount, pendingDocumentCount, pendingDropRequestCount, pendingTransferRequestCount, pendingOnlineTransactionCount, pendingPromissoryCount, appSettings } = usePage<{ announcementCount: number; pendingDocumentCount?: number; pendingDropRequestCount?: number; pendingTransferRequestCount?: number; pendingOnlineTransactionCount?: number; pendingPromissoryCount?: number; appSettings?: AppSettings }>().props;
    const appName = appSettings?.app_name || 'SchoolHub';
    const logoUrl = appSettings?.logo_url;
    const sidebarColor = appSettings?.sidebar_color || undefined;
    const sidebarFontSize = appSettings?.sidebar_font_size ? `${appSettings.sidebar_font_size}px` : undefined;

    const mainNavItems: NavItem[] = [
        {
            title: 'Account Dashboard',
            href: '/accounting/account-dashboard',
            icon: LayoutGrid,
        },
        {
            title: 'Main Dashboard',
            href: '/accounting/dashboard',
            icon: LayoutDashboard,
        },
        {
            title: 'Announcements',
            href: '/accounting/announcements',
            icon: Megaphone,
            badge: announcementCount || undefined,
        },
        {
            title: 'Chat',
            href: '/accounting/chat',
            icon: MessageCircle,
        },
        {
            title: 'Student Accounts',
            href: '/accounting/student-accounts',
            icon: Users,
        },
        {
            title: 'Payment Processing',
            href: '/accounting/payments',
            icon: CreditCard,
        },
        {
            title: 'Student Clearance',
            href: '/accounting/clearance',
            icon: ClipboardCheck,
        },
        {
            title: 'Online Transactions',
            href: '/accounting/online-transactions',
            icon: Globe,
            badge: pendingOnlineTransactionCount || undefined,
        },
        // {
        //     title: 'Document Request',
        //     href: '/accounting/document-requests',
        //     icon: FileText,
        // },
        {
            title: 'Document Request',
            href: '/accounting/document-approvals',
            icon: FileCheck,
            badge: pendingDocumentCount || undefined,
        },
        {
            title: 'Promissory Notes',
            href: '/accounting/promissory-notes',
            icon: ScrollText,
            badge: pendingPromissoryCount || undefined,
        },
        {
            title: 'Student Grants',
            href: '/accounting/grants',
            icon: Gift,
        },
        {
            title: 'Masterlist',
            href: '/accounting/masterlist',
            icon: Rows3,
        },
        {
            title: 'Exam Approval',
            href: '/accounting/exam-approval',
            icon: FileCheck,
        },
        {
            title: 'Drop Requests',
            href: '/accounting/drop-requests',
            icon: UserX,
            badge: pendingDropRequestCount || undefined,
        },
        {
            title: 'Transfer Requests',
            href: '/accounting/transfer-requests',
            icon: UserX,
            badge: pendingTransferRequestCount || undefined,
        },
        {
            title: 'Calendar View',
            href: '/accounting/calendar',
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
                            <Link href="/accounting/dashboard">
                                {logoUrl ? (
                                    <img src={logoUrl} alt={appName} className="size-8 rounded-lg object-contain bg-white" />
                                ) : (
                                    <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                                        <PhilippinePeso className="size-4" />
                                    </div>
                                )}
                                <div className="grid flex-1 text-left text-sm leading-tight">
                                    <span className="truncate font-semibold">{appName}</span>
                                    <span className="truncate text-xs">Accounting Portal</span>
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
