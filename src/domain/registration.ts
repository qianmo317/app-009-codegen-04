// 毛线编织课「报名本」的领域规则：纯函数，不依赖 UI 与存储，方便测试。

export type Material = {
  name: string; // 线材名称，如「牛奶棉」
  amount: string; // 每人要带的用量，如「2团」
};

export type CourseSession = {
  id: string;
  title: string;
  startAt: string; // 开课时间（ISO 字符串）
  location: string; // 上课地点
  capacity: number; // 能坐几个人
  materials: Material[]; // 每人要准备的线材
  fee: number; // 学费（元），退费按它乘比例
  createdAt: string;
};

export type SignupStatus = 'confirmed' | 'waitlisted' | 'cancelled';

export type Signup = {
  id: string;
  sessionId: string;
  name: string; // 学员姓名，同一个人按姓名识别
  phone: string;
  createdAt: string; // 报名时间
  status: SignupStatus;
  cancelledAt: string | null;
  refund: number | null; // 退课时的退款金额（元）
  attended: boolean | null; // 课后点名：到课 true / 爽约 false / 未点名 null
};

export type Ledger = {
  sessions: CourseSession[];
  signups: Signup[];
};

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const fail = <T>(error: string): Result<T> => ({ ok: false, error });

// ---- 退费规则 ----
// 按「距开课还有几天」分档，minDays 从大到小命中第一档。
export type RefundTier = { minDays: number; rate: number };

export const DEFAULT_REFUND_POLICY: RefundTier[] = [
  { minDays: 7, rate: 1 }, // 提前 7 天及以上退：全退
  { minDays: 3, rate: 0.8 }, // 提前 3~6 天退：退 80%
  { minDays: 1, rate: 0.5 }, // 提前 1~2 天退：退 50%
  { minDays: 0, rate: 0 }, // 不足 24 小时退：不退
];

const DAY_MS = 24 * 60 * 60 * 1000;

export function daysUntilStart(session: CourseSession, now: Date): number {
  return (new Date(session.startAt).getTime() - now.getTime()) / DAY_MS;
}

export function hasStarted(session: CourseSession, now: Date): boolean {
  return now.getTime() >= new Date(session.startAt).getTime();
}

export function refundRate(policy: RefundTier[], session: CourseSession, now: Date): number {
  const days = daysUntilStart(session, now);
  const sorted = [...policy].sort((a, b) => b.minDays - a.minDays);
  for (const tier of sorted) {
    if (days >= tier.minDays) return tier.rate;
  }
  return 0;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ---- 爽约 ----
// 爽约次数从点名记录派生，不单独存，避免两边对不上。
export function countNoShows(signups: Signup[], name: string): number {
  return signups.filter((s) => s.name === name && s.attended === false).length;
}

// 候补排队顺序：爽约少的排前面；一样多的话，谁先报名谁排前面。
function waitlistCompare(allSignups: Signup[], a: Signup, b: Signup): number {
  const diff = countNoShows(allSignups, a.name) - countNoShows(allSignups, b.name);
  if (diff !== 0) return diff;
  const byTime = a.createdAt.localeCompare(b.createdAt);
  return byTime !== 0 ? byTime : a.id.localeCompare(b.id);
}

export function waitlistFor(ledger: Ledger, sessionId: string): Signup[] {
  return ledger.signups
    .filter((s) => s.sessionId === sessionId && s.status === 'waitlisted')
    .sort((a, b) => waitlistCompare(ledger.signups, a, b));
}

export function confirmedFor(ledger: Ledger, sessionId: string): Signup[] {
  return ledger.signups
    .filter((s) => s.sessionId === sessionId && s.status === 'confirmed')
    .sort((a, b) => {
      const byTime = a.createdAt.localeCompare(b.createdAt);
      return byTime !== 0 ? byTime : a.id.localeCompare(b.id);
    });
}

// ---- 开一期新课 ----
let seq = 0;
function genId(): string {
  seq += 1;
  return `${Date.now().toString(36)}-${seq}-${Math.random().toString(36).slice(2, 8)}`;
}

export type SessionInput = {
  title: string;
  startAt: string;
  location: string;
  capacity: number;
  materials: Material[];
  fee: number;
};

export function addSession(
  ledger: Ledger,
  input: SessionInput,
  now: Date
): Result<{ ledger: Ledger; session: CourseSession }> {
  const title = input.title.trim();
  if (!title) return fail('课程名不能为空');
  const location = input.location.trim();
  if (!location) return fail('地点不能为空');
  const start = new Date(input.startAt);
  if (Number.isNaN(start.getTime())) return fail('开课时间不对');
  if (!Number.isInteger(input.capacity) || input.capacity < 1) return fail('人数至少为 1');
  if (Number.isNaN(input.fee) || input.fee < 0) return fail('学费不能是负数');
  const materials = input.materials
    .map((m) => ({ name: m.name.trim(), amount: m.amount.trim() }))
    .filter((m) => m.name !== '');
  const session: CourseSession = {
    id: genId(),
    title,
    startAt: start.toISOString(),
    location,
    capacity: input.capacity,
    materials,
    fee: round2(input.fee),
    createdAt: now.toISOString(),
  };
  return ok({ ledger: { ...ledger, sessions: [...ledger.sessions, session] }, session });
}

// ---- 报名：先到先得，满了排候补 ----
export function register(
  ledger: Ledger,
  sessionId: string,
  name: string,
  phone: string,
  now: Date
): Result<{ ledger: Ledger; signup: Signup }> {
  const session = ledger.sessions.find((s) => s.id === sessionId);
  if (!session) return fail('没有找到这一期课');
  if (hasStarted(session, now)) return fail('这期课已经开课，不能再报名了');
  const trimmed = name.trim();
  if (!trimmed) return fail('请填写姓名');
  // 同一个人同一期不许占两个名额（退过的可以重新报）
  const duplicate = ledger.signups.some(
    (s) => s.sessionId === sessionId && s.name === trimmed && s.status !== 'cancelled'
  );
  if (duplicate) return fail('同一个人同一期只能报一个名额');
  const confirmedCount = ledger.signups.filter(
    (s) => s.sessionId === sessionId && s.status === 'confirmed'
  ).length;
  const signup: Signup = {
    id: genId(),
    sessionId,
    name: trimmed,
    phone: phone.trim(),
    createdAt: now.toISOString(),
    status: confirmedCount < session.capacity ? 'confirmed' : 'waitlisted',
    cancelledAt: null,
    refund: null,
    attended: null,
  };
  return ok({ ledger: { ...ledger, signups: [...ledger.signups, signup] }, signup });
}

// ---- 退课：按距开课天数算退费，确认名额空出来后按候补顺序补上 ----
export function cancelSignup(
  ledger: Ledger,
  signupId: string,
  now: Date,
  policy: RefundTier[] = DEFAULT_REFUND_POLICY
): Result<{ ledger: Ledger; refund: number; promoted: Signup | null }> {
  const signup = ledger.signups.find((s) => s.id === signupId);
  if (!signup) return fail('没有找到这条报名记录');
  if (signup.status === 'cancelled') return fail('这条报名已经退过了');
  const session = ledger.sessions.find((s) => s.id === signup.sessionId);
  if (!session) return fail('没有找到这一期课');
  if (hasStarted(session, now)) return fail('已经开课了，不能退课');
  const wasConfirmed = signup.status === 'confirmed';
  // 候补没缴费，退候补不涉及退款
  const refund = wasConfirmed ? round2(session.fee * refundRate(policy, session, now)) : 0;
  let signups = ledger.signups.map((s) =>
    s.id === signupId
      ? { ...s, status: 'cancelled' as const, cancelledAt: now.toISOString(), refund }
      : s
  );
  let promoted: Signup | null = null;
  if (wasConfirmed) {
    const next = waitlistFor({ ...ledger, signups }, session.id)[0];
    if (next) {
      signups = signups.map((s) => (s.id === next.id ? { ...s, status: 'confirmed' as const } : s));
      promoted = { ...next, status: 'confirmed' };
    }
  }
  return ok({ ledger: { ...ledger, signups }, refund, promoted });
}

// ---- 点名：开课后才能点，没来记一次爽约 ----
export function markAttendance(
  ledger: Ledger,
  signupId: string,
  attended: boolean,
  now: Date
): Result<{ ledger: Ledger }> {
  const signup = ledger.signups.find((s) => s.id === signupId);
  if (!signup) return fail('没有找到这条报名记录');
  const session = ledger.sessions.find((s) => s.id === signup.sessionId);
  if (!session) return fail('没有找到这一期课');
  if (!hasStarted(session, now)) return fail('还没开课，不能点名');
  if (signup.status !== 'confirmed') return fail('只能给已确认的学员点名');
  const signups = ledger.signups.map((s) => (s.id === signupId ? { ...s, attended } : s));
  return ok({ ledger: { ...ledger, signups } });
}

// ---- 名单：开课前一天列出这一期的学员和每人要带的线材 ----
export type RosterRow = {
  name: string;
  phone: string;
  materials: Material[];
};

export function roster(
  ledger: Ledger,
  sessionId: string
): Result<{ session: CourseSession; rows: RosterRow[] }> {
  const session = ledger.sessions.find((s) => s.id === sessionId);
  if (!session) return fail('没有找到这一期课');
  const rows = confirmedFor(ledger, sessionId).map((s) => ({
    name: s.name,
    phone: s.phone,
    materials: session.materials,
  }));
  return ok({ session, rows });
}
