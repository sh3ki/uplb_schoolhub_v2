import { Transition } from '@headlessui/react';
import { Link, useForm, usePage } from '@inertiajs/react';
import { Camera, Trash2 } from 'lucide-react';
import { useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { send } from '@/routes/verification';
import type { SharedData } from '@/types';

interface ProfileFormProps {
    mustVerifyEmail: boolean;
    status?: string;
}

const roleSettingsMap: Record<string, string> = {
    owner: '/owner/settings/profile',
    registrar: '/registrar/settings/profile',
    accounting: '/accounting/settings/profile',
    'super-accounting': '/super-accounting/settings/profile',
    student: '/student/settings/profile',
    teacher: '/teacher/settings/profile',
    parent: '/parent/settings/profile',
    guidance: '/guidance/settings/profile',
    librarian: '/librarian/settings/profile',
    clinic: '/clinic/settings/profile',
    canteen: '/canteen/settings/profile',
};

export default function ProfileForm({ mustVerifyEmail, status }: ProfileFormProps) {
    const { auth } = usePage<SharedData>().props;
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    const settingsUrl = useMemo(() => {
        const role = String(auth.user.role || '').trim();
        return roleSettingsMap[role] || '/settings/profile';
    }, [auth.user.role]);

    const form = useForm({
        name: auth.user.name || '',
        email: auth.user.email || '',
        profile_photo: null as File | null,
        remove_profile_photo: false,
    });

    const avatarSrc = previewUrl || (!form.data.remove_profile_photo ? (auth.user.avatar as string | undefined) : undefined);

    const handlePhotoChange = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] || null;
        form.setData('profile_photo', file);

        if (file) {
            form.setData('remove_profile_photo', false);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const handleRemovePhoto = () => {
        form.setData('profile_photo', null);
        form.setData('remove_profile_photo', true);
        setPreviewUrl(null);
    };

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();

        form.transform((data) => ({
            ...data,
            _method: 'patch',
        }));

        form.post(settingsUrl, {
            preserveScroll: true,
            forceFormData: true,
            onSuccess: () => {
                form.setData('profile_photo', null);
                setPreviewUrl(null);
            },
            onFinish: () => {
                form.transform((data) => data);
            },
        });
    };

    return (
        <div className="space-y-6">
            <Heading
                variant="small"
                title="Profile information"
                description="Update your name, email, and profile photo"
            />

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
                    <div className="flex flex-col items-center gap-3">
                        <Avatar className="h-24 w-24">
                            <AvatarImage src={avatarSrc} alt={auth.user.name} />
                            <AvatarFallback className="text-lg">
                                {auth.user.name
                                    .split(' ')
                                    .map((part) => part[0])
                                    .join('')
                                    .slice(0, 2)
                                    .toUpperCase()}
                            </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-wrap items-center justify-center gap-2">
                            <Label
                                htmlFor="profile_photo"
                                className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
                            >
                                <Camera className="h-4 w-4" />
                                Change
                            </Label>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={handleRemovePhoto}
                            >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Remove
                            </Button>
                        </div>
                        <Input
                            id="profile_photo"
                            type="file"
                            accept="image/png,image/jpeg,image/jpg,image/webp"
                            className="hidden"
                            onChange={handlePhotoChange}
                        />
                        <InputError className="mt-1" message={form.errors.profile_photo} />
                    </div>

                    <div className="space-y-6">
                        <div className="grid gap-2">
                            <Label htmlFor="name">Name</Label>

                            <Input
                                id="name"
                                className="mt-1 block w-full"
                                value={form.data.name}
                                onChange={(e) => form.setData('name', e.target.value)}
                                required
                                autoComplete="name"
                                placeholder="Full name"
                            />

                            <InputError className="mt-2" message={form.errors.name} />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="email">Email address</Label>

                            <Input
                                id="email"
                                type="email"
                                className="mt-1 block w-full"
                                value={form.data.email}
                                onChange={(e) => form.setData('email', e.target.value)}
                                required
                                autoComplete="username"
                                placeholder="Email address"
                            />

                            <InputError className="mt-2" message={form.errors.email} />
                        </div>
                    </div>
                </div>

                {mustVerifyEmail && auth.user.email_verified_at === null && (
                    <div>
                        <p className="-mt-4 text-sm text-muted-foreground">
                            Your email address is unverified.{' '}
                            <Link
                                href={send()}
                                as="button"
                                className="text-foreground underline decoration-neutral-300 underline-offset-4 transition-colors duration-300 ease-out hover:decoration-current! dark:decoration-neutral-500"
                            >
                                Click here to resend the verification email.
                            </Link>
                        </p>

                        {status === 'verification-link-sent' && (
                            <div className="mt-2 text-sm font-medium text-green-600">
                                A new verification link has been sent to your email address.
                            </div>
                        )}
                    </div>
                )}

                <div className="flex items-center gap-4">
                    <Button disabled={form.processing}>Save</Button>

                    <Transition
                        show={form.recentlySuccessful}
                        enter="transition ease-in-out"
                        enterFrom="opacity-0"
                        leave="transition ease-in-out"
                        leaveTo="opacity-0"
                    >
                        <p className="text-sm text-neutral-600">Saved</p>
                    </Transition>
                </div>
            </form>
        </div>
    );
}
