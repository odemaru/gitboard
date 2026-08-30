import { useCallback, useEffect, useRef, useState } from 'react';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import { ru } from '@blocknote/core/locales';
import '@blocknote/mantine/style.css';
import { api } from '../api.js';
import { Branch, Chevron } from '../components/Icons.jsx';

export default function BranchNote({ repoId, branch }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState('idle');

  useEffect(() => {
    let alive = true;
    setData(null);
    setStatus('idle');
    api.note(repoId, branch)
      .then((d) => alive && setData(d))
      .catch((err) => alive && setError(err.message));
    return () => { alive = false; };
  }, [repoId, branch]);

  const save = useCallback(async (markdown) => {
    setStatus('saving');
    try {
      await api.saveNote(repoId, branch, markdown);
      setStatus('saved');
    } catch (err) {
      setError(err.message);
      setStatus('error');
    }
  }, [repoId, branch]);

  if (error) return <main className="main"><div className="empty">{error}</div></main>;
  if (!data) return <main className="main"><div className="spinner">Читаю заметку…</div></main>;

  return (
    <main className="main">
      <div className="breadcrumbs">
        <a href="#/">Репозитории</a>
        <span className="sep"><Chevron size={18} color="#79747E" /></span>
        <a href={`#/r/${encodeURIComponent(repoId)}`}>{data.repo.name}</a>
        <span className="sep"><Chevron size={18} color="#79747E" /></span>
        <span style={{ color: 'var(--on-surface-variant)' }}>{branch}</span>
      </div>

      <div className="card" style={{ padding: '16px 20px', marginTop: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Branch size={20} color="#1D1B20" />
          <span className="mono" style={{ fontSize: 20, fontWeight: 500 }}>{branch}</span>
          {data.counts && data.counts.ahead > 0 && (
            <span className="chip info">{data.counts.ahead} впереди {data.base}</span>
          )}
          {data.counts && data.counts.behind > 0 && (
            <span className="chip neutral">{data.counts.behind} позади {data.base}</span>
          )}
          <div style={{ flexGrow: 1 }} />
          <SaveStatus status={status} />
        </div>

        <div className="divider" />
        <span className="label">Последние коммиты</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 8 }}>
          {data.commits.map((c) => (
            <div key={c.sha} style={{ display: 'flex', alignItems: 'center', gap: 12, height: 24 }}>
              <span className="mono" style={{ fontSize: 12, color: 'var(--primary)', width: 62, flexShrink: 0 }}>{c.sha}</span>
              <span className="cell" style={{ flexGrow: 1 }}>{c.subject}</span>
              <span style={{ fontSize: 12, color: 'var(--outline)', flexShrink: 0 }}>{c.rel}</span>
            </div>
          ))}
          {data.commits.length === 0 && <span className="body">Коммитов нет</span>}
        </div>
      </div>

      <div className="editor-shell" style={{ marginTop: 22 }}>
        <Editor key={`${repoId}/${branch}`} initialMarkdown={data.markdown} onSave={save} />
      </div>

      <div className="body muted" style={{ marginTop: 24, fontSize: 12 }}>
        Файл заметки: <span className="mono">{data.notePath}</span>
      </div>
    </main>
  );
}

function SaveStatus({ status }) {
  if (status === 'saving') return <span className="chip neutral">Сохраняю…</span>;
  if (status === 'saved') return <span className="chip primary">Сохранено</span>;
  if (status === 'error') return <span className="chip danger">Не сохранилось</span>;
  return null;
}

const SAVE_DELAY_MS = 600;

function Editor({ initialMarkdown, onSave }) {
  const editor = useCreateBlockNote({ dictionary: ru });
  const timer = useRef(null);
  const loaded = useRef(false);

  // Keyed by branch upstream, so the initial markdown is loaded exactly once per mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (initialMarkdown.trim()) {
        const blocks = await editor.tryParseMarkdownToBlocks(initialMarkdown);
        if (!cancelled && blocks.length) editor.replaceBlocks(editor.document, blocks);
      }
      if (!cancelled) loaded.current = true;
    })();
    return () => {
      cancelled = true;
      clearTimeout(timer.current);
    };
  }, [editor, initialMarkdown]);

  const onChange = useCallback(() => {
    if (!loaded.current) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      onSave(await editor.blocksToMarkdownLossy(editor.document));
    }, SAVE_DELAY_MS);
  }, [editor, onSave]);

  return <BlockNoteView editor={editor} theme="light" onChange={onChange} />;
}
