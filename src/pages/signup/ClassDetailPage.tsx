import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { Registration } from '../../types/signup';
import { useSignupStore } from '../../store/signupStore';
import {
  daysUntilStart,
  formatStart,
  isClosed,
  refundAt,
  refundYuan,
  statusLabel,
  waitlistOrder,
} from '../../utils/signup';
import { Badge, TopBar } from '../../components/signup/ui';
import { btnDanger, btnGhost, btnPrimary, cardStyle, inputStyle, labelStyle, pageStyle } from '../../components/signup/styles';
import ClassForm from '../../components/signup/ClassForm';

const reasonText: Record<string, string> = {
  closed: '这一期已经开课，不能再报名了。',
  duplicate: '这个人已经报过这一期了（正式名单或候补中），不能占两个名额。',
  invalid: '请填写报名人姓名。',
};

export default function ClassDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const cls = useSignupStore((s) => s.classes.find((c) => c.id === id));
  const registrations = useSignupStore((s) => s.registrations);
  const people = useSignupStore((s) => s.people);
  const register = useSignupStore((s) => s.register);
  const cancelRegistration = useSignupStore((s) => s.cancelRegistration);
  const setAttendance = useSignupStore((s) => s.setAttendance);
  const updateClass = useSignupStore((s) => s.updateClass);

  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [editing, setEditing] = useState(false);
  const [, setTick] = useState(0);

  // 退费比例随时间变化，每分钟刷新一次提示
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(timer);
  }, []);

  const regs = useMemo(
    () => (cls ? registrations.filter((r) => r.classId === cls.id) : []),
    [registrations, cls]
  );

  const queue = useMemo(
    () => waitlistOrder(regs.filter((r) => r.status === 'waitlist'), people),
    [regs, people]
  );
  const seated = regs
    .filter((r) => r.status === 'enrolled' || r.status === 'attended' || r.status === 'noshow')
    .sort((a, b) => (a.promotedAt ?? a.createdAt) - (b.promotedAt ?? b.createdAt));
  const cancelled = regs
    .filter((r) => r.status === 'cancelled')
    .sort((a, b) => (b.cancelledAt ?? 0) - (a.cancelledAt ?? 0));

  const noShowOf = (personId: string) => people.find((p) => p.id === personId)?.noShowCount ?? 0;

  if (!cls) {
    return (
      <>
        <TopBar />
        <div style={pageStyle}>
          <div style={{ ...cardStyle, textAlign: 'center', color: '#888' }}>
            期次不存在或已删除。
            <div style={{ marginTop: 12 }}>
              <button style={btnGhost} onClick={() => navigate('/classes')}>
                返回期次列表
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  const closed = isClosed(cls);
  const refund = refundAt(cls.refundTiers, cls);
  const seatsLeft = cls.capacity - seated.length;
  const queuePos = new Map(queue.map((r, i) => [r.id, i + 1]));

  const doRegister = () => {
    const result = register(cls.id, name, contact);
    if (result.ok) {
      setMsg({
        ok: true,
        text: result.enqueued
          ? `已为 ${result.registration.personName} 排队候补，前面有人退出会按顺序补上（爽约次数多的排后面）。`
          : `报名成功：${result.registration.personName} 已列入正式名单。`,
      });
      setName('');
      setContact('');
    } else {
      setMsg({ ok: false, text: reasonText[result.reason] ?? '报名失败。' });
    }
  };

  const doCancel = (regId: string, who: string, enqueued: boolean) => {
    const hint = enqueued
      ? `确定让 ${who} 退出候补吗？`
      : `确定让 ${who} 退出这一期吗？按现在的退费规则可退 ${refund.percent}%（¥${refundYuan(cls, refund.percent)}）。`;
    if (!confirm(hint)) return;
    const result = cancelRegistration(regId);
    if (!result.ok) {
      alert(result.reason === 'closed' ? '课程已开课，不能再退出。' : '无法退出。');
      return;
    }
    setMsg(
      result.promoted
        ? {
            ok: true,
            text: `${who} 已退出${enqueued ? '候补' : `（退 ${result.refundPercent}%）`}；候补第 1 位 ${result.promoted.personName} 已自动补进名单。`,
          }
        : { ok: true, text: `${who} 已退出${enqueued ? '候补' : `（退 ${result.refundPercent}%）`}。` }
    );
  };

  return (
    <>
      <TopBar />
      <div style={pageStyle}>
        <button style={{ ...btnGhost, marginBottom: 12, padding: '4px 10px' }} onClick={() => navigate('/classes')}>
          ← 返回期次列表
        </button>

        <div style={{ ...cardStyle, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <h1 style={{ fontSize: 20, margin: '0 0 8px' }}>{cls.title}</h1>
              <div style={{ fontSize: 13, color: '#555', lineHeight: 1.9 }}>
                🕒 {formatStart(cls.startTime)}（{closed ? '已开课' : `距开课还有 ${daysUntilStart(cls)} 整天`}）
                <br />
                📍 {cls.location}
                {cls.teacher ? `　👩‍🏫 ${cls.teacher}` : ''}
                <br />
                💺 名额 {cls.capacity} 人，已占 {seated.length} 人{!closed && seatsLeft > 0 ? `，剩 ${seatsLeft} 席` : ''}
                {queue.length > 0 ? `，候补 ${queue.length} 人` : ''}
                <br />
                💰 学费 ¥{cls.price}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <button style={btnGhost} onClick={() => setEditing((v) => !v)}>
                {editing ? '收起编辑' : '改期次信息'}
              </button>
              <button style={btnPrimary} onClick={() => navigate(`/classes/${cls.id}/roster`)}>
                开课前一天名单
              </button>
            </div>
          </div>

          <div style={{ marginTop: 12, fontSize: 13, color: '#555' }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>本期要准备的线材：</div>
            {cls.yarns.length === 0 ? (
              <span style={{ color: '#999' }}>未登记线材</span>
            ) : (
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {cls.yarns.map((y) => (
                  <li key={y.id}>
                    {y.name}　{y.amount}
                    {y.note ? <span style={{ color: '#999' }}>（{y.note}）</span> : null}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div style={{ marginTop: 10, fontSize: 12, color: '#888' }}>
            退费规则：
            {cls.refundTiers.length === 0
              ? '一律不退。'
              : [...cls.refundTiers]
                  .sort((a, b) => b.daysBefore - a.daysBefore)
                  .map((t) => `开课前 ≥${t.daysBefore} 天退 ${t.percent}%`)
                  .join('；')}
            {!closed && `　现在退出退 ${refund.percent}%（¥${refundYuan(cls, refund.percent)}）。`}
          </div>
        </div>

        {editing && (
          <div style={{ ...cardStyle, marginBottom: 16 }}>
            <h2 style={{ fontSize: 15, margin: '0 0 12px' }}>编辑期次信息</h2>
            <ClassForm
              initial={cls}
              submitLabel="保存修改"
              onCancel={() => setEditing(false)}
              onSubmit={(v) => {
                if (v.capacity < seated.length) {
                  return `现在已有 ${seated.length} 人占座，容量不能小于这个数；如需缩编，请先安排退出。`;
                }
                updateClass(cls.id, v);
                setEditing(false);
                return null;
              }}
            />
          </div>
        )}

        {/* 报名 */}
        <div style={{ ...cardStyle, marginBottom: 16 }}>
          <h2 style={{ fontSize: 15, margin: '0 0 10px' }}>报名登记</h2>
          {closed ? (
            <div style={{ color: '#b5651d', fontSize: 13 }}>
              这一期已经开课，报名已关闭；下面可以点名（到课 / 爽约）。
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 140px' }}>
                  <label style={labelStyle}>姓名 *</label>
                  <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="报名人姓名" />
                </div>
                <div style={{ flex: '1 1 180px' }}>
                  <label style={labelStyle}>联系方式（手机/微信）</label>
                  <input
                    style={inputStyle}
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    placeholder="用于区分同名的人"
                  />
                </div>
                <div style={{ alignSelf: 'flex-end' }}>
                  <button style={btnPrimary} onClick={doRegister}>
                    {seated.length >= cls.capacity ? '排入候补' : '报名（先到先得）'}
                  </button>
                </div>
              </div>
              <div style={{ fontSize: 12, color: '#999', marginTop: 8 }}>
                报过名又没来的会记一次爽约；爽约次数多的人，以后排候补时排在后面。
              </div>
            </>
          )}
          {msg && (
            <div
              style={{
                marginTop: 10,
                fontSize: 13,
                padding: '8px 12px',
                borderRadius: 4,
                background: msg.ok ? '#e6f4ea' : '#fdecea',
                color: msg.ok ? '#1e7e34' : '#c0392b',
              }}
            >
              {msg.text}
            </div>
          )}
        </div>

        {/* 正式名单 */}
        <div style={{ ...cardStyle, marginBottom: 16 }}>
          <h2 style={{ fontSize: 15, margin: '0 0 10px' }}>
            正式名单（{seated.length}/{cls.capacity}）
          </h2>
          <RegTable
            rows={seated.map((r) => ({
              key: r.id,
              reg: r,
              badge:
                r.status === 'attended' ? (
                  <Badge tone="green">已到课</Badge>
                ) : r.status === 'noshow' ? (
                  <Badge tone="red">爽约 {noShowOf(r.personId)} 次</Badge>
                ) : (
                  <Badge tone="blue">{closed ? '未点名' : statusLabel(r.status)}</Badge>
                ),
              noShow: noShowOf(r.personId),
              extra: closed ? (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    style={btnGhost}
                    onClick={() => setAttendance(r.id, true)}
                    disabled={r.status === 'attended'}
                  >
                    到课
                  </button>
                  <button
                    style={btnDanger}
                    onClick={() => setAttendance(r.id, false)}
                    disabled={r.status === 'noshow'}
                  >
                    爽约
                  </button>
                </div>
              ) : (
                <button style={btnDanger} onClick={() => doCancel(r.id, r.personName, false)}>
                  退出（退{refundAt(cls.refundTiers, cls).percent}%）
                </button>
              ),
            }))}
            empty="还没有人占座。"
            showPosition={false}
          />
        </div>

        {/* 候补 */}
        <div style={{ ...cardStyle, marginBottom: 16 }}>
          <h2 style={{ fontSize: 15, margin: '0 0 6px' }}>候补排队（{queue.length}）</h2>
          <div style={{ fontSize: 12, color: '#999', marginBottom: 10 }}>
            排序规则：爽约次数少的在前；爽约次数相同，报名早的在前。有人退出正式名单时，队首自动补上。
          </div>
          <RegTable
            rows={queue.map((r) => ({
              key: r.id,
              reg: r,
              badge: <Badge tone="orange">候补第 {queuePos.get(r.id)} 位</Badge>,
              noShow: noShowOf(r.personId),
              extra: !closed ? (
                <button style={btnDanger} onClick={() => doCancel(r.id, r.personName, true)}>
                  退出候补
                </button>
              ) : null,
            }))}
            empty="候补为空。"
            showPosition
          />
        </div>

        {/* 退出记录 */}
        {cancelled.length > 0 && (
          <div style={{ ...cardStyle }}>
            <h2 style={{ fontSize: 15, margin: '0 0 10px' }}>退出记录</h2>
            <RegTable
              rows={cancelled.map((r) => ({
                key: r.id,
                reg: r,
                badge: <Badge tone="gray">已退出{r.refundPercent != null ? ` · 退 ${r.refundPercent}%` : ''}</Badge>,
                noShow: noShowOf(r.personId),
                extra: null,
              }))}
              empty=""
              showPosition={false}
            />
          </div>
        )}
      </div>
    </>
  );
}

function RegTable({
  rows,
  empty,
  showPosition,
}: {
  rows: {
    key: string;
    reg: Registration;
    badge: React.ReactNode;
    noShow: number;
    extra: React.ReactNode;
  }[];
  empty: string;
  showPosition: boolean;
}) {
  if (rows.length === 0) return <div style={{ color: '#999', fontSize: 13 }}>{empty}</div>;
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
      <thead>
        <tr style={{ borderBottom: '1px solid #e0dcd5', color: '#999', textAlign: 'left' }}>
          {showPosition && <th style={{ padding: '6px 8px', width: 70 }}>队位</th>}
          <th style={{ padding: '6px 8px' }}>姓名</th>
          <th style={{ padding: '6px 8px' }}>联系方式</th>
          <th style={{ padding: '6px 8px', width: 110 }}>累计爽约</th>
          <th style={{ padding: '6px 8px', width: 150 }}>状态</th>
          <th style={{ padding: '6px 8px', width: 180, textAlign: 'right' }}>操作</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={row.key} style={{ borderBottom: '1px solid #f0eeea' }}>
            {showPosition && <td style={{ padding: '6px 8px' }}>#{i + 1}</td>}
            <td style={{ padding: '6px 8px', fontWeight: 500 }}>{row.reg.personName}</td>
            <td style={{ padding: '6px 8px', color: '#666' }}>{row.reg.contact || '—'}</td>
            <td style={{ padding: '6px 8px', color: row.noShow > 0 ? '#c0392b' : '#666' }}>{row.noShow} 次</td>
            <td style={{ padding: '6px 8px' }}>{row.badge}</td>
            <td style={{ padding: '6px 8px', textAlign: 'right' }}>{row.extra}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
