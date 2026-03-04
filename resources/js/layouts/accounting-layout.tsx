import { usePage } from '@inertiajs/react';
import { useEffect } from 'react';
import { AccountingSidebar } from '@/components/accounting/accounting-sidebar';
import { FlashMessages } from '@/components/flash-messages';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';

export default function AccountingLayout({ children }: { children: React.ReactNode }) {
    const appSettings = (usePage().props as any).appSettings;
    const sidebarColor = appSettings?.sidebar_color;
    const sidebarFontSize = appSettings?.sidebar_font_size;

    useEffect(() => {
        if (sidebarColor) {
            document.documentElement.style.setProperty('--sidebar', sidebarColor);
        }
        if (sidebarFontSize) {
            document.documentElement.style.setProperty('--sidebar-font-size', sidebarFontSize + 'px');
        }
    }, [sidebarColor, sidebarFontSize]);

    return (
        <SidebarProvider>
            <AccountingSidebar />
            <SidebarInset>{children}</SidebarInset>
            <FlashMessages />
        </SidebarProvider>
    );
}
