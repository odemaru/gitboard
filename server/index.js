import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import path from 'node:path';
import { existsSync } from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import * as git from './git.js';
import * as store from './store.js';
import { relTime, daysSince, todayYmd } from './util.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 4317);
const DIST = path.join(__dirname, '..', 'web', 'dist');

const app = Fastify({ logger: false });

// The API answers on localhost without authentication, so any page the user
// visits can send it requests. Same-origin policy stops such a page reading the
// response — but DNS rebinding defeats that, since the attacker's name resolves
// to 127.0.0.1 and the browser then treats it as same-origin. Pinning the Host
// header is what rebinding cannot forge.
const ALLOWED_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]', '::1']);

app.addHook('onRequest', async (req, reply) => {
  const host = String(req.headers.host ?? '').replace(/:\d+$/, '');
  if (!ALLOWED_HOSTS.has(host)) {
    return reply.code(403).send({ error: 'forbidden host' });
  }
});

/** Bounded concurrency — a 50-repo scan otherwise spawns a few hundred gits at once. */
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
      }
    }),
  );
  return out;
}

let cache = { at: 0, data: null };
const CACHE_MS = 10_000;

/** Discovery finds every checkout; worktrees of one repo collapse to a single entry. */
async function walkForRepos(config) {
  const paths = await git.discoverRepos(config.roots, config.maxDepth);
  const identified = await mapLimit(paths, 12, async (p) => ({ path: p, id: await git.identity(p) }));

  const groups = new Map();
  for (const { path: repoPath, id } of identified) {
    if (!id) continue;
    const group = groups.get(id.commonDir) ?? { primary: null, all: [] };
    group.all.push(repoPath);
    if (id.isPrimary) group.primary = repoPath;
    groups.set(id.commonDir, group);
  }

  const primaries = [...groups.values()]
    .map((g) => g.primary ?? g.all.slice().sort()[0])
    .sort();
  await store.writeDiscovery(primaries);
  return primaries;
}

const DISCOVERY_TTL_MS = 5 * 60_000;
let walking = null;

/**
 * Only the very first scan pays for the filesystem walk. After that the stored
 * list answers immediately and a stale one is refreshed in the background.
 */
async function primaryRepoPaths(config, force) {
  const cached = await store.readDiscovery();
  if (force || !cached?.paths) return walkForRepos(config);

  if (Date.now() - cached.at > DISCOVERY_TTL_MS && !walking) {
    walking = walkForRepos(config)
      .catch(() => {})
      .finally(() => { walking = null; });
  }
  return cached.paths.filter((p) => existsSync(path.join(p, '.git')));
}

function noteIndex(notes) {
  const byRepo = new Map();
  for (const note of notes) {
    const bucket = byRepo.get(note.repoId) ?? { count: 0, open: 0 };
    bucket.count += 1;
    bucket.open += store.parseTasks(note.markdown).filter((t) => !t.done).length;
    byRepo.set(note.repoId, bucket);
  }
  return byRepo;
}

async function scanRepos({ force = false } = {}) {
  if (!force && cache.data && Date.now() - cache.at < CACHE_MS) return cache.data;

  const config = await store.loadConfig();
  const registered = await store.resolveIds(await primaryRepoPaths(config, force));
  const notes = noteIndex(await store.allNotes());

  const repos = await mapLimit(registered, 8, async ({ id, path: repoPath }) => {
    const branches = await git.listBranches(repoPath);
    const names = branches.map((b) => b.name);
    const [head, trees] = await Promise.all([
      git.currentBranch(repoPath),
      git.worktrees(repoPath),
    ]);
    const base = await git.mainBranch(repoPath, names);
    const merged = await git.mergedInto(repoPath, base);

    const others = branches.filter((b) => b.name !== base);
    const last = branches[0];
    const note = notes.get(id) ?? { count: 0, open: 0 };

    return {
      id,
      name: path.basename(repoPath),
      path: repoPath,
      head,
      base,
      branchCount: branches.length,
      mergedCount: others.filter((b) => merged.has(b.name)).length,
      staleCount: others.filter((b) => !merged.has(b.name) && daysSince(b.date) > config.staleDays).length,
      worktrees: trees.filter((w) => w.path !== repoPath).map((w) => ({
        name: path.basename(w.path),
        branch: w.branch,
      })),
      noteCount: note.count,
      openTasks: note.open,
      lastCommit: last ? { date: last.date, rel: relTime(last.date), author: last.author } : null,
      stale: last ? daysSince(last.date) > config.staleDays : false,
    };
  });

  repos.sort((a, b) => {
    const at = a.lastCommit ? new Date(a.lastCommit.date).getTime() : 0;
    const bt = b.lastCommit ? new Date(b.lastCommit.date).getTime() : 0;
    return bt - at;
  });

  cache = { at: Date.now(), data: repos };
  return repos;
}

const invalidate = () => { cache = { at: 0, data: null }; };

app.get('/api/health', async () => {
  const git_ = await git.version();
  return { ok: Boolean(git_), git: git_, home: os.homedir(), platform: process.platform };
});

app.get('/api/config', async () => store.loadConfig());

app.put('/api/config', async (req) => {
  const saved = await store.saveConfig({ ...(await store.loadConfig()), ...req.body });
  await store.clearDiscovery();
  invalidate();
  return saved;
});

app.get('/api/repos', async (req) => scanRepos({ force: req.query.refresh === '1' }));

app.get('/api/repos/:id/branches', async (req, reply) => {
  const repoPath = await store.pathForId(req.params.id);
  if (!repoPath) return reply.code(404).send({ error: 'unknown repo' });

  const config = await store.loadConfig();
  const branches = await git.listBranches(repoPath);
  const [head, trees] = await Promise.all([
    git.currentBranch(repoPath),
    git.worktrees(repoPath),
  ]);
  const base = await git.mainBranch(repoPath, branches.map((b) => b.name));
  const merged = await git.mergedInto(repoPath, base);

  const treeByBranch = new Map(trees.filter((w) => w.branch).map((w) => [w.branch, w.path]));
  const notes = (await store.allNotes()).filter((n) => n.repoId === req.params.id);
  const noteByBranch = new Map(notes.map((n) => [n.branch, n]));

  const rows = branches.map((b) => {
    const note = noteByBranch.get(b.name);
    const tasks = note ? store.parseTasks(note.markdown) : [];
    const isMerged = b.name !== base && merged.has(b.name);
    const checkedOutIn = treeByBranch.get(b.name);
    return {
      ...b,
      rel: relTime(b.date),
      isHead: b.name === head,
      isBase: b.name === base,
      merged: isMerged,
      stale: !isMerged && b.name !== base && daysSince(b.date) > config.staleDays,
      worktree: checkedOutIn && checkedOutIn !== repoPath ? path.basename(checkedOutIn) : null,
      hasNote: Boolean(note),
      openTasks: tasks.filter((t) => !t.done).length,
      doneTasks: tasks.filter((t) => t.done).length,
    };
  });

  return {
    repo: { id: req.params.id, name: path.basename(repoPath), path: repoPath, head, base },
    branches: rows,
  };
});

app.get('/api/repos/:id/note', async (req, reply) => {
  const repoPath = await store.pathForId(req.params.id);
  if (!repoPath) return reply.code(404).send({ error: 'unknown repo' });
  const { branch } = req.query;
  if (!branch) return reply.code(400).send({ error: 'branch required' });

  const [markdown, log, branches] = await Promise.all([
    store.readNote(req.params.id, branch),
    git.commits(repoPath, branch, 5),
    git.listBranches(repoPath),
  ]);
  const base = await git.mainBranch(repoPath, branches.map((b) => b.name));
  const counts = await git.aheadBehind(repoPath, base, branch);

  return {
    repo: { id: req.params.id, name: path.basename(repoPath), path: repoPath },
    branch,
    base,
    counts,
    markdown: markdown ?? '',
    notePath: store.notePath(req.params.id, branch),
    commits: log.map((c) => ({ ...c, rel: relTime(c.date) })),
    allBranches: branches.map((b) => ({ name: b.name, rel: relTime(b.date) })),
  };
});

app.put('/api/repos/:id/note', async (req, reply) => {
  const repoPath = await store.pathForId(req.params.id);
  if (!repoPath) return reply.code(404).send({ error: 'unknown repo' });
  const { branch, markdown } = req.body ?? {};
  if (!branch) return reply.code(400).send({ error: 'branch required' });
  await store.writeNote(req.params.id, branch, markdown ?? '');
  invalidate();
  return { ok: true, path: store.notePath(req.params.id, branch) };
});

app.get('/api/tasks', async () => {
  const notes = await store.allNotes();
  const ids = [...new Set(notes.map((n) => n.repoId))];
  const nameById = new Map(
    await Promise.all(ids.map(async (id) => {
      const p = await store.pathForId(id);
      return [id, p ? path.basename(p) : id];
    })),
  );

  const today = todayYmd();
  const groups = { overdue: [], today: [], later: [], undated: [] };

  for (const note of notes) {
    for (const task of store.parseTasks(note.markdown, note)) {
      if (task.done) continue;
      const row = { ...task, repoName: nameById.get(note.repoId) ?? note.repoId };
      if (!task.due) groups.undated.push(row);
      else if (task.due < today) groups.overdue.push(row);
      else if (task.due === today) groups.today.push(row);
      else groups.later.push(row);
    }
  }

  groups.overdue.sort((a, b) => a.due.localeCompare(b.due));
  groups.later.sort((a, b) => a.due.localeCompare(b.due));
  return { date: today, ...groups };
});

app.post('/api/tasks/toggle', async (req, reply) => {
  const { repoId, branch, line, done } = req.body ?? {};
  const markdown = await store.readNote(repoId, branch);
  if (markdown === null) return reply.code(404).send({ error: 'no note' });
  try {
    await store.writeNote(repoId, branch, store.toggleTaskLine(markdown, line, done));
  } catch (err) {
    return reply.code(409).send({ error: err.message });
  }
  invalidate();
  return { ok: true };
});

// In dev the UI is served by Vite; only mount the built bundle when it exists.
if (existsSync(DIST)) {
  await app.register(fastifyStatic, { root: DIST, wildcard: false });
  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith('/api/')) return reply.code(404).send({ error: 'not found' });
    return reply.sendFile('index.html');
  });
}

/** Port 0 lets the OS pick a free one, which is what the desktop build wants. */
export async function start({ port = PORT, host = '127.0.0.1' } = {}) {
  await app.listen({ port, host });
  const { port: bound } = app.server.address();
  return { url: `http://${host}:${bound}`, port: bound, app };
}

export { app };

// Only auto-listen when run directly (`node server/index.js`), not when the
// desktop shell imports this module to host the same server in-process.
const runDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (runDirectly) {
  start()
    .then(({ url }) => console.log(`gitboard → ${url}`))
    .catch((err) => { console.error(err); process.exit(1); });
}
