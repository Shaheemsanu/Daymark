import { createClient } from 'npm:@supabase/supabase-js@2';
import { importPKCS8, SignJWT } from 'npm:jose@6';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, 'Content-Type': 'application/json' },
});

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return reply({ error: 'Method not allowed' }, 405);
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return reply({ error: 'Sign in first.' }, 401);
  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const credentials = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
  if (!url || !anonKey || !serviceKey || !credentials) return reply({ error: 'Server configuration is incomplete.' }, 500);

  const client = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) return reply({ error: 'Invalid session.' }, 401);
  const { data: tokens, error: tokenError } = await client.from('push_tokens').select('token').eq('user_id', user.id);
  if (tokenError) return reply({ error: 'Could not load device registrations.' }, 500);
  if (!tokens?.length) return reply({ error: 'Enable notifications on a device first.' }, 404);

  try {
    const admin = createClient(url, serviceKey);
    const { data: notice, error: noticeError } = await admin.from('notifications').insert({ user_id: user.id, title: 'Daymark test', body: 'Notifications are working on this device.', view: 'history' }).select('id').single();
    if (noticeError) throw new Error('Could not save notification history');
    const account = JSON.parse(credentials);
    const key = await importPKCS8(account.private_key, 'RS256');
    const assertion = await new SignJWT({ scope: 'https://www.googleapis.com/auth/firebase.messaging' })
      .setProtectedHeader({ alg: 'RS256', typ: 'JWT' }).setIssuer(account.client_email)
      .setAudience('https://oauth2.googleapis.com/token').setIssuedAt().setExpirationTime('1h').sign(key);
    const oauth = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
    });
    if (!oauth.ok) throw new Error('Firebase authentication failed');
    const { access_token: accessToken } = await oauth.json();
    const icon = 'https://daymarks.ai.studio/daymark-icon-192.png';
    let sent = 0;
    for (const { token } of tokens) {
      const response = await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(account.project_id)}/messages:send`, {
        method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: { token, notification: { title: 'Daymark test', body: 'Notifications are working on this device.' }, ...(icon ? { webpush: { notification: { title: 'Daymark test', body: 'Notifications are working on this device.', icon } } } : {}), data: { notification_id: notice.id, view: 'history' } } }),
      });
      if (response.ok) sent++;
      else console.error('FCM send failed:', response.status, await response.text());
    }
    if (!sent) return reply({ error: 'Firebase could not send the notification. Check the function logs.' }, 502);
    return reply({ sent, total: tokens.length });
  } catch (error) {
    console.error('Push test failed:', error instanceof Error ? error.message : 'Unknown error');
    return reply({ error: 'Could not send the test notification. Check the function logs.' }, 500);
  }
});
