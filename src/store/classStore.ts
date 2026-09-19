import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  addSession as domAddSession,
  register as domRegister,
  cancelSignup as domCancelSignup,
  markAttendance as domMarkAttendance,
  type CourseSession,
  type Signup,
  type SessionInput,
  type Ledger,
  type Result,
} from '../domain/registration';

interface ClassState {
  sessions: CourseSession[];
  signups: Signup[];
}

interface ClassActions {
  addSession: (input: SessionInput) => Result<CourseSession>;
  register: (sessionId: string, name: string, phone: string) => Result<Signup>;
  cancelSignup: (signupId: string) => Result<{ refund: number; promoted: Signup | null }>;
  markAttendance: (signupId: string, attended: boolean) => Result<null>;
  deleteSession: (sessionId: string) => Result<null>;
}

function ledgerOf(s: ClassState): Ledger {
  return { sessions: s.sessions, signups: s.signups };
}

export const useClassStore = create<ClassState & ClassActions>()(
  persist(
    (set, get) => ({
      sessions: [],
      signups: [],

      addSession: (input) => {
        const res = domAddSession(ledgerOf(get()), input, new Date());
        if (!res.ok) return res;
        set({ sessions: res.value.ledger.sessions, signups: res.value.ledger.signups });
        return { ok: true, value: res.value.session };
      },

      register: (sessionId, name, phone) => {
        const res = domRegister(ledgerOf(get()), sessionId, name, phone, new Date());
        if (!res.ok) return res;
        set({ sessions: res.value.ledger.sessions, signups: res.value.ledger.signups });
        return { ok: true, value: res.value.signup };
      },

      cancelSignup: (signupId) => {
        const res = domCancelSignup(ledgerOf(get()), signupId, new Date());
        if (!res.ok) return res;
        set({ sessions: res.value.ledger.sessions, signups: res.value.ledger.signups });
        return { ok: true, value: { refund: res.value.refund, promoted: res.value.promoted } };
      },

      markAttendance: (signupId, attended) => {
        const res = domMarkAttendance(ledgerOf(get()), signupId, attended, new Date());
        if (!res.ok) return res;
        set({ sessions: res.value.ledger.sessions, signups: res.value.ledger.signups });
        return { ok: true, value: null };
      },

      deleteSession: (sessionId) => {
        const { sessions, signups } = get();
        if (signups.some((s) => s.sessionId === sessionId)) {
          return { ok: false, error: '这期已有报名记录，留着当台账，不能删' };
        }
        set({ sessions: sessions.filter((s) => s.id !== sessionId) });
        return { ok: true, value: null };
      },
    }),
    { name: 'knitting-class-ledger' }
  )
);
