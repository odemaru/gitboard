import { useEffect, useState } from 'react';
import NavRail from './components/NavRail.jsx';
import Repos from './pages/Repos.jsx';
import Branches from './pages/Branches.jsx';
import BranchNote from './pages/BranchNote.jsx';
import Today from './pages/Today.jsx';
import Settings from './pages/Settings.jsx';
import { api } from './api.js';

function parseRoute(hash) {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (parts[0] === 'today') return { page: 'today' };
  if (parts[0] === 'settings') return { page: 'settings' };
  if (parts[0] === 'search') return { page: 'repos', focusSearch: true };
  if (parts[0] === 'r' && parts[1]) {
    const repoId = decodeURIComponent(parts[1]);
    if (parts[2] === 'b' && parts[3]) {
      // Branch names contain slashes, so everything past /b/ is one encoded segment.
      return { page: 'note', repoId, branch: decodeURIComponent(parts.slice(3).join('/')) };
    }
    return { page: 'branches', repoId };
  }
  return { page: 'repos' };
}

// In the desktop shell the macOS traffic lights float over the top-left of the
// content, so the rail needs to start below them.
const IS_DESKTOP = /Electron/i.test(navigator.userAgent);

function useRoute() {
  const [route, setRoute] = useState(() => parseRoute(window.location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

export default function App() {
  const route = useRoute();
  const [openTasks, setOpenTasks] = useState(0);
  const [health, setHealth] = useState(null);

  useEffect(() => {
    fetch('/api/health').then((r) => r.json()).then(setHealth).catch(() => {});
  }, []);

  useEffect(() => {
    let alive = true;
    api.tasks()
      .then((t) => alive && setOpenTasks(t.overdue.length + t.today.length))
      .catch(() => {});
    return () => { alive = false; };
  }, [route]);

  const railActive = { note: 'repos', branches: 'repos' }[route.page] ?? route.page;

  const shellClass = `app${IS_DESKTOP ? ' is-desktop' : ''}`;

  if (health && !health.ok) {
    return (
      <div className={shellClass}>
        {IS_DESKTOP && <div className="titlebar-drag" />}
        <NavRail active={railActive} openTasks={0} />
        <main className="main">
          <h1 className="headline">Не найден git</h1>
          <p className="body" style={{ marginTop: 12, maxWidth: 560, fontSize: 15 }}>
            Gitboard читает репозитории через системный <span className="mono">git</span>, а его нет
            в PATH. Поставь git и перезапусти приложение.
          </p>
          <div className="card" style={{ padding: 16, marginTop: 20, maxWidth: 560 }}>
            <div className="label">macOS</div>
            <div className="mono" style={{ fontSize: 13, marginTop: 4 }}>xcode-select --install</div>
            <div className="label" style={{ marginTop: 16 }}>Windows</div>
            <div className="mono" style={{ fontSize: 13, marginTop: 4 }}>winget install --id Git.Git</div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className={shellClass}>
      {IS_DESKTOP && <div className="titlebar-drag" />}
      <NavRail active={railActive} openTasks={openTasks} />
      {route.page === 'repos' && <Repos focusSearch={route.focusSearch} />}
      {route.page === 'branches' && <Branches repoId={route.repoId} />}
      {route.page === 'note' && <BranchNote repoId={route.repoId} branch={route.branch} />}
      {route.page === 'today' && <Today />}
      {route.page === 'settings' && <Settings />}
    </div>
  );
}
