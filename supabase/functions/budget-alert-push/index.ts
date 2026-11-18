import { withSupabase } from 'npm:@supabase/server@1';
import { importPKCS8, SignJWT } from 'npm:jose@6';

// Only a trusted Supabase webhook may invoke this function.
export default {
  fetch: withSupabase({ auth: 'secret' }, async (request, { supabaseAdmin: db }) => {
    if (request.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
    let payload;
    try { payload = await request.json(); } catch { return Response.json({ error: 'Invalid request' }, { status: 400 }); }
    if (payload.type !== 'INSERT' || payload.schema !== 'public' || payload.table !== 'notifications' || !payload.record?.id) return Response.json({ skipped: true });
    const { data: notice, error } = await db.from('notifications').select('id,user_id,title,body,view,kind').eq('id', payload.record.id).maybeSingle();
    if (error) {
      console.error('Could not load budget notification', error.message);
      return Response.json({ error: 'Could not load notification' }, { status: 500 });
    }
    if (!notice || notice.kind !== 'budget_alert') return Response.json({ skipped: true });
    const credentials = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
    if (!credentials) return Response.json({ error: 'Firebase credential missing' }, { status: 500 });
    try {
      const { data: tokens, error: tokenError } = await db.from('push_tokens').select('token').eq('user_id', notice.user_id);
      if (tokenError) throw tokenError;
      if (!tokens?.length) {
        console.error('Budget alert has no registered devices');
        return Response.json({ error: 'No registered devices for this notification.' }, { status: 404 });
      }
      const account = JSON.parse(credentials);
      const key = await importPKCS8(account.private_key, 'RS256');
      const assertion = await new SignJWT({ scope: 'https://www.googleapis.com/auth/firebase.messaging' })
        .setProtectedHeader({ alg: 'RS256', typ: 'JWT' }).setIssuer(account.client_email)
        .setAudience('https://oauth2.googleapis.com/token').setIssuedAt().setExpirationTime('1h').sign(key);
      const oauth = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }) });
      if (!oauth.ok) throw new Error('Firebase authentication failed');
      const { access_token: accessToken } = await oauth.json();
      let sent = 0;
      for (const { token } of tokens) {
        const response = await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(account.project_id)}/messages:send`, {
          method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: { token, notification: { title: notice.title, body: notice.body }, data: { notification_id: notice.id, view: notice.view || 'expenses' } } }),
        });
        if (response.ok) sent++;
        else {
          // Log the FCM error code without logging the device token or notification text.
          const result = await response.json().catch(() => null);
          console.error('Budget alert delivery failed', response.status, result?.error?.status || 'Unknown FCM error');
        }
      }
      if (!sent) return Response.json({ error: 'No push messages were accepted by Firebase.' }, { status: 502 });
      return Response.json({ sent, total: tokens.length });
    } catch (err) {
      console.error('Budget alert failed', err instanceof Error ? err.message : 'Unknown error');
      return Response.json({ error: 'Budget alert could not be sent.' }, { status: 500 });
    }
  }),
};
