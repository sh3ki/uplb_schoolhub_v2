import { PropsWithChildren } from 'react';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { SuperAccountingSidebar } from '@/components/super-accounting/super-accounting-sidebar';
import { FlashMessages } from '@/components/flash-messages';

export default function SuperAccountingLayout({ children }: PropsWithChildren) {
    return (
        <SidebarProvider>
            <SuperAccountingSidebar />
            <SidebarInset>{children}</SidebarInset>
            <FlashMessages />
        </SidebarProvider>
    );
}
