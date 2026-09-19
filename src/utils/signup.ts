import type { KnitClass, RefundTier, Registration, Person } from '../types/signup';

/** 默认退费规则：≥7 天全退，≥3 天退一半，不足 3 天不退 */
export const DEFAULT_REFUND_TIERS: RefundTier[] = [
  { daysBefore: 7, percent: 100 },
  { daysBefore: 3, percent: 50 },
];

/** 退费规则预设，方便新建课时一键填入 */
export const REFUND_PRESETS: { label: string; tiers: RefundTier[] }[] = [
  { label: '7天全退 / 3天半退', tiers: DEFAULT_REFUND_TIERS },
  {
    label: '14天全退 / 7天退70% / 3天退30%',
    tiers: [
      { daysBefore: 14, percent: 100 },
      { daysBefore: 7, percent: 70 },
      { daysBefore: 3, percent: 30 },
    ],
  },
  { label: '一律不退', tiers: [] },
];

export function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** datetime-local 字符串解析为 Date（按本地时区） */
export function parseStart(startTime: string): Date {
  // 'YYYY-MM-DDTHH:mm' 在各浏览器用 new Date 解析均按本地时区
  return new Date(startTime);
}

/** 开课时间是否已经过去（已经开过/已经开课的课不许再报名、不能再退出） */
export function isClosed(cls: Pick<KnitClass, 'startTime'>, now: Date = new Date()): boolean {
  return parseStart(cls.startTime).getTime() <= now.getTime();
}

/** 距离开课还剩多少个完整的 24 小时（已开课为负数） */
export function daysUntilStart(cls: Pick<KnitClass, 'startTime'>, now: Date = new Date()): number {
  const ms = parseStart(cls.startTime).getTime() - now.getTime();
  return Math.floor(ms / 86_400_000);
}

/**
 * 取某个时刻取消报名适用的退费档位。
 * 规则：把档位按 daysBefore 降序，命中第一个 daysBefore ≤ 剩余整天数的档位；
 * 全都不命中（含课程已开始）返回 0%。
 */
export function refundAt(
  tiers: RefundTier[],
  cls: Pick<KnitClass, 'startTime'>,
  now: Date = new Date()
): { percent: number; daysLeft: number } {
  const daysLeft = daysUntilStart(cls, now);
  const sorted = [...tiers].sort((a, b) => b.daysBefore - a.daysBefore);
  const hit = sorted.find((t) => daysLeft >= t.daysBefore);
  return { percent: hit?.percent ?? 0, daysLeft };
}

export function refundYuan(cls: Pick<KnitClass, 'price'>, percent: number): number {
  return Math.round(cls.price * percent) / 100;
}

/** 候补排序：爽约次数少的在前；次数相同，报名早的在前 */
export function waitlistOrder(
  regs: Registration[],
  people: Person[]
): Registration[] {
  const noShow = (personId: string) => people.find((p) => p.id === personId)?.noShowCount ?? 0;
  return [...regs].sort(
    (a, b) => noShow(a.personId) - noShow(b.personId) || a.createdAt - b.createdAt
  );
}

/** 状态是否占着正式名额 */
export function holdsSeat(status: Registration['status']): boolean {
  return status === 'enrolled' || status === 'attended' || status === 'noshow';
}

export function countSeats(regs: Registration[]): number {
  return regs.filter((r) => holdsSeat(r.status)).length;
}

/** 同一人在同一期只能有一条「有效」记录（正式名单或候补） */
export function findActiveRegistration(
  regs: Registration[],
  classId: string,
  personId: string
): Registration | undefined {
  return regs.find(
    (r) => r.classId === classId && r.personId === personId &&
      (r.status === 'enrolled' || r.status === 'waitlist')
  );
}

/**
 * 名额有空位时，按候补顺序递补。
 * 返回 { promoted, regs }：regs 为更新后的记录数组，promoted 为被补进名单的人。
 * 注意：只处理排在队首的候补（一次退一个名额），由调用方写回 store。
 */
export function promoteFromWaitlist(
  regs: Registration[],
  people: Person[],
  classId: string,
  capacity: number,
  now: Date = new Date()
): { regs: Registration[]; promoted: Registration | null } {
  const inClass = regs.filter((r) => r.classId === classId);
  const seats = countSeats(inClass);
  if (seats >= capacity) return { regs, promoted: null };

  const queue = waitlistOrder(
    inClass.filter((r) => r.status === 'waitlist'),
    people
  );
  const first = queue[0];
  if (!first) return { regs, promoted: null };

  const promoted: Registration = { ...first, status: 'enrolled', promotedAt: now.getTime() };
  return {
    regs: regs.map((r) => (r.id === first.id ? promoted : r)),
    promoted,
  };
}

const DATE_FMT = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

export function formatStart(startTime: string): string {
  return DATE_FMT.format(parseStart(startTime));
}

/** 是否明天开课（用于列表上高亮「开课前一天核对名单」） */
export function isTomorrow(cls: Pick<KnitClass, 'startTime'>, now: Date = new Date()): boolean {
  const start = parseStart(cls.startTime);
  const d0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const d1 = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
  return Math.round((d1 - d0) / 86_400_000) === 1;
}

/** 名单页需要的状态标签 */
export function statusLabel(status: Registration['status']): string {
  return (
    {
      enrolled: '正式名单',
      waitlist: '候补',
      cancelled: '已退出',
      attended: '已到课',
      noshow: '爽约',
    } as const
  )[status];
}
