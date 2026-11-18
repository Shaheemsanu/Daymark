import { withSupabase } from 'npm:@supabase/server@1';
import { importPKCS8, SignJWT } from 'npm:jose@6';

export default {
  fetch: withSupabase({ auth: 'secret' }, async (_req, { supabaseAdmin: db }) => {
    const credentials = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
    let account: { private_key: string; client_email: string; project_id: string } | undefined;
    let accessToken: string | undefined;
    try {
      if (!credentials) throw new Error('Firebase credential missing');
      const parsedAccount = JSON.parse(credentials) as { private_key: string; client_email: string; project_id: string };
      account = parsedAccount;
      const key = await importPKCS8(parsedAccount.private_key, 'RS256');
      const assertion = await new SignJWT({ scope: 'https://www.googleapis.com/auth/firebase.messaging' })
        .setProtectedHeader({ alg: 'RS256', typ: 'JWT' }).setIssuer(parsedAccount.client_email)
        .setAudience('https://oauth2.googleapis.com/token').setIssuedAt().setExpirationTime('1h').sign(key);
      const oauth = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }) });
      if (!oauth.ok) throw new Error('Firebase authentication failed');
      accessToken = (await oauth.json()).access_token;
    } catch (error) { console.error('Push unavailable; saving reminder history', error instanceof Error ? error.message : 'Unknown error'); }
    const { data: preferences, error } = await db.from('reminder_preferences').select('user_id,timezone').eq('enabled', true);
    if (error) return Response.json({ error: 'Could not load reminders' }, { status: 500 });
    let created = 0;
    for (const pref of preferences || []) {
      try {
        const now = new Date();
        const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: pref.timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
        const parts = formatter.formatToParts(now);
        const part = (name: string) => parts.find(p => p.type === name)?.value || '';
        const hour = part('hour');
        const targetParts = formatter.formatToParts(new Date(now.getTime() + 30 * 60 * 1000));
        const targetPart = (name: string) => targetParts.find(p => p.type === name)?.value || '';
        const date = `${targetPart('year')}-${targetPart('month')}-${targetPart('day')}`;
        const targetTime = `${targetPart('hour')}:${targetPart('minute')}`;
        const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
        const [taskResult, habitResult, entryResult, trackerResult, expenseResult, tokenResult] = await Promise.all([
          db.from('task_entries').select('task_id,status').eq('user_id', pref.user_id).eq('entry_date', date),
          db.from('custom_trackers').select('id,name,weekdays,start_time').eq('user_id', pref.user_id).eq('type', 'boolean'),
          db.from('tracker_entries').select('tracker_id,boolean_value').eq('user_id', pref.user_id).eq('entry_date', date),
          db.from('tasks').select('id,title,is_active,start_time,weekdays').eq('user_id', pref.user_id),
          db.from('expenses').select('id').eq('user_id', pref.user_id).eq('entry_date', date).eq('transaction_type', 'expense').eq('is_transfer', false).limit(1),
          db.from('push_tokens').select('token').eq('user_id', pref.user_id),
        ]);
        if ([taskResult, habitResult, entryResult, trackerResult, expenseResult, tokenResult].some(result => result.error)) throw new Error('Could not load reminder data');
        const status = new Map((taskResult.data || []).map(row => [row.task_id, row.status]));
        const pending = (trackerResult.data || []).filter(row => row.is_active && (row.weekdays || [0, 1, 2, 3, 4, 5, 6]).includes(weekday) && (status.get(row.id) || 'pending') === 'pending');
        const pendingTasks = pending.length;
        const completed = new Set((entryResult.data || []).filter(row => row.boolean_value).map(row => row.tracker_id));
        const pendingHabits = (habitResult.data || []).filter(row => (row.weekdays || []).includes(weekday) && !completed.has(row.id)).length;
        const reminders = [
          ...pending.filter(row => row.start_time?.slice(0, 5) === targetTime)
            .map(row => ({ kind: `task-start:${row.id}`, title: 'Task starting in 30 minutes', body: row.title, view: 'tasks' })),
          ...(habitResult.data || []).filter(row => (row.weekdays || []).includes(weekday) && !completed.has(row.id) && row.start_time?.slice(0, 5) === targetTime)
            .map(row => ({ kind: `habit-start:${row.id}`, title: 'Habit starting in 30 minutes', body: row.name, view: 'habits' })),
          ...(hour === '20' && Number(part('minute')) < 15 && pendingTasks ? [{ kind: 'tasks', title: 'Pending tasks', body: `You have ${pendingTasks} task${pendingTasks === 1 ? '' : 's'} to review today.`, view: 'tasks' }] : []),
          ...(hour === '20' && Number(part('minute')) < 15 && pendingHabits ? [{ kind: 'habits', title: 'Habit reminder', body: `You have ${pendingHabits} habit${pendingHabits === 1 ? '' : 's'} to review today.`, view: 'habits' }] : []),
          ...(hour === '21' && Number(part('minute')) < 15 && !expenseResult.data?.length ? [{ kind: 'expenses', title: 'Expense reminder', body: 'Remember to record any expenses from today.', view: 'expenses' }] : []),
        ];
        for (const reminder of reminders) {
          const { error: claimError } = await db.from('reminder_runs').insert({ user_id: pref.user_id, reminder_date: date, kind: reminder.kind });
          if (claimError?.code === '23505') continue;
          if (claimError) throw claimError;
          const { data: notice, error: noticeError } = await db.from('notifications').insert({ user_id: pref.user_id, title: reminder.title, body: reminder.body, view: reminder.view }).select('id').single();
          if (noticeError) { await db.from('reminder_runs').delete().eq('user_id', pref.user_id).eq('reminder_date', date).eq('kind', reminder.kind); throw noticeError; }
          created++;
          if (!accessToken || !account) continue;
          for (const { token } of tokenResult.data || []) {
            const response = await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(account.project_id)}/messages:send`, {
              method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ message: { token, notification: { title: reminder.title, body: reminder.body }, data: { notification_id: notice.id, view: reminder.view } } }),
            });
            if (!response.ok) console.error('Reminder delivery failed', response.status);
          }
        }
      } catch (error) { console.error('Reminder processing failed', pref.user_id, error instanceof Error ? error.message : 'Unknown error'); }
    }
    return Response.json({ created, pushAvailable: !!accessToken });
  }),
};
