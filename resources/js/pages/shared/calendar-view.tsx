import { Head, router } from '@inertiajs/react';
import { Calendar as CalendarIcon, FileText } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import AccountingLayout from '@/layouts/accounting-layout';
import OwnerLayout from '@/layouts/owner/owner-layout';
import RegistrarLayout from '@/layouts/registrar/registrar-layout';
import SuperAccountingLayout from '@/layouts/super-accounting/super-accounting-layout';
import { cn } from '@/lib/utils';

type RolePrefix = 'owner' | 'registrar' | 'accounting' | 'super-accounting';

interface CalendarEvent {
    id: string | number;
    title: string;
    date: string;
    type: 'deadline' | 'requirement';
    classification?: string;
    requirements_count?: number;
    description?: string;
}

interface CalendarViewProps {
    rolePrefix: RolePrefix;
    events: CalendarEvent[];
    currentMonth: number;
    currentYear: number;
    monthName: string;
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

export default function CalendarView({ rolePrefix, events, currentMonth, currentYear, monthName }: CalendarViewProps) {
    const [selectedDate, setSelectedDate] = useState<string | null>(null);

    const basePath = `/${rolePrefix}/calendar`;

    const moveMonth = (direction: -1 | 1) => {
        const anchor = new Date(currentYear, currentMonth - 1, 1);
        anchor.setMonth(anchor.getMonth() + direction);

        router.get(basePath, {
            month: anchor.getMonth() + 1,
            year: anchor.getFullYear(),
        }, {
            preserveScroll: true,
            preserveState: true,
        });
    };

    const getDaysInMonth = () => {
        const firstDay = new Date(currentYear, currentMonth - 1, 1);
        const lastDay = new Date(currentYear, currentMonth, 0);
        const daysInMonth = lastDay.getDate();
        const startingDayOfWeek = firstDay.getDay();

        const days: Array<number | null> = [];
        for (let i = 0; i < startingDayOfWeek; i++) {
            days.push(null);
        }

        for (let i = 1; i <= daysInMonth; i++) {
            days.push(i);
        }

        return days;
    };

    const getEventsForDate = (day: number): CalendarEvent[] => {
        const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        return events.filter((event) => event.date === dateStr);
    };

    const selectedEvents = selectedDate ? events.filter((event) => event.date === selectedDate) : [];

    return (
        <RoleLayout rolePrefix={rolePrefix}>
            <Head title="Calendar View" />

            <div className="space-y-6 p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-foreground">Calendar View</h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Combined registrar deadlines and requirement due dates
                        </p>
                    </div>
                    <div className="flex items-center space-x-3">
                        <Button variant="outline" onClick={() => moveMonth(-1)}>Previous</Button>
                        <span className="text-lg font-semibold">{monthName}</span>
                        <Button variant="outline" onClick={() => moveMonth(1)}>Next</Button>
                    </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-3">
                    <Card className="lg:col-span-2">
                        <CardHeader>
                            <CardTitle>Calendar View</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-7 gap-2">
                                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                                    <div key={day} className="p-2 text-center text-sm font-semibold text-muted-foreground">
                                        {day}
                                    </div>
                                ))}

                                {getDaysInMonth().map((day, index) => {
                                    if (day === null) {
                                        return <div key={`empty-${index}`} className="p-2" />;
                                    }

                                    const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                    const dayEvents = getEventsForDate(day);
                                    const hasEvents = dayEvents.length > 0;

                                    return (
                                        <button
                                            key={day}
                                            onClick={() => setSelectedDate(dateStr)}
                                            className={cn(
                                                'aspect-square rounded-lg border p-2 text-left transition-colors hover:bg-muted',
                                                selectedDate === dateStr && 'bg-primary text-primary-foreground',
                                                hasEvents && 'border-primary',
                                            )}
                                        >
                                            <div className="text-sm font-semibold">{day}</div>
                                            {hasEvents && (
                                                <div className="mt-1 flex flex-wrap gap-1">
                                                    {dayEvents.slice(0, 2).map((event, idx) => (
                                                        <div
                                                            key={`${event.id}-${idx}`}
                                                            className={cn(
                                                                'h-1.5 w-1.5 rounded-full',
                                                                event.type === 'deadline' ? 'bg-red-500' : 'bg-blue-500',
                                                            )}
                                                        />
                                                    ))}
                                                    {dayEvents.length > 2 && (
                                                        <span className="text-xs">+{dayEvents.length - 2}</span>
                                                    )}
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>
                                {selectedDate
                                    ? new Date(selectedDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                                    : 'Select a Date'}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {selectedEvents.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No events scheduled for this date</p>
                            ) : (
                                selectedEvents.map((event) => (
                                    <div key={event.id} className="space-y-2 rounded-lg border p-3">
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-center gap-2">
                                                <FileText className={cn('h-4 w-4', event.type === 'deadline' ? 'text-red-500' : 'text-blue-500')} />
                                                <Badge variant={event.type === 'deadline' ? 'destructive' : 'secondary'}>
                                                    {event.type}
                                                </Badge>
                                            </div>
                                        </div>
                                        <h4 className="font-semibold">{event.title}</h4>
                                        {event.description && (
                                            <p className="text-sm text-muted-foreground">{event.description}</p>
                                        )}
                                        {event.classification && (
                                            <p className="text-sm text-muted-foreground">Classification: {event.classification}</p>
                                        )}
                                        {event.requirements_count && event.requirements_count > 0 && (
                                            <p className="text-sm text-muted-foreground">Requirements: {event.requirements_count}</p>
                                        )}
                                    </div>
                                ))
                            )}
                        </CardContent>
                    </Card>
                </div>

                <Card>
                    <CardContent className="flex items-center gap-6 p-4">
                        <div className="flex items-center gap-2">
                            <div className="h-3 w-3 rounded-full bg-red-500" />
                            <span className="text-sm">Academic Deadlines</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="h-3 w-3 rounded-full bg-blue-500" />
                            <span className="text-sm">Requirement Deadlines</span>
                        </div>
                        <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
                            <CalendarIcon className="h-4 w-4" />
                            <span>{events.length} event{events.length === 1 ? '' : 's'} this month</span>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </RoleLayout>
    );
}
