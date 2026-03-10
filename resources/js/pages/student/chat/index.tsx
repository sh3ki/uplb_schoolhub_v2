import { Head } from '@inertiajs/react';
import { MessageCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import StudentLayout from '@/layouts/student/student-layout';

export default function ChatIndex() {
    return (
        <StudentLayout>
            <Head title="Chat" />
            <div className="p-6">
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                        <MessageCircle className="h-12 w-12 text-muted-foreground mb-4" />
                        <h2 className="text-xl font-semibold">Chat</h2>
                        <p className="text-muted-foreground mt-2">Coming soon. This feature is under development.</p>
                    </CardContent>
                </Card>
            </div>
        </StudentLayout>
    );
}
