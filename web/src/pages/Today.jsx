import { useEffect, useState } from 'react';
import { api } from '../api.js';

const GROUPS = [
  { key: 'overdue', title: 'Просрочено', tone: 'danger', color: 'var(--error)' },
  { key: 'today', title: 'Сегодня', tone: 'primary', color: 'var(--primary)' },
  { key: 'later', title: 'Дальше', tone: 'neutral', color: 'var(--on-surface-variant)' },
  { key: 'undated', title: 'Без даты', tone: 'neutral', color: 'var(--outline)' },
];

const MONTHS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const DOW = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

export default function Today() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);

  const load = () => api.tasks().then(setData).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  async function complete(task) {
    const id = `${task.repoId}:${task.branch}:${task.line}`;
    setBusy(id);
    try {
      await api.toggleTask(task.repoId, task.branch, task.line, true);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  }

  if (error) return <main className="main"><div className="empty">{error}</div></main>;
  if (!data) return <main className="main"><div className="spinner">Собираю задачи из заметок…</div></main>;

  const total = GROUPS.reduce((n, g) => n + data[g.key].length, 0);
  const now = new Date(`${data.date}T00:00:00`);

  return (
    <main className="main">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
        <h1 className="headline">Сегодня</h1>
        <span style={{ fontSize: 16, color: 'var(--on-surface-variant)' }}>
          {DOW[now.getDay()]}, {now.getDate()} {MONTHS[now.getMonth()]} {now.getFullYear()}
        </span>
      </div>
      <div className="body muted" style={{ marginTop: 4 }}>
        {total === 0 ? 'Открытых задач нет' : `${total} открытых задач из заметок по веткам`}
      </div>

      {total === 0 && (
        <div className="empty">
          Задачи берутся из чекбоксов в заметках: <code className="mono">- [ ] текст @2026-08-28</code>
        </div>
      )}

      {GROUPS.map(({ key, title, tone, color }) => {
        const rows = data[key];
        if (!rows.length) return null;
        return (
          <div key={key}>
            <div className="group-head">
              <span style={{ color }}>{title}</span>
              <span className={`chip ${tone}`}>{rows.length}</span>
            </div>
            <div className="card" style={{ overflow: 'hidden' }}>
              {rows.map((task) => {
                const id = `${task.repoId}:${task.branch}:${task.line}`;
                return (
                  <div key={id} className="task-row">
                    <button
                      className="checkbox"
                      disabled={busy === id}
                      onClick={() => complete(task)}
                      title="Отметить выполненной"
                    />
                    <a
                      className="task-text"
                      href={`#/r/${encodeURIComponent(task.repoId)}/b/${encodeURIComponent(task.branch)}`}
                      style={{ color: 'var(--on-surface)' }}
                    >
                      {task.text}
                    </a>
                    <span className="task-source">
                      <span style={{ fontWeight: 500, color: 'var(--on-surface)' }}>{task.repoName}</span>
                      <span className="muted">·</span>
                      <span className="mono" style={{ color: 'var(--on-surface-variant)' }}>{task.branch}</span>
                    </span>
                    <span className={`due ${key === 'overdue' ? 'overdue' : key === 'today' ? 'today' : 'later'}`}>
                      {task.due ? formatDue(task.due, data.date) : '—'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </main>
  );
}

function formatDue(ymd, todayYmd) {
  const d = new Date(`${ymd}T00:00:00`);
  const label = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  const days = Math.round((new Date(`${todayYmd}T00:00:00`) - d) / 86400000);
  if (days > 0) return `${label} · ${days} дн назад`;
  if (days === 0) return label;
  return `${label} · ${DOW[d.getDay()]}`;
}
