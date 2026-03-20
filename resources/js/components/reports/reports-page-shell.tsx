import { PageHeader } from '@/components/page-header';

type ReportsPageShellProps = {
    title: string;
    description: string;
    action?: import('react').ReactNode;
    children: import('react').ReactNode;
};

export function ReportsPageShell({ title, description, action, children }: ReportsPageShellProps) {
    return (
        <div className="space-y-6 p-6">
            <PageHeader title={title} description={description} action={action} />
            {children}
        </div>
    );
}
