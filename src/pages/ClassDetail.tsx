import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useClassStore } from '../store/classStore';
import {
  confirmedFor,
  waitlistFor,
  countNoShows,
  hasStarted,
  daysUntilStart,
  refundRate,
  DEFAULT_REFUND_POLICY,
} from '../domain/registration';
import { fmtDateTime } from '../utils/datetime';

const inputStyle: React.CSSProperties = { padding: '6px 8px', border: '1px solid #d5cdc3', borderRadius: 4 };
const btnPrimary: React.CSSProperties = { padding: '6px 14px', borderRadius: 4, border: '1px solid #3498db', background: '#3498db', color: '#fff', cursor: 'pointer' };
const btnDanger: React.CSSProperties = { padding: '4px 10px', borderRadius: 4, border: '1px solid #e74c3c', background: '#fff', color: '#e74c3c', cursor: 'pointer', fontSize: 13 };
const btnPlain: React.CSSProperties = { padding: '4px 10px', borderRadius: 4, border: '1px solid #bdc3c7', background: '#fff', cursor: 'pointer', fontSize: 13 };
const thStyle: React.CSSProperties = { textAlign: 'left', padding: '6px 8px', borderBottom: '2px solid #e0dcd5', fontSize: 13, color: '#666' };
const tdStyle: React.CSSProperties = { padding: '6px 8px', borderBottom: '1px solid #f0ebe4', fontSize: 14 };

function NoShowBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span style={{ fontSize: 12, color: '#b3540e', background: '#fdf0e4', borderRadius: 4, padding: '1px 6px', marginLeft: 6 }}>
      爽约 {count} 次
    </span>
  );
}

export default function ClassDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const sessions = useClassStore((s) => s.sessions);
  const signups = useClassStore((s) => s.signups);
  const register = useClassStore((s) => s.register);
  const cancelSignup = useClassStore((s) => s.cancelSignup);
  const markAttendance = useClassStore((s) => s.markAttendance);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [msg, setMsg] = useState('');

  const session = sessions.find((s) => s.id === id);
  if (!session) {
    return (
      <div style={{ padding: 24, maxWidth: 960, margin: '0 auto' }}>
        <p>没有找到这一期课。</p>
        <button onClick={() => navigate('/classes')} style={btnPlain}>返回课程列表</button>
      </div>
    );
  }

  const now = new Date();
  const ledger = { sessions, signups };
  const confirmed = confirmedFor(ledger, session.id);
  const waitlist = waitlistFor(ledger, session.id);
  const started = hasStarted(session, now);
  const days = daysUntilStart(session, now);
  const rateNow = refundRate(DEFAULT_REFUND_POLICY, session, now);

  const doRegister = () => {
    const res = register(session.id, name, phone);
    if (!res.ok) {
      setMsg(res.error);
      return;
    }
    setMsg(res.value.status === 'confirmed' ? `${res.value.name} 报名成功，已占座。` : `已满员，${res.value.name} 排进候补第 ${waitlist.length + 1} 位。`);
    setName('');
    setPhone('');
  };

  const doCancel = (signupId: string, who: string) => {
    if (!window.confirm(`确定给「${who}」退课吗？`)) return;
    const res = cancelSignup(signupId);
    if (!res.ok) {
      setMsg(res.error);
      return;
    }
    const parts = [`已退课，退款 ${res.value.refund} 元`];
    if (res.value.promoted) parts.push(`候补的 ${res.value.promoted.name} 已补上`);
    setMsg(parts.join('；') + '。');
  };

  const doMark = (signupId: string, attended: boolean) => {
    const res = markAttendance(signupId, attended);
    setMsg(res.ok ? (attended ? '已记到课。' : '已记一次爽约。') : res.error);
  };

  return (
    <div style={{ padding: 24, maxWidth: 960, margin: '0 auto' }}>
      <button onClick={() => navigate('/classes')} style={{ ...btnPlain, marginBottom: 12 }}>← 返回课程列表</button>

      <div style={{ border: '1px solid #e0dcd5', borderRadius: 8, padding: 16, background: '#fff', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <h1 style={{ fontSize: 22, margin: 0 }}>{session.title}</h1>
          {started ? (
            <span style={{ fontSize: 13, color: '#fff', background: '#95a5a6', borderRadius: 4, padding: '2px 8px' }}>已开课，停止报名</span>
          ) : days <= 1 ? (
            <span style={{ fontSize: 13, color: '#fff', background: '#e67e22', borderRadius: 4, padding: '2px 8px' }}>临近开课，请打印下方名单</span>
          ) : (
            <span style={{ fontSize: 13, color: '#2c7a4b', background: '#e8f6ee', borderRadius: 4, padding: '2px 8px' }}>报名中，还有 {Math.floor(days)} 天开课</span>
          )}
        </div>
        <div style={{ fontSize: 14, color: '#555', marginTop: 8 }}>
          {fmtDateTime(session.startAt)} · {session.location} · 能坐 {session.capacity} 人 · 学费 {session.fee} 元
        </div>
        <div style={{ fontSize: 14, color: '#555', marginTop: 4 }}>
          每人要带：{session.materials.length > 0 ? session.materials.map((m) => `${m.name} ${m.amount}`).join('、') : '（无）'}
        </div>
        <div style={{ fontSize: 12, color: '#999', marginTop: 8 }}>
          退费规则：开课前 7 天及以上全退，3~6 天退 80%，1~2 天退 50%，不足 24 小时不退。
        </div>
      </div>

      {msg && (
        <div style={{ border: '1px solid #f0c36d', background: '#fdf6e3', borderRadius: 6, padding: '8px 12px', marginBottom: 16, fontSize: 14 }}>
          {msg}
        </div>
      )}

      {!started && (
        <div style={{ border: '1px solid #e0dcd5', borderRadius: 8, padding: 16, background: '#fff', marginBottom: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>报名</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="姓名" style={{ ...inputStyle, width: 140 }} />
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="电话（方便通知）" style={{ ...inputStyle, width: 180 }} />
            <button onClick={doRegister} style={btnPrimary}>报 名</button>
            <span style={{ fontSize: 12, color: '#999', alignSelf: 'center' }}>先到先得，满员后自动排候补</span>
          </div>
        </div>
      )}

      <div style={{ border: '1px solid #e0dcd5', borderRadius: 8, padding: 16, background: '#fff', marginBottom: 16 }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>已确认（{confirmed.length}/{session.capacity}）</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thStyle}>姓名</th>
              <th style={thStyle}>电话</th>
              <th style={thStyle}>报名时间</th>
              {started ? <th style={thStyle}>点名</th> : <th style={thStyle}>退课</th>}
            </tr>
          </thead>
          <tbody>
            {confirmed.map((s) => (
              <tr key={s.id}>
                <td style={tdStyle}>{s.name}<NoShowBadge count={countNoShows(signups, s.name)} /></td>
                <td style={tdStyle}>{s.phone || '—'}</td>
                <td style={tdStyle}>{fmtDateTime(s.createdAt)}</td>
                {started ? (
                  <td style={tdStyle}>
                    {s.attended === null ? (
                      <span style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => doMark(s.id, true)} style={btnPlain}>到课</button>
                        <button onClick={() => doMark(s.id, false)} style={btnDanger}>爽约</button>
                      </span>
                    ) : (
                      <span style={{ color: s.attended ? '#2c7a4b' : '#e74c3c' }}>{s.attended ? '已到课' : '爽约'}</span>
                    )}
                  </td>
                ) : (
                  <td style={tdStyle}>
                    <button onClick={() => doCancel(s.id, s.name)} style={btnDanger}>退课</button>
                    <span style={{ fontSize: 12, color: '#999', marginLeft: 6 }}>现在退可退 {Math.round(session.fee * rateNow * 100) / 100} 元</span>
                  </td>
                )}
              </tr>
            ))}
            {confirmed.length === 0 && (
              <tr><td colSpan={4} style={{ ...tdStyle, color: '#999' }}>还没有人报名</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {waitlist.length > 0 && (
        <div style={{ border: '1px solid #e0dcd5', borderRadius: 8, padding: 16, background: '#fff', marginBottom: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>候补（{waitlist.length} 人，爽约少的排前面）</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>顺位</th>
                <th style={thStyle}>姓名</th>
                <th style={thStyle}>电话</th>
                <th style={thStyle}>报名时间</th>
                {!started && <th style={thStyle}></th>}
              </tr>
            </thead>
            <tbody>
              {waitlist.map((s, i) => (
                <tr key={s.id}>
                  <td style={tdStyle}>{i + 1}</td>
                  <td style={tdStyle}>{s.name}<NoShowBadge count={countNoShows(signups, s.name)} /></td>
                  <td style={tdStyle}>{s.phone || '—'}</td>
                  <td style={tdStyle}>{fmtDateTime(s.createdAt)}</td>
                  {!started && (
                    <td style={tdStyle}><button onClick={() => doCancel(s.id, s.name)} style={btnPlain}>退出候补</button></td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ border: '1px solid #e0dcd5', borderRadius: 8, padding: 16, background: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontWeight: 600 }}>本期名单（开课前一天打印）</div>
          <button onClick={() => window.print()} style={btnPlain}>打印</button>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thStyle}>姓名</th>
              <th style={thStyle}>电话</th>
              <th style={thStyle}>要带的线材</th>
            </tr>
          </thead>
          <tbody>
            {confirmed.map((s) => (
              <tr key={s.id}>
                <td style={tdStyle}>{s.name}</td>
                <td style={tdStyle}>{s.phone || '—'}</td>
                <td style={tdStyle}>{session.materials.map((m) => `${m.name} ${m.amount}`).join('、') || '—'}</td>
              </tr>
            ))}
            {confirmed.length === 0 && (
              <tr><td colSpan={3} style={{ ...tdStyle, color: '#999' }}>还没有确认的学员</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
