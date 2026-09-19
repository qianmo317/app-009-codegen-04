import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSignupStore } from '../../store/signupStore';
import { formatStart, isTomorrow, waitlistOrder } from '../../utils/signup';
import { Badge, TopBar } from '../../components/signup/ui';
import { btnGhost } from '../../components/signup/styles';

/**
 * 开课前一天的名单：正式名单每人一张「带什么线材」的清单，
 * 另附候补顺序表，方便老师课前核对。浏览器直接打印即可。
 */
export default function RosterPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const cls = useSignupStore((s) => s.classes.find((c) => c.id === id));
  const registrations = useSignupStore((s) => s.registrations);
  const people = useSignupStore((s) => s.people);

  const seated = useMemo(() => {
    if (!cls) return [];
    return registrations
      .filter((r) => r.classId === cls.id && (r.status === 'enrolled' || r.status === 'attended' || r.status === 'noshow'))
      .sort((a, b) => (a.promotedAt ?? a.createdAt) - (b.promotedAt ?? b.createdAt));
  }, [registrations, cls]);

  const queue = useMemo(() => {
    if (!cls) return [];
    return waitlistOrder(
      registrations.filter((r) => r.classId === cls.id && r.status === 'waitlist'),
      people
    );
  }, [registrations, people, cls]);

  if (!cls) {
    return (
      <>
        <TopBar />
        <div style={{ padding: 40, textAlign: 'center' }}>
          期次不存在。
          <div style={{ marginTop: 12 }}>
            <button className="no-print" style={btnGhost} onClick={() => navigate('/classes')}>
              返回
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <TopBar />
      <div style={{ background: '#f5f3ef', minHeight: '100vh', padding: 24 }}>
        <div className="no-print" style={{ maxWidth: 800, margin: '0 auto 16px', display: 'flex', gap: 10, alignItems: 'center' }}>
          <button style={btnGhost} onClick={() => navigate(`/classes/${cls.id}`)}>
            ← 返回报名页
          </button>
          <button style={btnPrimaryPrint} onClick={() => window.print()}>
            🖨️ 打印名单
          </button>
          {isTomorrow(cls) ? <Badge tone="blue">明天开课</Badge> : null}
          <span style={{ fontSize: 12, color: '#999' }}>提示：开课前一天打开此页打印/转发，每人的线材清单已按座位列出。</span>
        </div>

        <div
          style={{
            maxWidth: 800,
            margin: '0 auto',
            background: '#fff',
            padding: 28,
            borderRadius: 8,
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          }}
        >
          <h1 style={{ fontSize: 20, margin: '0 0 6px' }}>{cls.title} · 开课前名单</h1>
          <p style={{ fontSize: 13, color: '#666', margin: '0 0 4px' }}>
            开课时间：{formatStart(cls.startTime)}　|　地点：{cls.location}
            {cls.teacher ? `　|　老师：${cls.teacher}` : ''}
          </p>
          <p style={{ fontSize: 13, color: '#666', margin: '0 0 20px' }}>
            应到 {seated.length} 人（名额 {cls.capacity}）{queue.length > 0 ? `，候补 ${queue.length} 人` : ''}
          </p>

          <h2 style={{ fontSize: 15, borderBottom: '1px solid #e0dcd5', paddingBottom: 6 }}>
            一、正式名单与每人要带的线材
          </h2>

          {seated.map((r, i) => (
            <div
              key={r.id}
              style={{
                border: '1px solid #e0dcd5',
                borderRadius: 6,
                padding: '12px 16px',
                marginBottom: 12,
                pageBreakInside: 'avoid',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <strong style={{ fontSize: 15 }}>
                  {i + 1}. {r.personName}
                </strong>
                <span style={{ fontSize: 12, color: '#999' }}>
                  {r.contact || '未留联系方式'}
                  {r.status === 'noshow' ? '（本期爽约）' : ''}
                </span>
              </div>
              {cls.yarns.length === 0 ? (
                <div style={{ fontSize: 13, color: '#999' }}>本期未登记需自带的线材。</div>
              ) : (
                <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, lineHeight: 1.9 }}>
                  {cls.yarns.map((y) => (
                    <li key={y.id}>
                      {y.name} —— {y.amount}
                      {y.note ? <span style={{ color: '#888' }}>（{y.note}）</span> : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}

          {seated.length === 0 && <p style={{ fontSize: 13, color: '#999' }}>正式名单还没有人。</p>}

          <h2 style={{ fontSize: 15, borderBottom: '1px solid #e0dcd5', paddingBottom: 6, marginTop: 24 }}>
            二、候补顺序（有人缺席时按此顺序补位）
          </h2>
          {queue.length === 0 ? (
            <p style={{ fontSize: 13, color: '#999' }}>候补为空。</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e0dcd5', color: '#999', textAlign: 'left' }}>
                  <th style={{ padding: 6, width: 70 }}>顺位</th>
                  <th style={{ padding: 6 }}>姓名</th>
                  <th style={{ padding: 6 }}>联系方式</th>
                  <th style={{ padding: 6, width: 110 }}>累计爽约</th>
                </tr>
              </thead>
              <tbody>
                {queue.map((r, i) => {
                  const noShow = people.find((p) => p.id === r.personId)?.noShowCount ?? 0;
                  return (
                    <tr key={r.id} style={{ borderBottom: '1px solid #f0eeea' }}>
                      <td style={{ padding: 6 }}>#{i + 1}</td>
                      <td style={{ padding: 6 }}>{r.personName}</td>
                      <td style={{ padding: 6, color: '#666' }}>{r.contact || '—'}</td>
                      <td style={{ padding: 6, color: noShow ? '#c0392b' : '#666' }}>{noShow} 次</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}

const btnPrimaryPrint: React.CSSProperties = {
  padding: '6px 14px',
  borderRadius: 4,
  border: '1px solid #2471a3',
  background: '#2471a3',
  color: '#fff',
  cursor: 'pointer',
  fontSize: 13,
};
