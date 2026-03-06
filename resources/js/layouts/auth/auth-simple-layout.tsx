import { Link } from '@inertiajs/react';
import { FlashMessages } from '@/components/flash-messages';
import { home } from '@/routes';
import type { AuthLayoutProps } from '@/types';

export default function AuthSimpleLayout({
    children,
    title,
    description,
}: AuthLayoutProps) {
    return (
        <>
            <FlashMessages />
            {/* Full-page background with decorative shapes */}
            <div className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden bg-sky-50 p-6 md:p-10">
                {/* Decorative background shapes */}
                <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
                    {/* Large circle top-left */}
                    <div className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-sky-200/50" />
                    {/* Medium rounded square top-right */}
                    <div className="absolute -right-16 top-10 h-56 w-56 rounded-3xl bg-blue-100/60 rotate-12" />
                    {/* Small circle mid-left */}
                    <div className="absolute left-8 top-1/2 h-20 w-20 rounded-full bg-indigo-100/70" />
                    {/* Large rounded square bottom-right */}
                    <div className="absolute -bottom-24 -right-12 h-80 w-80 rounded-3xl bg-sky-200/40 -rotate-6" />
                    {/* Medium circle bottom-left */}
                    <div className="absolute -bottom-16 left-16 h-52 w-52 rounded-full bg-blue-100/50" />
                    {/* Tiny circle center-right */}
                    <div className="absolute right-1/4 top-1/3 h-10 w-10 rounded-full bg-sky-300/40" />
                    {/* Thin rounded rect mid-top */}
                    <div className="absolute left-1/3 top-4 h-8 w-32 rounded-full bg-indigo-100/50 rotate-12" />
                </div>

                {/* Card */}
                <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white/90 shadow-xl shadow-sky-100 backdrop-blur-sm p-8">
                    <div className="flex flex-col gap-8">
                        <div className="flex flex-col items-center gap-4">
                            <Link href={home()} className="flex flex-col items-center gap-2 font-medium">
                                <span className="sr-only">{title}</span>
                            </Link>
                            {(title || description) && (
                                <div className="space-y-2 text-center">
                                    {title && <h1 className="text-xl font-medium">{title}</h1>}
                                    {description && (
                                        <p className="text-center text-sm text-muted-foreground">{description}</p>
                                    )}
                                </div>
                            )}
                        </div>
                        {children}
                    </div>
                </div>

                {/* Subtle dot pattern overlay */}
                <div aria-hidden className="pointer-events-none absolute inset-0"
                    style={{ backgroundImage: 'radial-gradient(circle, #bae6fd 1px, transparent 1px)', backgroundSize: '32px 32px', opacity: 0.3 }}
                />
            </div>
        </>
    );
}
