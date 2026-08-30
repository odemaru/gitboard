import { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function Settings() {
  const [config, setConfig] = useState(null);
  const [saved, setSaved] = useState(false);
  const [newRoot, setNewRoot] = useState('');

  useEffect(() => { fetch('/api/config').then((r) => r.json()).then(setConfig); }, []);

  async function save(next) {
    setConfig(next);
    await fetch('/api/config', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(next),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  if (!config) return <main className="main"><div className="spinner">…</div></main>;

  return (
    <main className="main" style={{ maxWidth: 760 }}>
      <h1 className="headline">Настройки</h1>
      <p className="body" style={{ marginTop: 8 }}>
        Лежат в <span className="mono">~/.gitboard/config.json</span>, заметки — в{' '}
        <span className="mono">~/.gitboard/notes/</span>
      </p>

      <h2 className="title" style={{ marginTop: 28, fontSize: 18 }}>Папки для обхода</h2>
      <div className="card" style={{ marginTop: 12, overflow: 'hidden' }}>
        {config.roots.map((root) => (
          <div key={root} className="task-row" style={{ gridTemplateColumns: 'minmax(0,1fr) auto' }}>
            <span className="cell mono">{root}</span>
            <button
              className="btn-outlined"
              style={{ height: 32 }}
              onClick={() => save({ ...config, roots: config.roots.filter((r) => r !== root) })}
            >
              Убрать
            </button>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
        <div className="searchbar" style={{ height: 48, maxWidth: 'none', flexGrow: 1 }}>
          <input
            value={newRoot}
            placeholder="/Users/…/projects"
            onChange={(e) => setNewRoot(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newRoot.trim()) {
                save({ ...config, roots: [...config.roots, newRoot.trim()] });
                setNewRoot('');
              }
            }}
          />
        </div>
        <button
          className="btn-filled"
          onClick={() => {
            if (!newRoot.trim()) return;
            save({ ...config, roots: [...config.roots, newRoot.trim()] });
            setNewRoot('');
          }}
        >
          Добавить
        </button>
      </div>

      <div style={{ display: 'flex', gap: 32, marginTop: 32 }}>
        <NumberField
          label="Глубина обхода"
          hint="Насколько глубоко искать .git внутри папки"
          value={config.maxDepth}
          onChange={(maxDepth) => save({ ...config, maxDepth })}
        />
        <NumberField
          label="Ветка протухла через, дней"
          hint="Без коммитов дольше этого срока"
          value={config.staleDays}
          onChange={(staleDays) => save({ ...config, staleDays })}
        />
      </div>

      {saved && <div className="chip primary" style={{ marginTop: 24 }}>Сохранено</div>}
    </main>
  );
}

function NumberField({ label, hint, value, onChange }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span className="label">{label}</span>
      <input
        type="number"
        min="1"
        value={value}
        onChange={(e) => onChange(window.Number(e.target.value))}
        style={{
          width: 120, height: 44, borderRadius: 8, padding: '0 12px',
          border: '1px solid var(--outline)', background: 'transparent',
          font: 'inherit', color: 'var(--on-surface)',
        }}
      />
      <span className="body muted" style={{ fontSize: 12, maxWidth: 200 }}>{hint}</span>
    </label>
  );
}
