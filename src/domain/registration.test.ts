import { describe, it, expect } from 'vitest';
import {
  addSession,
  register,
  cancelSignup,
  markAttendance,
  roster,
  countNoShows,
  waitlistFor,
  confirmedFor,
  refundRate,
  DEFAULT_REFUND_POLICY,
  type Ledger,
  type CourseSession,
} from './registration';

const empty: Ledger = { sessions: [], signups: [] };

// 以 2026-09-19 12:00 为「现在」
const NOW = new Date('2026-09-19T12:00:00Z');
const inDays = (days: number) => new Date(NOW.getTime() + days * 86400_000).toISOString();

function makeSession(overrides: Partial<Parameters<typeof addSession>[1]> = {}, startAt = inDays(10)) {
  const res = addSession(
    empty,
    {
      title: '基础棒针入门',
      startAt,
      location: '工作室二楼',
      capacity: 2,
      materials: [
        { name: '牛奶棉', amount: '2团' },
        { name: '5mm棒针', amount: '1副' },
      ],
      fee: 200,
      ...overrides,
    },
    NOW
  );
  if (!res.ok) throw new Error(res.error);
  return res.value;
}

function signupNames(ledger: Ledger, sessionId: string, status: 'confirmed' | 'waitlisted') {
  const list = status === 'confirmed' ? confirmedFor(ledger, sessionId) : waitlistFor(ledger, sessionId);
  return list.map((s) => s.name);
}

describe('开一期新课', () => {
  it('定好时间、地点、人数、线材', () => {
    const { session } = makeSession();
    expect(session.title).toBe('基础棒针入门');
    expect(session.location).toBe('工作室二楼');
    expect(session.capacity).toBe(2);
    expect(session.materials).toHaveLength(2);
    expect(session.fee).toBe(200);
  });

  it('人数至少 1，线材空行会被忽略', () => {
    const bad = addSession(empty, { title: 'x', startAt: inDays(1), location: 'y', capacity: 0, materials: [], fee: 0 }, NOW);
    expect(bad.ok).toBe(false);
    const { session } = makeSession({ materials: [{ name: ' 牛奶棉 ', amount: '2团' }, { name: '', amount: '' }] });
    expect(session.materials).toEqual([{ name: '牛奶棉', amount: '2团' }]);
  });
});

describe('报名', () => {
  it('先到先得，满了以后排候补', () => {
    let { ledger, session } = makeSession();
    for (const name of ['阿珍', '阿强', '小美']) {
      const res = register(ledger, session.id, name, '', NOW);
      expect(res.ok).toBe(true);
      ledger = res.ok ? res.value.ledger : ledger;
    }
    expect(signupNames(ledger, session.id, 'confirmed')).toEqual(['阿珍', '阿强']);
    expect(signupNames(ledger, session.id, 'waitlisted')).toEqual(['小美']);
  });

  it('同一个人同一期不许占两个名额，退了可以再报', () => {
    let { ledger, session } = makeSession();
    const first = register(ledger, session.id, '阿珍', '', NOW);
    expect(first.ok).toBe(true);
    ledger = first.ok ? first.value.ledger : ledger;
    expect(register(ledger, session.id, '阿珍', '', NOW).ok).toBe(false);
    expect(register(ledger, session.id, ' 阿珍 ', '', NOW).ok).toBe(false); // 首尾空格算同一个人
    const cancelled = cancelSignup(ledger, first.ok ? first.value.signup.id : '', NOW);
    expect(cancelled.ok).toBe(true);
    ledger = cancelled.ok ? cancelled.value.ledger : ledger;
    expect(register(ledger, session.id, '阿珍', '', NOW).ok).toBe(true);
  });

  it('已经开课的课不许再报名', () => {
    const { ledger, session } = makeSession({}, inDays(0)); // 恰好此刻开课
    const res = register(ledger, session.id, '阿珍', '', NOW);
    expect(res.ok).toBe(false);
    expect(res.ok ? '' : res.error).toContain('已经开课');
  });
});

describe('退课与补位', () => {
  function full() {
    let { ledger, session } = makeSession();
    const ids: Record<string, string> = {};
    for (const name of ['阿珍', '阿强', '小美', '阿芳']) {
      const res = register(ledger, session.id, name, '', NOW);
      if (!res.ok) throw new Error('register failed');
      ledger = res.value.ledger;
      ids[name] = res.value.signup.id;
    }
    return { ledger, session, ids };
  }

  it('确认名额退课后按排队顺序补上', () => {
    const { ledger, session, ids } = full();
    const res = cancelSignup(ledger, ids['阿珍'], NOW);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.promoted?.name).toBe('小美'); // 队首补上
    expect(signupNames(res.value.ledger, session.id, 'confirmed')).toEqual(['阿强', '小美']);
    expect(signupNames(res.value.ledger, session.id, 'waitlisted')).toEqual(['阿芳']);
  });

  it('退候补不补位也不退费', () => {
    const { ledger, ids } = full();
    const res = cancelSignup(ledger, ids['小美'], NOW);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.refund).toBe(0);
    expect(res.value.promoted).toBeNull();
  });

  it('退费按距开课天数分档：≥7天全退，3~6天退80%，1~2天退50%，当天不退', () => {
    const session = { startAt: inDays(10) } as CourseSession;
    expect(refundRate(DEFAULT_REFUND_POLICY, session, NOW)).toBe(1); // 还有 10 天
    expect(refundRate(DEFAULT_REFUND_POLICY, session, new Date(NOW.getTime() + 3 * 86400_000))).toBe(1); // 还有 7 天
    expect(refundRate(DEFAULT_REFUND_POLICY, session, new Date(NOW.getTime() + 6 * 86400_000))).toBe(0.8); // 还有 4 天
    expect(refundRate(DEFAULT_REFUND_POLICY, session, new Date(NOW.getTime() + 8.5 * 86400_000))).toBe(0.5); // 还有 1.5 天
    expect(refundRate(DEFAULT_REFUND_POLICY, session, new Date(NOW.getTime() + 9.5 * 86400_000))).toBe(0); // 还有 12 小时
  });

  it('退课按学费乘比例退款，并记在报名记录上', () => {
    const { ledger, ids } = full(); // 学费 200，距开课 10 天
    const res = cancelSignup(ledger, ids['阿珍'], new Date(NOW.getTime() + 6 * 86400_000)); // 还有 4 天，退 80%
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.refund).toBe(160);
    const cancelled = res.value.ledger.signups.find((s) => s.id === ids['阿珍']);
    expect(cancelled?.refund).toBe(160);
  });

  it('开课后不能退课', () => {
    let { ledger, session } = makeSession({}, inDays(1));
    const reg = register(ledger, session.id, '阿珍', '', NOW);
    if (!reg.ok) throw new Error('register failed');
    ledger = reg.value.ledger;
    const res = cancelSignup(ledger, reg.value.signup.id, new Date(NOW.getTime() + 2 * 86400_000));
    expect(res.ok).toBe(false);
  });
});

describe('爽约', () => {
  // 阿珍上一期报了名没来，记一次爽约
  function withNoShow() {
    let { ledger, session } = makeSession({ capacity: 1 }, inDays(1));
    const reg = register(ledger, session.id, '阿珍', '', NOW);
    if (!reg.ok) throw new Error('register failed');
    ledger = reg.value.ledger;
    const marked = markAttendance(ledger, reg.value.signup.id, false, new Date(NOW.getTime() + 2 * 86400_000));
    if (!marked.ok) throw new Error('mark failed');
    return marked.value.ledger;
  }

  it('报了名没来上课记一次爽约', () => {
    const ledger = withNoShow();
    expect(countNoShows(ledger.signups, '阿珍')).toBe(1);
    expect(countNoShows(ledger.signups, '阿强')).toBe(0);
  });

  it('爽约次数多的候补时排在后面，哪怕报名更早', () => {
    let ledger = withNoShow();
    // 新开一期，容量 1：阿强先占了座
    const s2 = addSession(ledger, { title: '提花进阶', startAt: inDays(5), location: '工作室二楼', capacity: 1, materials: [], fee: 300 }, NOW);
    if (!s2.ok) throw new Error('addSession failed');
    ledger = s2.value.ledger;
    const sid = s2.value.session.id;
    // 阿珍（1 次爽约）先报名候补，小美（0 次）后报名
    for (const [name, at] of [['阿强', 0], ['阿珍', 1], ['小美', 2]] as const) {
      const res = register(ledger, sid, name, '', new Date(NOW.getTime() + at * 60_000));
      if (!res.ok) throw new Error('register failed');
      ledger = res.value.ledger;
    }
    expect(signupNames(ledger, sid, 'waitlisted')).toEqual(['小美', '阿珍']);
    // 阿强退课，小美虽然报名晚但爽约少，先补上
    const qiang = ledger.signups.find((s) => s.sessionId === sid && s.name === '阿强');
    const res = cancelSignup(ledger, qiang!.id, NOW);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.promoted?.name).toBe('小美');
  });

  it('还没开课不能点名，只能给已确认的学员点名', () => {
    let { ledger, session } = makeSession({ capacity: 1 });
    const a = register(ledger, session.id, '阿珍', '', NOW);
    if (!a.ok) throw new Error('register failed');
    ledger = a.value.ledger;
    const b = register(ledger, session.id, '小美', '', NOW); // 候补
    if (!b.ok) throw new Error('register failed');
    ledger = b.value.ledger;
    expect(markAttendance(ledger, a.value.signup.id, true, NOW).ok).toBe(false); // 没开课
    const later = new Date(NOW.getTime() + 11 * 86400_000);
    expect(markAttendance(ledger, b.value.signup.id, true, later).ok).toBe(false); // 候补不能点
    expect(markAttendance(ledger, a.value.signup.id, false, later).ok).toBe(true);
  });
});

describe('名单', () => {
  it('开课前一天列出这一期的学员和每人要带的线材', () => {
    let { ledger, session } = makeSession();
    for (const name of ['阿珍', '阿强', '小美']) {
      const res = register(ledger, session.id, name, '138', NOW);
      if (!res.ok) throw new Error('register failed');
      ledger = res.value.ledger;
    }
    const dayBefore = new Date(NOW.getTime() + 9 * 86400_000); // 开课前一天
    expect(dayBefore.getTime()).toBeLessThan(new Date(session.startAt).getTime());
    const res = roster(ledger, session.id);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.rows.map((r) => r.name)).toEqual(['阿珍', '阿强']); // 只有确认的，候补不在名单上
    for (const row of res.value.rows) {
      expect(row.materials).toEqual(session.materials); // 每人一份线材清单
    }
  });
});
