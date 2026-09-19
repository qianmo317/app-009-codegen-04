import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSignupStore } from '../../store/signupStore';
import { countSeats, formatStart, isClosed, isTomorrow } from '../../utils/signup';
import { Badge, TopBar } from '../../components/signup/ui';
import { btnDanger, btnGhost, btnPrimary, cardStyle, pageStyle } from '../../components/signup/styles';
import ClassForm from '../../components/signup/ClassForm';

export default function ClassesPage() {
  const navigate = useNavigate();
  const classes = useSignupStore((s) => s.classes);
  const registrations = useSignupStore((s) => s.registrations);
  const createClass = useSignupStore((s) => s.createClass);
  const deleteClass = useSignupStore((s) => s.deleteClass);
  const [showForm, setShowForm] = useState(false);

  const sorted = [...classes].sort((a, b) => {
    // 未开课的在前（按开课时间升序），已开课的沉底
    const ca = isClosed(a) ? 1 : 0;
    const cb = isClosed(b) ? 1 : 0;
    if (ca !== cb) return ca - cb;
    return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
  });

  return (
    <>
      <TopBar />
      <div style={pageStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h1 style={{ fontSize: 22, margin: 0 }}>报名本子 · 期次</h1>
          <button style={btnPrimary} onClick={() => setShowForm((v) => !v)}>
            {showForm ? '收起' : '新开一期课'}
          </button>
        </div>

        {showForm && (
          <div style={{ ...cardStyle, marginBottom: 20 }}>
            <h2 style={{ fontSize: 16, margin: '0 0 14px' }}>新开一期课</h2>
            <ClassForm
              submitLabel="创建期次"
              onCancel={() => setShowForm(false)}
              onSubmit={(v) => {
                const id = createClass(v);
                setShowForm(false);
                navigate(`/classes/${id}`);
                return null;
              }}
            />
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {sorted.map((cls) => {
            const regs = registrations.filter((r) => r.classId === cls.id);
            const seats = countSeats(regs);
            const waitCount = regs.filter((r) => r.status === 'waitlist').length;
            const closed = isClosed(cls);
            const tomorrow = isTomorrow(cls);

            return (
              <div
                key={cls.id}
                style={{
                  ...cardStyle,
                  borderColor: tomorrow ? '#f0b429' : '#e0dcd5',
                  boxShadow: tomorrow ? '0 0 0 2px rgba(240,180,41,0.25)' : undefined,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 16, fontWeight: 600 }}>{cls.title}</span>
                      {closed ? (
                        <Badge tone="gray">已开课/已结束</Badge>
                      ) : seats >= cls.capacity ? (
                        <Badge tone="red">已满员</Badge>
                      ) : (
                        <Badge tone="green">报名中（剩 {cls.capacity - seats} 席）</Badge>
                      )}
                      {waitCount > 0 && <Badge tone="orange">候补 {waitCount} 人</Badge>}
                      {tomorrow && <Badge tone="blue">明天开课 · 记得核对名单</Badge>}
                    </div>
                    <div style={{ fontSize: 13, color: '#666' }}>
                      🕒 {formatStart(cls.startTime)}　📍 {cls.location}
                      {cls.teacher ? `　👩‍🏫 ${cls.teacher}` : ''}
                    </div>
                    <div style={{ fontSize: 13, color: '#666' }}>
                      座位 {seats}/{cls.capacity}　🧶 线材 {cls.yarns.length} 种　💰 学费 ¥{cls.price}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <button style={btnGhost} onClick={() => navigate(`/classes/${cls.id}`)}>
                      报名/名单
                    </button>
                    <button style={btnGhost} onClick={() => navigate(`/classes/${cls.id}/roster`)}>
                      开课前名单
                    </button>
                    <button
                      style={btnDanger}
                      onClick={() => {
                        if (confirm(`确定删除「${cls.title}」？该期所有报名记录一并删除。`)) {
                          deleteClass(cls.id);
                        }
                      }}
                    >
                      删除
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {classes.length === 0 && (
            <div style={{ ...cardStyle, color: '#888', fontSize: 14, textAlign: 'center', padding: 40 }}>
              还没有任何期次，点击右上角「新开一期课」，定好时间、地点、座位数和要带的线材。
            </div>
          )}
        </div>
      </div>
    </>
  );
}
