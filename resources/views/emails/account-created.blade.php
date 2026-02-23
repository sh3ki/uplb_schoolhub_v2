<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Welcome to {{ $appName }}</title>
    <style>
        body  { margin: 0; padding: 0; background: #f4f6f9; font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; color: #1a1a2e; }
        .wrap { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,.08); }
        /* Header */
        .header { background: {{ $primaryColor }}; padding: 36px 40px 28px; text-align: center; }
        .header h1 { margin: 0 0 4px; color: #fff; font-size: 22px; font-weight: 700; letter-spacing: .3px; }
        .header p  { margin: 0; color: rgba(255,255,255,.80); font-size: 13px; }
        /* Body */
        .body { padding: 36px 40px; }
        .greeting { font-size: 17px; font-weight: 600; margin-bottom: 6px; }
        .intro    { font-size: 14px; color: #4a5568; line-height: 1.6; margin-bottom: 28px; }
        /* Credentials card */
        .cred-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 20px 24px; margin-bottom: 28px; }
        .cred-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .8px; color: #718096; margin-bottom: 14px; }
        .cred-row   { display: flex; align-items: center; padding: 8px 0; border-bottom: 1px solid #e2e8f0; }
        .cred-row:last-child { border-bottom: none; }
        .cred-label { font-size: 12px; color: #718096; width: 90px; flex-shrink: 0; }
        .cred-value { font-size: 14px; font-weight: 600; color: #1a202c; font-family: 'Consolas', 'Courier New', monospace; word-break: break-all; }
        .cred-badge { display: inline-block; background: #fef3c7; color: #92400e; border-radius: 4px; font-size: 11px; font-weight: 600; padding: 2px 8px; margin-left: 8px; }
        /* Notice */
        .notice { background: #fffbeb; border-left: 4px solid #f59e0b; padding: 10px 14px; border-radius: 0 6px 6px 0; margin-bottom: 28px; font-size: 13px; color: #78350f; line-height: 1.5; }
        /* Button */
        .btn-wrap { text-align: center; margin-bottom: 28px; }
        .btn { display: inline-block; background: {{ $primaryColor }}; color: #ffffff !important; text-decoration: none; padding: 14px 36px; border-radius: 8px; font-size: 15px; font-weight: 600; letter-spacing: .2px; }
        /* Expiry */
        .expiry { font-size: 13px; color: #718096; text-align: center; margin-bottom: 20px; }
        .expiry span { font-weight: 600; color: #4a5568; }
        /* Divider */
        hr { border: none; border-top: 1px solid #e2e8f0; margin: 24px 0; }
        /* Footer */
        .footer { background: #f8fafc; padding: 20px 40px; border-top: 1px solid #e2e8f0; text-align: center; }
        .footer p { margin: 0; font-size: 12px; color: #a0aec0; line-height: 1.6; }
        .footer strong { color: #718096; }
    </style>
</head>
<body>
    <div class="wrap">
        <!-- Header -->
        <div class="header">
            <h1>{{ $appName }}</h1>
            <p>Office of the Registrar</p>
        </div>

        <!-- Body -->
        <div class="body">
            <p class="greeting">Hello, {{ $notifiable->name }}!</p>
            <p class="intro">
                Your student account has been created by the <strong>Office of the Registrar</strong>.
                Use the credentials below to sign in to the portal. Please keep this information private.
            </p>

            <!-- Credentials Card -->
            <div class="cred-card">
                <div class="cred-title">Your Login Credentials</div>

                <div class="cred-row">
                    <span class="cred-label">Username</span>
                    <span class="cred-value">{{ $loginIdentifier }}</span>
                </div>
                <div class="cred-row">
                    <span class="cred-label">Email</span>
                    <span class="cred-value">{{ $notifiable->email }}</span>
                </div>
                <div class="cred-row">
                    <span class="cred-label">Password</span>
                    <span class="cred-value">{{ $initialPassword }}</span>
                    <span class="cred-badge">Temporary</span>
                </div>
            </div>

            <!-- Change password notice -->
            <div class="notice">
                ⚠️ &nbsp;For your security, please change your password immediately after your first login.
            </div>

            <!-- Verify button -->
            <p style="font-size:14px;color:#4a5568;text-align:center;margin-bottom:16px;">
                Click the button below to verify your email and activate your account:
            </p>
            <div class="btn-wrap">
                <a href="{{ $verificationUrl }}" class="btn">Verify My Email Address</a>
            </div>

            <p class="expiry">
                This verification link expires in <span>60 minutes</span>.
            </p>

            <hr />

            <p style="font-size:13px;color:#718096;text-align:center;">
                If you were not expecting this email, you can safely ignore it.<br />
                If you have questions, please contact the Registrar's Office.
            </p>
        </div>

        <!-- Footer -->
        <div class="footer">
            <p><strong>Office of the Registrar</strong> &mdash; {{ $appName }}</p>
            <p style="margin-top:4px;">This is an automated message. Please do not reply directly to this email.</p>
        </div>
    </div>
</body>
</html>
