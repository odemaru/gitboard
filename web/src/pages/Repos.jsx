import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api.js';
import { Branch, Clock, Search, Sort, Refresh, Tree } from '../components/Icons.jsx';

const SORTS = [
  { key: 'date', label: 'По дате коммита' },
  { key: 'name', label: 'По имени' },
  { key: 'branches', label: 'По числу веток' },
];

export default function Repos({ focusSearch }) {
  const [repos, setRepos] = useState(null);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('date');
  const [refreshing, setRefreshing] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const input = useRef(null);

  async function load(force) {
    try {
      setError(null);
      if (force) setRefreshing(true);
      setRepos(await api.repos(force));
    } catch (err) {
      setError(err.message);
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => { load(false); }, []);

  // The very first scan walks the filesystem and can take a while on a cold
  // cache; say so rather than leaving a spinner with no explanation.
  useEffect(() => {
    if (repos) return undefined;
    const tick = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(tick);
  }, [repos]);
  useEffect(() => { if (focusSearch) input.current?.focus(); }, [focusSearch]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const shown = useMemo(() => {
    if (!repos) return [];
    const q = query.trim().toLowerCase();
    const filtered = q
      ? repos.filter((r) => r.name.toLowerCase().includes(q) || (r.head ?? '').toLowerCase().includes(q))
      : repos;
    const sorted = filtered.slice();
    if (sort === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name));
    if (sort === 'branches') sorted.sort((a, b) => b.branchCount - a.branchCount);
    return sorted;
  }, [repos, query, sort]);

  const active = repos?.filter((r) => !r.stale).length ?? 0;
  const nextSort = () => setSort(SORTS[(SORTS.findIndex((s) => s.key === sort) + 1) % SORTS.length].key);

  return (
    <main className="main">
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div className="searchbar">
          <Search size={22} color="#49454F" />
          <input
            ref={input}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по репозиториям и веткам"
          />
          <span className="kbd">⌘K</span>
        </div>
        <div style={{ flexGrow: 1 }} />
        <button className="btn-outlined" onClick={nextSort}>
          <Sort size={18} color="#6750A4" />
          {SORTS.find((s) => s.key === sort).label}
        </button>
        <button className="btn-outlined" onClick={() => load(true)} disabled={refreshing}>
          <Refresh size={18} color="#6750A4" />
          {refreshing ? 'Обновляю…' : 'Обновить'}
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, margin: '24px 0 16px' }}>
        <h1 className="title">Репозитории</h1>
        {repos && (
          <span className="body">
            {repos.length} найдено · {active} с активностью
            {query && ` · показано ${shown.length}`}
          </span>
        )}
      </div>

      {error && <div className="empty">Не удалось получить список: {error}</div>}
      {!repos && !error && (
        <div className="spinner">
          {elapsed < 3
            ? 'Обхожу репозитории…'
            : `Первый обход файловой системы — дальше список берётся из кэша. ${elapsed} с`}
        </div>
      )}
      {repos && shown.length === 0 && (
        <div className="empty">
          {query ? (
            <>По запросу «{query}» ничего не нашлось.</>
          ) : (
            <>
              Ни одного git-репозитория не нашлось.<br />
              Добавь папку, где они лежат, в <a href="#/settings">настройках</a> — или увеличь
              глубину обхода.
            </>
          )}
        </div>
      )}

      <div className="repo-grid">
        {shown.map((repo) => (
          <a key={repo.id} className="card repo-card" href={`#/r/${encodeURIComponent(repo.id)}`}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="repo-name">{repo.name}</span>
              {!repo.stale && (
                <span style={{ width: 8, height: 8, borderRadius: 4, background: 'var(--primary)', flexShrink: 0 }} />
              )}
            </div>

            <div className="repo-line">
              <Branch size={16} color="#49454F" />
              <span className="mono" style={{ fontSize: 14, color: 'var(--on-surface-variant)' }}>
                {repo.head ?? 'detached HEAD'}
              </span>
            </div>

            <div className="repo-line" style={{ marginTop: 2 }}>
              <Clock size={16} color="#79747E" />
              <span style={{ fontSize: 12, color: 'var(--outline)' }}>
                {repo.lastCommit ? repo.lastCommit.rel : 'без коммитов'}
                {repo.lastCommit?.author ? ` · ${repo.lastCommit.author}` : ''}
              </span>
            </div>

            <div className="divider" />

            <div className="chips">
              <span className="chip outlined">
                {repo.branchCount} {plural(repo.branchCount, 'ветка', 'ветки', 'веток')}
              </span>
              {repo.worktrees.length > 0 && (
                <span className="chip neutral">
                  <Tree size={13} />
                  {repo.worktrees.length} worktree
                </span>
              )}
              {repo.mergedCount > 0 && (
                <span className="chip neutral">
                  {repo.mergedCount} {plural(repo.mergedCount, 'вмержена', 'вмержены', 'вмержено')}
                </span>
              )}
              {repo.staleCount > 0 && <span className="chip danger">{repo.staleCount} протухли</span>}
              {repo.noteCount > 0 && (
                <span className="chip primary">
                  {repo.noteCount} {plural(repo.noteCount, 'заметка', 'заметки', 'заметок')}
                </span>
              )}
              {repo.openTasks > 0 && (
                <span className="chip accent">
                  {repo.openTasks} {plural(repo.openTasks, 'задача', 'задачи', 'задач')}
                </span>
              )}
            </div>
          </a>
        ))}
      </div>
    </main>
  );
}

function plural(n, one, few, many) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}
