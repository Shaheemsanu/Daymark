export type ReminderLoan = {
  id: string;
  person: string;
  record_kind: 'lent' | 'borrowed' | 'emi';
  amount: number | string;
  repaid: number | string;
  lent_date: string;
  due_date: string | null;
  end_date: string | null;
  payment_day: number | null;
};

function nextDate(date: string): string {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}

/** Reminders for today and tomorrow, using calendar dates in the user's time zone. */
export function loanRemindersForDate(loans: ReminderLoan[], today: string) {
  const tomorrow = nextDate(today);
  return loans.flatMap(loan => {
    const amount = Number(loan.amount), repaid = Number(loan.repaid);
    if (!Number.isFinite(amount) || !Number.isFinite(repaid) || amount <= repaid) return [];
    const isDue = (date: string) => {
      if (date < loan.lent_date) return false;
      if (loan.record_kind !== 'emi') return loan.due_date === date;
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
