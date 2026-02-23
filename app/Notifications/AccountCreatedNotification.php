<?php

namespace App\Notifications;

use App\Models\AppSetting;
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Support\Facades\Storage;

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
        $logoUrl      = $settings->logo_url ?? null;

        // Gmail blocks external/localhost images — encode logo as base64 data URI so it always displays
        $logoInline = null;
        if (!empty($settings->logo_path) && Storage::disk('public')->exists($settings->logo_path)) {
            $mime       = Storage::disk('public')->mimeType($settings->logo_path) ?: 'image/png';
            $data       = base64_encode(Storage::disk('public')->get($settings->logo_path));
            $logoInline = "data:{$mime};base64,{$data}";
        }

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
                'logoUrl'         => $logoInline ?? $logoUrl,
            ]);
    }
}
