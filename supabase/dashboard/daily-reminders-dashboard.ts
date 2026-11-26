import { withSupabase } from 'npm:@supabase/server@1';
import { importPKCS8, SignJWT } from 'npm:jose@6';
type ReminderLoan = {
  id: string;
  person: string;
  record_kind: 'lent' | 'borrowed' | 'emi';
  amount: number | string;
  repaid: number | string;
  lent_date: string;
  due_date: string | null;
  end_date: string | null;
  payment_day: number | null;
  payment_cycle?: 'daily' | 'weekly' | 'monthly' | 'custom' | null;
  payment_interval_days?: number | null;
  first_payment_date?: string | null;
};

function nextDate(date: string): string {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}

/** Reminders for today and tomorrow, using calendar dates in the user's time zone. */
function loanRemindersForDate(loans: ReminderLoan[], today: string) {
  const tomorrow = nextDate(today);
  return loans.flatMap(loan => {
    const amount = Number(loan.amount), repaid = Number(loan.repaid);
    if (!Number.isFinite(amount) || !Number.isFinite(repaid) || amount <= repaid) return [];
    const isDue = (date: string) => {
      if (date < loan.lent_date) return false;
      if (loan.record_kind !== 'emi') return loan.due_date === date;
      if (loan.end_date && date > loan.end_date) return false;
      if (loan.payment_cycle && loan.payment_cycle !== 'monthly') {
        const interval = loan.payment_cycle === 'daily' ? 1 : loan.payment_cycle === 'weekly' ? 7 : loan.payment_interval_days;
        const days = (Date.parse(date + 'T00:00:00Z') - Date.parse((loan.first_payment_date || loan.lent_date) + 'T00:00:00Z')) / 86400000;
        return !!interval && interval > 0 && days >= 0 && days % interval === 0;
      }
      const day = loan.payment_day;
      if (!Number.isInteger(day) || !day || day < 1 || day > 31 || (loan.end_date && date > loan.end_date)) return false;
      const year = Number(date.slice(0, 4)), month = Number(date.slice(5, 7));
      const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
      return Number(date.slice(8, 10)) === Math.min(day, lastDay);
    };
    return ([{ date: tomorrow, when: 'tomorrow', phase: 'before' }, { date: today, when: 'today', phase: 'due' }] as const)
      .filter(target => isDue(target.date))
      .map(target => ({
        date: today,
        kind: `loan-${target.phase}:${loan.id}:${target.date}`,
        title: loan.record_kind === 'lent' ? 'Money expected back' : loan.record_kind === 'emi' ? 'Loan installment reminder' : 'Money due',
        body: loan.record_kind === 'lent' ? `Money from ${loan.person} is expected ${target.when}.` : loan.record_kind === 'emi' ? `An installment for ${loan.person} is scheduled ${target.when}.` : `Payment to ${loan.person} is due ${target.when}.`,
        view: 'expenses',
      }));
  });
}

// Retry once on a temporary server or network failure. Delivery cannot be
// confirmed if the connection drops after Firebase accepts a request.
async function sendPush(url: string, init: RequestInit): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await fetch(url, init);
      if (attempt > 0 || response.status < 500) return response;
      await response.body?.cancel();
    } catch (error) {
      if (attempt > 0) throw error;
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

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
    let pushAccepted = 0;
    let pushFailed = 0;
    const icon = 'https://daymarks.ai.studio/daymark-icon-192.png';
    for (const pref of preferences || []) {
      try {
        const now = new Date();
        const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: pref.timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
        const parts = formatter.formatToParts(now);
        const part = (name: string) => parts.find(p => p.type === name)?.value || '';
        const hour = part('hour');
        const today = `${part('year')}-${part('month')}-${part('day')}`;
        // Look back five minutes to recover a delayed or missed scheduler run.
        const targets = Array.from({ length: 5 }, (_, minute) => {
          const targetParts = formatter.formatToParts(new Date(now.getTime() + (30 - minute) * 60 * 1000));
          const targetPart = (name: string) => targetParts.find(p => p.type === name)?.value || '';
          const date = `${targetPart('year')}-${targetPart('month')}-${targetPart('day')}`;
          return { date, time: `${targetPart('hour')}:${targetPart('minute')}`, weekday: new Date(`${date}T00:00:00Z`).getUTCDay() };
        });
        const dates = [...new Set([today, ...targets.map(target => target.date)])];
        const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();
        const [taskResult, habitResult, entryResult, trackerResult, expenseResult, tokenResult] = await Promise.all([
          db.from('task_entries').select('task_id,status,entry_date').eq('user_id', pref.user_id).in('entry_date', dates),
          db.from('custom_trackers').select('id,name,weekdays,start_time').eq('user_id', pref.user_id).eq('type', 'boolean'),
          db.from('tracker_entries').select('tracker_id,boolean_value,entry_date').eq('user_id', pref.user_id).in('entry_date', dates),
          db.from('tasks').select('id,title,is_active,start_time,weekdays').eq('user_id', pref.user_id),
          db.from('expenses').select('id').eq('user_id', pref.user_id).eq('entry_date', today).eq('transaction_type', 'expense').eq('is_transfer', false).limit(1),
          db.from('push_tokens').select('token,sound_enabled').eq('user_id', pref.user_id),
        ]);
        if ([taskResult, habitResult, entryResult, trackerResult, expenseResult, tokenResult].some(result => result.error)) throw new Error('Could not load reminder data');
        const pendingFor = (date: string, day: number) => (trackerResult.data || []).filter(row => row.is_active && (row.weekdays || [0, 1, 2, 3, 4, 5, 6]).includes(day) && ((taskResult.data || []).find(entry => entry.task_id === row.id && entry.entry_date === date)?.status || 'pending') === 'pending');
        const completedFor = (date: string) => new Set((entryResult.data || []).filter(row => row.entry_date === date && row.boolean_value).map(row => row.tracker_id));
        const pendingTasks = pendingFor(today, weekday).length;
        const completed = completedFor(today);
        const pendingHabits = (habitResult.data || []).filter(row => (row.weekdays || []).includes(weekday) && !completed.has(row.id)).length;
        let loanReminders: ReturnType<typeof loanRemindersForDate> = [];
        if (hour === '09' && Number(part('minute')) < 15) {
          try {
            const loans: ReminderLoan[] = [];
            const pageSize = 1000;
            for (let offset = 0; ; offset += pageSize) {
              const result = await db.from('loans_and_dues').select('id,person,record_kind,amount,repaid,lent_date,due_date,end_date,payment_day,payment_cycle,payment_interval_days,first_payment_date').eq('user_id', pref.user_id).order('id').range(offset, offset + pageSize - 1);
              if (result.error) throw result.error;
              loans.push(...(result.data || []) as ReminderLoan[]);
              if (!result.data || result.data.length < pageSize) break;
            }
            loanReminders = loanRemindersForDate(loans, today);
          } catch (error) {
            // A missing loans setup must not prevent unrelated reminders.
            console.error('Loan reminders unavailable', pref.user_id, error instanceof Error ? error.message : 'Could not load loans');
          }
        }
        const reminders = [
          ...loanReminders,
          ...targets.flatMap(target => pendingFor(target.date, target.weekday).filter(row => row.start_time?.slice(0, 5) === target.time)
            .map(row => ({ date: target.date, kind: `task-start:${row.id}`, title: 'Task starting soon', body: row.title, view: 'tasks' }))),
          ...targets.flatMap(target => (habitResult.data || []).filter(row => (row.weekdays || []).includes(target.weekday) && !completedFor(target.date).has(row.id) && row.start_time?.slice(0, 5) === target.time)
            .map(row => ({ date: target.date, kind: `habit-start:${row.id}`, title: 'Habit starting soon', body: row.name, view: 'habits' }))),
          ...(hour === '20' && Number(part('minute')) < 15 && pendingTasks ? [{ kind: 'tasks', title: 'Pending tasks', body: `You have ${pendingTasks} task${pendingTasks === 1 ? '' : 's'} to review today.`, view: 'tasks' }] : []),
          ...(hour === '20' && Number(part('minute')) < 15 && pendingHabits ? [{ kind: 'habits', title: 'Habit reminder', body: `You have ${pendingHabits} habit${pendingHabits === 1 ? '' : 's'} to review today.`, view: 'habits' }] : []),
          ...(hour === '21' && Number(part('minute')) < 15 && !expenseResult.data?.length ? [{ kind: 'expenses', title: 'Expense reminder', body: 'Remember to record any expenses from today.', view: 'expenses' }] : []),
        ];
        for (const reminder of reminders) {
          const reminderDate = 'date' in reminder ? reminder.date : today;
          const { error: claimError } = await db.from('reminder_runs').insert({ user_id: pref.user_id, reminder_date: reminderDate, kind: reminder.kind });
          if (claimError?.code === '23505') continue;
          if (claimError) throw claimError;
          const { data: notice, error: noticeError } = await db.from('notifications').insert({ user_id: pref.user_id, title: reminder.title, body: reminder.body, view: reminder.view }).select('id').single();
          if (noticeError) { await db.from('reminder_runs').delete().eq('user_id', pref.user_id).eq('reminder_date', reminderDate).eq('kind', reminder.kind); throw noticeError; }
          created++;
          if (!accessToken || !account) continue;
          for (const { token, sound_enabled } of tokenResult.data || []) {
            try {
              const response = await sendPush(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(account.project_id)}/messages:send`, {
                method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: { token, notification: { title: reminder.title, body: reminder.body }, webpush: { notification: { title: reminder.title, body: reminder.body, icon, silent: sound_enabled === false }, fcm_options: { link: `https://daymarks.ai.studio/?notificationView=${encodeURIComponent(reminder.view)}` } }, data: { notification_id: notice.id, view: reminder.view } } }),
              });
              if (response.ok) pushAccepted++;
              else {
                pushFailed++;
                const result = await response.json().catch(() => null);
                console.error('Reminder delivery failed', response.status, result?.error?.status || 'Unknown FCM error');
              }
            } catch (error) {
              pushFailed++;
              console.error('Reminder delivery request failed', error instanceof Error ? error.message : 'Unknown error');
            }
          }
        }
      } catch (error) { console.error('Reminder processing failed', pref.user_id, error instanceof Error ? error.message : 'Unknown error'); }
    }
    return Response.json({ created, pushAvailable: !!accessToken, pushAccepted, pushFailed });
  }),
};
