import { useState } from 'react';
import type { KnitClass, RefundTier, YarnItem } from '../../types/signup';
import { DEFAULT_REFUND_TIERS, REFUND_PRESETS, uid } from '../../utils/signup';
import type { ClassInput } from '../../store/signupStore';
import { btnGhost, btnPrimary, inputStyle, labelStyle } from './styles';

export type ClassFormValue = ClassInput;

function emptyYarn(): YarnItem {
  return { id: uid(), name: '', amount: '', note: '' };
}

export default function ClassForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: KnitClass;
  submitLabel: string;
  onSubmit: (value: ClassFormValue) => string | null;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [teacher, setTeacher] = useState(initial?.teacher ?? '');
  const [startTime, setStartTime] = useState(initial?.startTime ?? '');
  const [location, setLocation] = useState(initial?.location ?? '');
  const [capacity, setCapacity] = useState(initial?.capacity ?? 8);
  const [price, setPrice] = useState(initial?.price ?? 0);
  const [yarns, setYarns] = useState<YarnItem[]>(
    initial?.yarns.length ? initial.yarns : [emptyYarn()]
  );
  const [tiers, setTiers] = useState<RefundTier[]>(initial?.refundTiers ?? DEFAULT_REFUND_TIERS);
  const [error, setError] = useState<string | null>(null);

  const updateYarn = (id: string, patch: Partial<YarnItem>) =>
    setYarns((ys) => ys.map((y) => (y.id === id ? { ...y, ...patch } : y)));

  const updateTier = (i: number, patch: Partial<RefundTier>) =>
    setTiers((ts) => ts.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));

  const submit = () => {
    const cleanYarns = yarns
      .map((y) => ({ ...y, name: y.name.trim(), amount: y.amount.trim(), note: y.note?.trim() }))
      .filter((y) => y.name || y.amount);
    if (!title.trim()) return setError('请填写课程名称');
    if (!startTime) return setError('请选择开课时间');
    if (!initial && new Date(startTime).getTime() <= Date.now())
      return setError('开课时间必须在将来');
    if (!location.trim()) return setError('请填写上课地点');
    if (!Number.isFinite(capacity) || capacity < 1) return setError('人数至少为 1');
    if (initial && capacity < 0) return setError('人数不能为负');
    setError(null);
    const err = onSubmit({
      title,
      teacher,
      startTime,
      location,
      capacity: Math.floor(capacity),
      price: Math.max(0, price || 0),
      yarns: cleanYarns,
      refundTiers: [...tiers].sort((a, b) => b.daysBefore - a.daysBefore),
    });
    if (err) setError(err);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <label style={labelStyle}>课程名称 *</label>
        <input style={inputStyle} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="如：周六下午·棒针围巾入门" />
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>开课时间 *</label>
          <input
            style={inputStyle}
            type="datetime-local"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
        </div>
        <div style={{ width: 160 }}>
          <label style={labelStyle}>名额（能坐几人）*</label>
          <input
            style={inputStyle}
            type="number"
            min={1}
            value={capacity}
            onChange={(e) => setCapacity(Number(e.target.value))}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>上课地点 *</label>
          <input style={inputStyle} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="如：工作室 2 号桌" />
        </div>
        <div style={{ width: 160 }}>
          <label style={labelStyle}>主讲老师</label>
          <input style={inputStyle} value={teacher} onChange={(e) => setTeacher(e.target.value)} />
        </div>
      </div>

      <div style={{ width: 200 }}>
        <label style={labelStyle}>学费（元，用于算退费）</label>
        <input
          style={inputStyle}
          type="number"
          min={0}
          value={price}
          onChange={(e) => setPrice(Number(e.target.value))}
        />
      </div>

      <div>
        <label style={labelStyle}>要准备的线材（开课前一天的名单会按这份列给每位学员）</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {yarns.map((y) => (
            <div key={y.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                style={{ ...inputStyle, flex: 2 }}
                value={y.name}
                onChange={(e) => updateYarn(y.id, { name: e.target.value })}
                placeholder="线材名称，如：中粗羊毛线·酒红"
              />
              <input
                style={{ ...inputStyle, flex: 1 }}
                value={y.amount}
                onChange={(e) => updateYarn(y.id, { amount: e.target.value })}
                placeholder="数量，如：2 团"
              />
              <input
                style={{ ...inputStyle, flex: 1 }}
                value={y.note ?? ''}
                onChange={(e) => updateYarn(y.id, { note: e.target.value })}
                placeholder="备注（可选）"
              />
              <button style={btnDangerSmall} onClick={() => setYarns((ys) => ys.filter((x) => x.id !== y.id))}>
                删
              </button>
            </div>
          ))}
        </div>
        <button style={{ ...btnGhost, marginTop: 8 }} onClick={() => setYarns((ys) => [...ys, emptyYarn()])}>
          + 加一种线材
        </button>
      </div>

      <div>
        <label style={labelStyle}>退费规则（按开课前剩余整天数匹配，从高到低取第一个命中的档位）</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          {REFUND_PRESETS.map((p) => (
            <button key={p.label} style={btnGhost} onClick={() => setTiers(p.tiers.map((t) => ({ ...t })))}>
              {p.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {tiers.map((t, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: '#666' }}>开课前 ≥</span>
              <input
                style={{ ...inputStyle, width: 90 }}
                type="number"
                min={0}
                value={t.daysBefore}
                onChange={(e) => updateTier(i, { daysBefore: Math.max(0, Number(e.target.value)) })}
              />
              <span style={{ fontSize: 13, color: '#666' }}>整天，退</span>
              <input
                style={{ ...inputStyle, width: 90 }}
                type="number"
                min={0}
                max={100}
                value={t.percent}
                onChange={(e) =>
                  updateTier(i, { percent: Math.min(100, Math.max(0, Number(e.target.value))) })
                }
              />
              <span style={{ fontSize: 13, color: '#666' }}>%</span>
              <button style={btnDangerSmall} onClick={() => setTiers((ts) => ts.filter((_, idx) => idx !== i))}>
                删
              </button>
            </div>
          ))}
          {tiers.length === 0 && (
            <div style={{ fontSize: 13, color: '#999' }}>当前规则：一律不退。</div>
          )}
        </div>
        <button style={{ ...btnGhost, marginTop: 8 }} onClick={() => setTiers((ts) => [...ts, { daysBefore: 1, percent: 0 }])}>
          + 加一个档位
        </button>
      </div>

      {error && (
        <div style={{ color: '#c0392b', fontSize: 13, background: '#fdecea', padding: '8px 12px', borderRadius: 4 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 12 }}>
        <button style={btnPrimary} onClick={submit}>
          {submitLabel}
        </button>
        <button style={btnGhost} onClick={onCancel}>
          取消
        </button>
      </div>
    </div>
  );
}

const btnDangerSmall: React.CSSProperties = {
  fontSize: 12,
  padding: '4px 10px',
  borderRadius: 4,
  border: '1px solid #e74c3c',
  background: '#fff',
  color: '#e74c3c',
  cursor: 'pointer',
};
