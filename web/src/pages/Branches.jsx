import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { Branch, BranchMerged, Chevron, Note, Sort, Tree } from '../components/Icons.jsx';

const COLUMNS = '320px minmax(0, 1fr) 120px 130px 190px 96px';

export default function Branches({ repoId }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [hideMerged, setHideMerged] = useState(false);

  useEffect(() => {
    let alive = true;
    setData(null);
    api.branches(repoId)
      .then((d) => alive && setData(d))
      .catch((err) => alive && setError(err.message));
    return () => { alive = false; };
  }, [repoId]);

  const rows = useMemo(
    () => (hideMerged ? (data?.branches ?? []).filter((b) => !b.merged) : data?.branches ?? []),
    [data, hideMerged],
  );

  if (error) return <main className="main"><div className="empty">{error}</div></main>;
  if (!data) return <main className="main"><div className="spinner">Читаю ветки…</div></main>;

  const { repo } = data;
  const merged = data.branches.filter((b) => b.merged).length;
  const stale = data.branches.filter((b) => b.stale).length;

  return (
    <main className="main">
      <div className="breadcrumbs">
        <a href="#/">Репозитории</a>
        <span className="sep"><Chevron size={18} color="#79747E" /></span>
        <span style={{ color: 'var(--on-surface-variant)' }}>{repo.name}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 12, flexWrap: 'wrap' }}>
        <h1 className="headline">{repo.name}</h1>
        <span className="chip primary">
          <Branch size={14} color="#21005D" />
          HEAD → {repo.head ?? 'detached'}
        </span>
        <span className="body">
          {data.branches.length} веток · {merged} вмержены · {stale} без движения
        </span>
        <div style={{ flexGrow: 1 }} />
        {merged > 0 && (
          <button className="btn-outlined" onClick={() => setHideMerged((v) => !v)}>
            <Sort size={18} color="#6750A4" />
            {hideMerged ? 'Показать вмерженные' : 'Скрыть вмерженные'}
          </button>
        )}
      </div>

      <div className="body" style={{ marginTop: 6, fontFamily: 'var(--mono)', fontSize: 12 }}>{repo.path}</div>

      <div className="thead" style={{ gridTemplateColumns: COLUMNS, marginTop: 20 }}>
        <span className="label">Ветка</span>
        <span className="label">Последний коммит</span>
        <span className="label">Автор</span>
        <span className="label">Когда</span>
        <span className="label">Статус</span>
        <span className="label" style={{ textAlign: 'right' }}>Заметка</span>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        {rows.map((b) => (
          <a
            key={b.name}
            className={`row${b.merged ? ' merged' : ''}${b.isHead ? ' current' : ''}`}
            style={{ gridTemplateColumns: COLUMNS }}
            href={`#/r/${encodeURIComponent(repoId)}/b/${encodeURIComponent(b.name)}`}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              {b.merged ? <BranchMerged size={16} color="#49454F" /> : <Branch size={16} color={b.isHead ? '#21005D' : '#49454F'} />}
              <span
                className="cell mono branch-name"
                style={{ fontWeight: b.isHead || b.isBase ? 500 : 400, color: b.isHead ? 'var(--on-primary-container)' : 'var(--on-surface)' }}
              >
                {b.name}
              </span>
            </span>

            <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <span className="mono" style={{ fontSize: 12, color: 'var(--primary)', flexShrink: 0 }}>{b.sha}</span>
              <span className="cell dim">{b.subject}</span>
            </span>

            <span className="cell dim">{b.author}</span>
            <span className="cell dim">{b.rel}</span>

            <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
              <Status branch={b} />
              {b.worktree && (
                <span className="chip neutral" title={`Выгружена в worktree ${b.worktree}`}>
                  <Tree size={12} />
                </span>
              )}
            </span>

            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
              {b.hasNote && <Note size={18} color="#6750A4" />}
              {b.openTasks > 0 && <span className="badge">{b.openTasks}</span>}
            </span>
          </a>
        ))}
      </div>
    </main>
  );
}

function Status({ branch }) {
  if (branch.isHead) return <span className="chip primary">текущая · HEAD</span>;
  if (branch.isBase) return <span className="chip accent">основная</span>;
  if (branch.merged) return <span className="chip neutral">вмержена</span>;
  if (branch.stale) return <span className="chip danger">протухла</span>;
  return <span className="chip outlined">активная</span>;
}
