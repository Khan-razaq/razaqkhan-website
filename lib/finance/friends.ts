// What friends owe: friends use the card too, so an expense can name who
// spent it (expenses.spent_by), and money a friend sends back can name them
// (incomes.paid_back_by). What a friend owes is what they spent minus what
// they paid back.

export type FriendEntry = {
  id: string;
  date: string; // YYYY-MM-DD
  description: string;
  amount: number;
  kind: "spent" | "paid_back";
};

export type Friend = {
  name: string;
  spent: number;
  paidBack: number;
  owes: number; // negative: they've paid more than they spent
  entries: FriendEntry[]; // newest first
};

type SpentRow = { id: string; description: string; amount: number; expense_date: string; spent_by: string | null };
type PaidRow = { id: string; source: string; amount: number; income_date: string; paid_back_by: string | null };

const cents = (n: number) => Math.round(n * 100) / 100;

// "saud" and "Saud" are one friend, shown as first written in `spent`
// (pass it newest first, and the newest spelling wins).
export function friendBalances(spent: SpentRow[], paid: PaidRow[]): Friend[] {
  const friends = new Map<string, Friend>();
  const friendFor = (name: string) => {
    const key = name.trim().toLowerCase();
    let friend = friends.get(key);
    if (!friend) {
      friend = { name: name.trim(), spent: 0, paidBack: 0, owes: 0, entries: [] };
      friends.set(key, friend);
    }
    return friend;
  };

  for (const e of spent) {
    if (!e.spent_by?.trim()) continue;
    const friend = friendFor(e.spent_by);
    friend.spent += Number(e.amount);
    friend.entries.push({ id: e.id, date: e.expense_date, description: e.description, amount: Number(e.amount), kind: "spent" });
  }
  for (const p of paid) {
    if (!p.paid_back_by?.trim()) continue;
    const friend = friendFor(p.paid_back_by);
    friend.paidBack += Number(p.amount);
    friend.entries.push({ id: p.id, date: p.income_date, description: p.source, amount: Number(p.amount), kind: "paid_back" });
  }

  return [...friends.values()]
    .map((f) => ({
      ...f,
      spent: cents(f.spent),
      paidBack: cents(f.paidBack),
      owes: cents(f.spent - f.paidBack),
      entries: f.entries.sort((a, b) => b.date.localeCompare(a.date)),
    }))
    .sort((a, b) => b.owes - a.owes || a.name.localeCompare(b.name));
}

// The friend a Zelle is probably from: every word of their name appears in
// the sender's ("Saud" in "Zelle from Saud Aqib Mohammad (chicken)"). Only
// when exactly one friend fits; otherwise the user picks.
export function likelyFriend(sender: string, names: string[]): string | null {
  const words = new Set(sender.toLowerCase().match(/[\p{L}']+/gu) ?? []);
  const fits = names.filter((name) => {
    const parts = name.toLowerCase().match(/[\p{L}']+/gu) ?? [];
    return parts.length > 0 && parts.every((p) => words.has(p));
  });
  return fits.length === 1 ? fits[0] : null;
}
