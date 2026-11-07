import type { Env } from '../env';

export type EmailStatus = 'sent' | 'failed' | 'not_configured';

export interface LoginDetails {
  memberName: string;
  email: string;
  phone: string;
  teamName: string;
  teamPassword: string;
}

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export function isEmailConfigured(env: Env): boolean {
  return Boolean(env.RESEND_API_KEY && env.RESEND_API_KEY.trim());
}

export function buildLoginEmail(env: Env, d: LoginDetails): { subject: string; text: string; html: string } {
  const event = env.EVENT_NAME || 'Tech Arena';
  const appUrl = env.APP_URL?.trim();
  const apkUrl = env.APK_URL?.trim();
  const subject = `${event}: your login for team ${d.teamName}`;

  const text = [
    `Hi ${d.memberName},`,
    '',
    `You have been added to team "${d.teamName}" for ${event}.`,
    '',
    'Your login:',
    `  Phone: ${d.phone}`,
    `  Team password: ${d.teamPassword}`,
    '',
    'Get the app:',
    appUrl ? `  iPhone: open ${appUrl} in Safari, tap Share, then "Add to Home Screen".` : null,
    apkUrl ? `  Android: download and install the APK from ${apkUrl}` : null,
    !appUrl && !apkUrl ? '  Ask your team lead for the app link.' : null,
    '',
    'See you at the expo!',
  ]
    .filter((line): line is string => line !== null)
    .join('\n');

  const link = (url: string) => `<a href="${escapeHtml(url)}">${escapeHtml(url)}</a>`;
  const html = `<!doctype html><html><body style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#111;line-height:1.5">
<h2 style="margin:0 0 12px">${escapeHtml(event)}</h2>
<p>Hi ${escapeHtml(d.memberName)},</p>
<p>You have been added to team <strong>${escapeHtml(d.teamName)}</strong>.</p>
<p><strong>Your login</strong><br>Phone: <code>${escapeHtml(d.phone)}</code><br>Team password: <code>${escapeHtml(d.teamPassword)}</code></p>
<p><strong>Get the app</strong><br>
${appUrl ? `iPhone: open ${link(appUrl)} in Safari, tap Share, then &ldquo;Add to Home Screen&rdquo;.<br>` : ''}
${apkUrl ? `Android: download and install the APK from ${link(apkUrl)}<br>` : ''}
${!appUrl && !apkUrl ? 'Ask your team lead for the app link.' : ''}
</p>
<p>See you at the expo!</p>
</body></html>`;

  return { subject, text, html };
}

export async function sendLoginEmail(
  env: Env,
  details: LoginDetails,
): Promise<{ status: EmailStatus; error?: string }> {
  if (!isEmailConfigured(env)) return { status: 'not_configured' };
  const { subject, text, html } = buildLoginEmail(env, details);
  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY!.trim()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: env.MAIL_FROM || 'Tech Arena <onboarding@resend.dev>',
        to: [details.email],
        subject,
        text,
        html,
      }),
    });
    if (res.ok) return { status: 'sent' };
    let message = `Email provider returned ${res.status}`;
    try {
      const body = (await res.json()) as { message?: unknown };
      if (typeof body.message === 'string' && body.message) message = body.message;
    } catch {
      // keep the status-based message
    }
    return { status: 'failed', error: message };
  } catch (err) {
    return { status: 'failed', error: err instanceof Error ? err.message : 'Network error' };
  }
}
