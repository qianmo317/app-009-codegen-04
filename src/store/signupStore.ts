import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { KnitClass, Person, RefundTier, Registration, YarnItem } from '../types/signup';
import {
  DEFAULT_REFUND_TIERS,
  findActiveRegistration,
  holdsSeat,
  isClosed,
  promoteFromWaitlist,
  refundAt,
  countSeats,
  uid,
} from '../utils/signup';

export type ClassInput = {
  title: string;
  teacher?: string;
  startTime: string;
  location: string;
  capacity: number;
  price?: number;
  yarns: YarnItem[];
  refundTiers?: RefundTier[];
};

type RegisterResult =
  | { ok: true; registration: Registration; enqueued: boolean }
  | { ok: false; reason: 'closed' | 'duplicate' | 'invalid' };

type CancelResult =
  | { ok: true; refundPercent: number; promoted: Registration | null }
  | { ok: false; reason: 'closed' | 'notfound' };

type AttendanceResult =
  | { ok: true; registration: Registration }
  | { ok: false; reason: 'closed' | 'notfound' | 'notseated' };

interface SignupState {
  classes: KnitClass[];
  registrations: Registration[];
  people: Person[];
}

interface SignupActions {
  createClass: (input: ClassInput) => string;
  updateClass: (id: string, input: ClassInput) => void;
  deleteClass: (id: string) => void;
  /** 报名（先到先得，满员自动进候补）；学员按「姓名+联系方式」去重并累计爽约记录 */
  register: (classId: string, name: string, contact: string) => RegisterResult;
  /** 开课前退出：算退费比例，正式名单退出自动按候补顺序递补 */
  cancelRegistration: (regId: string) => CancelResult;
  /** 点名：标记到课 / 爽约（爽约累计一次，影响之后的候补排序） */
  setAttendance: (regId: string, attended: boolean) => AttendanceResult;
  getOrCreatePerson: (name: string, contact: string) => Person;
}

export const useSignupStore = create<SignupState & SignupActions>()(
  persist(
    (set, get) => ({
      classes: [],
      registrations: [],
      people: [],

      createClass: (input) => {
        const cls: KnitClass = {
          id: uid(),
          title: input.title.trim(),
          teacher: input.teacher?.trim() ?? '',
          startTime: input.startTime,
          location: input.location.trim(),
          capacity: Math.max(1, Math.floor(input.capacity)),
          price: Math.max(0, input.price ?? 0),
          yarns: input.yarns,
          refundTiers: input.refundTiers?.length ? input.refundTiers : DEFAULT_REFUND_TIERS,
          createdAt: Date.now(),
        };
        set((s) => ({ classes: [...s.classes, cls] }));
        return cls.id;
      },

      updateClass: (id, input) => {
        set((s) => {
          const old = s.classes.find((c) => c.id === id);
          if (!old) return s;
          const capacity = Math.max(1, Math.floor(input.capacity));
          const updated: KnitClass = {
            ...old,
            title: input.title.trim(),
            teacher: input.teacher?.trim() ?? '',
            startTime: input.startTime,
            location: input.location.trim(),
            capacity,
            price: Math.max(0, input.price ?? 0),
            yarns: input.yarns,
            refundTiers: input.refundTiers ?? old.refundTiers,
          };
          // 容量调大或有人退出后可能产生空位：按候补顺序（爽约少的优先）递补
          let registrations = s.registrations;
          const people = s.people;
          let guard = 0;
          while (guard++ < capacity) {
            const result = promoteFromWaitlist(registrations, people, id, capacity);
            if (!result.promoted) break;
            registrations = result.regs;
          }
          return {
            classes: s.classes.map((c) => (c.id === id ? updated : c)),
            registrations,
          };
        });
      },

      deleteClass: (id) => {
        set((s) => ({
          classes: s.classes.filter((c) => c.id !== id),
          registrations: s.registrations.filter((r) => r.classId !== id),
        }));
      },

      getOrCreatePerson: (name, contact) => {
        const n = name.trim();
        const c = contact.trim();
        const existing = get().people.find((p) => p.name === n && p.contact === c);
        if (existing) return existing;
        const person: Person = {
          id: uid(),
          name: n,
          contact: c,
          noShowCount: 0,
          createdAt: Date.now(),
        };
        set((s) => ({ people: [...s.people, person] }));
        return person;
      },

      register: (classId, name, contact) => {
        const cls = get().classes.find((c) => c.id === classId);
        if (!cls) return { ok: false, reason: 'invalid' };
        // 已经开过的课不许再报名
        if (isClosed(cls)) return { ok: false, reason: 'closed' };
        if (!name.trim()) return { ok: false, reason: 'invalid' };

        const person = get().getOrCreatePerson(name, contact);

        // 同一人同一期不许占两个名额（正式名单或候补都算）
        const dup = findActiveRegistration(get().registrations, classId, person.id);
        if (dup) return { ok: false, reason: 'duplicate' };

        const seats = countSeats(get().registrations.filter((r) => r.classId === classId));
        const status: Registration['status'] = seats >= cls.capacity ? 'waitlist' : 'enrolled';
        const reg: Registration = {
          id: uid(),
          classId,
          personId: person.id,
          personName: person.name,
          contact: person.contact,
          status,
          createdAt: Date.now(),
          ...(status === 'enrolled' ? { promotedAt: Date.now() } : {}),
        };
        set((s) => ({ registrations: [...s.registrations, reg] }));
        return { ok: true, registration: reg, enqueued: status === 'waitlist' };
      },

      cancelRegistration: (regId) => {
        const state = get();
        const reg = state.registrations.find((r) => r.id === regId);
        if (!reg) return { ok: false, reason: 'notfound' };
        const cls = state.classes.find((c) => c.id === reg.classId);
        if (!cls) return { ok: false, reason: 'notfound' };
        // 开课后不能再退（已经上过的课）
        if (isClosed(cls)) return { ok: false, reason: 'closed' };
        if (reg.status !== 'enrolled' && reg.status !== 'waitlist') {
          return { ok: false, reason: 'notfound' };
        }

        const wasSeated = holdsSeat(reg.status);
        const { percent } = wasSeated
          ? refundAt(cls.refundTiers, cls)
          : { percent: 0 };

        let registrations = state.registrations.map((r) =>
          r.id === regId
            ? {
                ...r,
                status: 'cancelled' as const,
                cancelledAt: Date.now(),
                refundPercent: wasSeated ? percent : undefined,
              }
            : r
        );

        // 正式名单退出，按候补排队顺序（爽约少的优先）递补
        let promoted: Registration | null = null;
        if (wasSeated) {
          const result = promoteFromWaitlist(
            registrations,
            state.people,
            cls.id,
            cls.capacity
          );
          registrations = result.regs;
          promoted = result.promoted;
        }

        set({ registrations });
        return { ok: true, refundPercent: percent, promoted };
      },

      setAttendance: (regId, attended) => {
        const state = get();
        const reg = state.registrations.find((r) => r.id === regId);
        if (!reg) return { ok: false, reason: 'notfound' };
        const cls = state.classes.find((c) => c.id === reg.classId);
        if (!cls) return { ok: false, reason: 'notfound' };
        // 只有正式名单（开课后）才能点名
        if (isClosed(cls) === false) return { ok: false, reason: 'closed' };
        if (!holdsSeat(reg.status)) return { ok: false, reason: 'notseated' };

        const newStatus: Registration['status'] = attended ? 'attended' : 'noshow';
        const wasNoShow = reg.status === 'noshow';
        const updated: Registration = { ...reg, status: newStatus };

        // 爽约次数只在「新变成爽约」时累计一次，反复切换不重复计数
        let people = state.people;
        if (!attended && !wasNoShow) {
          people = people.map((p) =>
            p.id === reg.personId ? { ...p, noShowCount: p.noShowCount + 1 } : p
          );
        } else if (attended && wasNoShow) {
          // 从爽约改回已到课，撤销之前累计的那一次
          people = people.map((p) =>
            p.id === reg.personId ? { ...p, noShowCount: Math.max(0, p.noShowCount - 1) } : p
          );
        }

        set({
          registrations: state.registrations.map((r) => (r.id === regId ? updated : r)),
          people,
        });
        return { ok: true, registration: updated };
      },
    }),
    {
      name: 'knitting-signup-storage',
    }
  )
);
