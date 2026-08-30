import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const run = promisify(execFile);

const SEP = '\x1f';

async function git(repo, args) {
  const { stdout } = await run('git', ['-C', repo, ...args], {
    maxBuffer: 8 * 1024 * 1024,
    timeout: 15000,
  });
  return stdout;
}

async function gitSafe(repo, args, fallback = '') {
  try {
    return await git(repo, args);
  } catch {
    return fallback;
  }
}

const SKIP_DIRS = new Set([
  'node_modules', 'Library', '.Trash', 'vendor', 'venv', '.venv',
  'target', 'build', 'dist', '.next', '.cache', 'Applications',
  // Media libraries are enormous and never hold a checkout. Walking them
  // cold-cache is what turned a home-directory scan into a 50-second stall.
  'Pictures', 'Music', 'Movies', 'Public', 'Applications (Parallels)',
  // Windows noise
  'AppData', 'Application Data', 'NTUSER.DAT', '$Recycle.Bin', 'ntuser.dat.LOG1',
]);

// macOS bundles are directories but are opaque to us.
const SKIP_SUFFIXES = ['.app', '.photoslibrary', '.musiclibrary', '.tvlibrary',
  '.framework', '.bundle', '.xcodeproj', '.xcworkspace', '.sparsebundle'];

const skippable = (name) =>
  name.startsWith('.') || SKIP_DIRS.has(name) || SKIP_SUFFIXES.some((s) => name.endsWith(s));

export async function discoverRepos(roots, maxDepth) {
  const found = [];
  const seen = new Set();

  async function walk(dir, depth) {
    if (depth > maxDepth) return;
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    if (entries.some((e) => e.name === '.git')) {
      const real = path.resolve(dir);
      if (!seen.has(real)) {
        seen.add(real);
        found.push(real);
      }
      return;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (skippable(entry.name)) continue;
      await walk(path.join(dir, entry.name), depth + 1);
    }
  }

  for (const root of roots) await walk(root, 0);
  return found.sort();
}

export async function currentBranch(repo) {
  const out = (await gitSafe(repo, ['rev-parse', '--abbrev-ref', 'HEAD'])).trim();
  return out && out !== 'HEAD' ? out : null;
}

export async function mainBranch(repo, names) {
  for (const candidate of ['main', 'master', 'trunk', 'develop']) {
    if (names.includes(candidate)) return candidate;
  }
  return names[0] ?? null;
}

export async function listBranches(repo) {
  const fmt = ['%(refname:short)', '%(objectname:short)', '%(committerdate:iso8601)',
    '%(authorname)', '%(contents:subject)'].join(SEP);
  const out = await gitSafe(repo, ['for-each-ref', '--sort=-committerdate', 'refs/heads/', `--format=${fmt}`]);
  return out.split('\n').filter(Boolean).map((line) => {
    const [name, sha, date, author, subject] = line.split(SEP);
    return { name, sha, date, author, subject: subject ?? '' };
  });
}

export async function mergedInto(repo, target) {
  if (!target) return new Set();
  const out = await gitSafe(repo, ['branch', '--merged', target, '--format=%(refname:short)']);
  return new Set(out.split('\n').map((s) => s.trim()).filter(Boolean));
}

export async function aheadBehind(repo, base, branch) {
  if (!base || base === branch) return null;
  const out = (await gitSafe(repo, ['rev-list', '--left-right', '--count', `${base}...${branch}`])).trim();
  if (!out) return null;
  const [behind, ahead] = out.split(/\s+/).map(Number);
  return { ahead, behind };
}

export async function commits(repo, branch, limit = 5) {
  const fmt = ['%h', '%s', '%cI', '%an'].join(SEP);
  const out = await gitSafe(repo, ['log', `-n${limit}`, `--format=${fmt}`, branch, '--']);
  return out.split('\n').filter(Boolean).map((line) => {
    const [sha, subject, date, author] = line.split(SEP);
    return { sha, subject, date, author };
  });
}

export async function isDirty(repo) {
  const out = await gitSafe(repo, ['status', '--porcelain']);
  return out.trim().length > 0;
}

/** Null when git is not on PATH — the UI turns that into a real message. */
export async function version() {
  try {
    const { stdout } = await run('git', ['--version'], { timeout: 5000 });
    return stdout.trim();
  } catch {
    return null;
  }
}

export async function isRepo(dir) {
  try {
    const s = await stat(path.join(dir, '.git'));
    return s.isDirectory() || s.isFile();
  } catch {
    return false;
  }
}

/**
 * A linked worktree reports the main repo's .git as its common dir. Grouping on
 * that folds a repo's worktrees back into one entry instead of N identical ones.
 */
export async function identity(repo) {
  const [gitDir, commonDir] = await Promise.all([
    gitSafe(repo, ['rev-parse', '--absolute-git-dir']),
    gitSafe(repo, ['rev-parse', '--path-format=absolute', '--git-common-dir']),
  ]);
  const g = gitDir.trim();
  const c = commonDir.trim();
  if (!c) return null;
  return { gitDir: g, commonDir: c, isPrimary: g === c };
}

export async function worktrees(repo) {
  const out = await gitSafe(repo, ['worktree', 'list', '--porcelain']);
  return out.split('\n\n').filter(Boolean).map((record) => {
    const fields = {};
    for (const line of record.split('\n')) {
      const [key, ...rest] = line.split(' ');
      fields[key] = rest.join(' ');
    }
    if (!fields.worktree) return null;
    return {
      path: fields.worktree,
      branch: fields.branch ? fields.branch.replace(/^refs\/heads\//, '') : null,
      detached: 'detached' in fields,
    };
  }).filter(Boolean);
}
