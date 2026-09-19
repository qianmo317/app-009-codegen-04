import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useClassStore } from '../store/classStore';
import { confirmedFor, waitlistFor, hasStarted, daysUntilStart, type Material } from '../domain/registration';
import { fmtDateTime } from '../utils/datetime';

const inputStyle: React.CSSProperties = { padding: '6px 8px', border: '1px solid #d5cdc3', borderRadius: 4 };
const btnPrimary: React.CSSProperties = { padding: '8px 16px', borderRadius: 4, border: '1px solid #3498db', background: '#3498db', color: '#fff', cursor: 'pointer' };

export default function Classes() {
  const sessions = useClassStore((s) => s.sessions);
  const signups = useClassStore((s) => s.signups);
  const addSession = useClassStore((s) => s.addSession);
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [startAt, setStartAt] = useState('');
  const [location, setLocation] = useState('');
  const [capacity, setCapacity] = useState(8);
  const [fee, setFee] = useState(0);
  const [materials, setMaterials] = useState<Material[]>([{ name: '', amount: '' }]);
  const [error, setError] = useState('');

  const now = new Date();
  const sorted = [...sessions].sort((a, b) => a.startAt.localeCompare(b.startAt));

  const submit = () => {
    const res = addSession({ title, startAt, location, capacity, fee, materials });
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setError('');
    setTitle('');
    setStartAt('');
    setLocation('');
    setMaterials([{ name: '', amount: '' }]);
    navigate(`/classes/${res.value.id}`);
  };

  return (
    <div style={{ padding: 24, maxWidth: 960, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, marginBottom: 16 }}>编织课报名本</h1>

      <div style={{ border: '1px solid #e0dcd5', borderRadius: 8, padding: 16, background: '#fff', marginBottom: 24 }}>
        <div style={{ fontWeight: 600, marginBottom: 12 }}>开一期新课</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="课程名，如：基础棒针入门" style={{ ...inputStyle, flex: 2, minWidth: 180 }} />
          <input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} style={inputStyle} />
          <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="地点" style={{ ...inputStyle, flex: 1, minWidth: 120 }} />
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
          <label style={{ fontSize: 14 }}>能坐 <input type="number" min={1} value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} style={{ ...inputStyle, width: 64 }} /> 人</label>
          <label style={{ fontSize: 14 }}>学费 <input type="number" min={0} value={fee} onChange={(e) => setFee(Number(e.target.value))} style={{ ...inputStyle, width: 90 }} /> 元</label>
        </div>
        <div style={{ fontSize: 14, marginBottom: 4 }}>每人要准备的线材：</div>
        {materials.map((m, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
            <input value={m.name} onChange={(e) => setMaterials(materials.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} placeholder="线材，如：牛奶棉" style={{ ...inputStyle, flex: 1 }} />
            <input value={m.amount} onChange={(e) => setMaterials(materials.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))} placeholder="用量，如：2团" style={{ ...inputStyle, width: 110 }} />
            <button onClick={() => setMaterials(materials.filter((_, j) => j !== i))} style={{ border: '1px solid #d5cdc3', background: '#fff', borderRadius: 4, cursor: 'pointer' }}>删</button>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
          <button onClick={() => setMaterials([...materials, { name: '', amount: '' }])} style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid #bdc3c7', background: '#fff', cursor: 'pointer', fontSize: 13 }}>+ 加一种线材</button>
          <button onClick={submit} style={btnPrimary}>定下来，开课</button>
          {error && <span style={{ color: '#e74c3c', fontSize: 13 }}>{error}</span>}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
        {sorted.map((s) => {
          const ledger = { sessions, signups };
          const confirmed = confirmedFor(ledger, s.id).length;
          const waiting = waitlistFor(ledger, s.id).length;
          const started = hasStarted(s, now);
          const days = daysUntilStart(s, now);
          return (
            <div key={s.id} onClick={() => navigate(`/classes/${s.id}`)} style={{ border: '1px solid #e0dcd5', borderRadius: 8, padding: 12, background: '#fff', cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: 600 }}>{s.title}</div>
                {started ? (
                  <span style={{ fontSize: 12, color: '#fff', background: '#95a5a6', borderRadius: 4, padding: '2px 6px' }}>已开课</span>
                ) : days <= 1 ? (
                  <span style={{ fontSize: 12, color: '#fff', background: '#e67e22', borderRadius: 4, padding: '2px 6px' }}>临近开课</span>
                ) : (
                  <span style={{ fontSize: 12, color: '#2c7a4b', background: '#e8f6ee', borderRadius: 4, padding: '2px 6px' }}>报名中</span>
                )}
              </div>
              <div style={{ fontSize: 13, color: '#555', marginTop: 6 }}>{fmtDateTime(s.startAt)} · {s.location}</div>
              <div style={{ fontSize: 13, color: '#555', marginTop: 4 }}>
                已报 {confirmed}/{s.capacity} 人{waiting > 0 && `，候补 ${waiting} 人`} · 学费 {s.fee} 元
              </div>
            </div>
          );
        })}
        {sorted.length === 0 && (
          <div style={{ color: '#888', fontSize: 14, gridColumn: '1 / -1', textAlign: 'center', padding: 40 }}>
            还没有排课，先在上方开一期新课
          </div>
        )}
      </div>
    </div>
  );
}
