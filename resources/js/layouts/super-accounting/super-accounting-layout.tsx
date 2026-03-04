import { usePage } from '@inertiajs/react';
import { useEffect, type PropsWithChildren } from 'react';
import { FlashMessages } from '@/components/flash-messages';
import { SuperAccountingSidebar } from '@/components/super-accounting/super-accounting-sidebar';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';

export default function SuperAccountingLayout({ children }: PropsWithChildren) {
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
            <SuperAccountingSidebar />
            <SidebarInset>{children}</SidebarInset>
            <FlashMessages />
        </SidebarProvider>
    );
}
