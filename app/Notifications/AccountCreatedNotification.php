<?php

namespace App\Notifications;

use App\Models\AppSetting;
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class AccountCreatedNotification extends VerifyEmail
{
    public function __construct(
        private readonly string $loginIdentifier,
        private readonly string $initialPassword = 'password'
    ) {}

    public function toMail(mixed $notifiable): MailMessage
    {
        $verificationUrl = $this->verificationUrl($notifiable);

        $settings     = AppSetting::current();
        $appName      = $settings->app_name ?? config('app.name');
        $primaryColor = $settings->primary_color ?? '#1d4ed8';
        $logoUrl      = $this->resolveLogoUrl($settings);

        return (new MailMessage)
            ->subject("Welcome to {$appName} — Please Verify Your Email")
            ->from(config('mail.from.address'), "Office of the Registrar — {$appName}")
            ->view('emails.account-created', [
                'verificationUrl' => $verificationUrl,
                'notifiable'      => $notifiable,
                'loginIdentifier' => $this->loginIdentifier,
                'initialPassword' => $this->initialPassword,
                'appName'         => $appName,
                'primaryColor'    => $primaryColor,
                'logoUrl'         => $logoUrl,
            ]);
    }

    private function resolveLogoUrl(?AppSetting $settings): ?string
    {
        if (!$settings) {
            return null;
        }

        $logoUrl = $settings->logo_url;

        if (!$logoUrl && !empty($settings->logo_path) && Storage::disk('public')->exists($settings->logo_path)) {
            $logoUrl = Storage::url($settings->logo_path);
        }

        if (!$logoUrl) {
            return null;
        }

        if (Str::startsWith($logoUrl, ['http://', 'https://'])) {
            return $logoUrl;
        }

        return url($logoUrl);
    }
}
