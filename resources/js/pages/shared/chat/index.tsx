import { Head } from '@inertiajs/react';
import { MessageCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import AccountingLayout from '@/layouts/accounting-layout';
import OwnerLayout from '@/layouts/owner/owner-layout';
import RegistrarLayout from '@/layouts/registrar/registrar-layout';
import SuperAccountingLayout from '@/layouts/super-accounting/super-accounting-layout';

type RolePrefix = 'owner' | 'registrar' | 'accounting' | 'super-accounting';

interface SharedChatProps {
    rolePrefix: RolePrefix;
}

function RoleLayout({ rolePrefix, children }: { rolePrefix: RolePrefix; children: React.ReactNode }) {
    if (rolePrefix === 'super-accounting') {
        return <SuperAccountingLayout>{children}</SuperAccountingLayout>;
    }

    if (rolePrefix === 'registrar') {
        return <RegistrarLayout>{children}</RegistrarLayout>;
    }

    if (rolePrefix === 'accounting') {
        return <AccountingLayout>{children}</AccountingLayout>;
    }

    return <OwnerLayout>{children}</OwnerLayout>;
}

export default function SharedChatIndex({ rolePrefix }: SharedChatProps) {
    return (
        <RoleLayout rolePrefix={rolePrefix}>
            <Head title="Chat" />
            <div className="p-6">
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                        <MessageCircle className="mb-4 h-12 w-12 text-muted-foreground" />
                        <h2 className="text-xl font-semibold">Chat</h2>
                        <p className="mt-2 text-muted-foreground">Reusable chat page is ready. Real-time messaging integration can be connected next.</p>
                    </CardContent>
                </Card>
            </div>
        </RoleLayout>
    );
}
