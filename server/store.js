import { readFile, writeFile, mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const HOME = os.homedir();
export const ROOT = path.join(HOME, '.gitboard');
const CONFIG_PATH = path.join(ROOT, 'config.json');
const REGISTRY_PATH = path.join(ROOT, 'repos.json');
const NOTES_DIR = path.join(ROOT, 'notes');
const DISCOVERY_PATH = path.join(ROOT, 'discovery.json');

const DEFAULT_CONFIG = {
  roots: [HOME],
  maxDepth: 3,
  staleDays: 60,
};

async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    return fallback;
  }
}

async function writeJson(file, data) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

export async function loadConfig() {
  const stored = await readJson(CONFIG_PATH, null);
  if (!stored) {
    await writeJson(CONFIG_PATH, DEFAULT_CONFIG);
    return { ...DEFAULT_CONFIG };
  }
  return { ...DEFAULT_CONFIG, ...stored };
}

export async function saveConfig(config) {
  await writeJson(CONFIG_PATH, config);
  return config;
}

/**
 * Walking the filesystem is the one slow part of a scan — cold-cache it can take
 * tens of seconds — so the resulting repo list is kept on disk between runs.
 */
export async function readDiscovery() {
  return readJson(DISCOVERY_PATH, null);
}

export async function writeDiscovery(paths) {
  await writeJson(DISCOVERY_PATH, { at: Date.now(), paths });
}

export async function clearDiscovery() {
  await rm(DISCOVERY_PATH, { force: true });
}

/**
 * Repo ids stay put once assigned, so note paths never move under a repo.
 * Two repos sharing a basename get -2, -3 suffixes in discovery order.
 */
export async function resolveIds(repoPaths) {
  const registry = await readJson(REGISTRY_PATH, {});
  const byPath = new Map(Object.entries(registry).map(([id, p]) => [p, id]));
  const taken = new Set(Object.keys(registry));
  let changed = false;

  const result = [];
  for (const repoPath of repoPaths) {
    let id = byPath.get(repoPath);
    if (!id) {
      const base = path.basename(repoPath).replace(/[^\w.-]+/g, '-');
      id = base;
      let n = 2;
      while (taken.has(id)) id = `${base}-${n++}`;
      taken.add(id);
      registry[id] = repoPath;
      byPath.set(repoPath, id);
      changed = true;
    }
    result.push({ id, path: repoPath });
  }

  if (changed) await writeJson(REGISTRY_PATH, registry);
  return result;
}

export async function pathForId(id) {
  const registry = await readJson(REGISTRY_PATH, {});
  return registry[id] ?? null;
}

function safeSegments(branch) {
  const parts = String(branch).split('/');
  if (parts.some((p) => !p || p === '.' || p === '..' || p.includes('\0'))) {
    throw new Error(`unsafe branch name: ${branch}`);
  }
  return parts;
}

export function notePath(repoId, branch) {
  if (!/^[\w.-]+$/.test(repoId)) throw new Error(`unsafe repo id: ${repoId}`);
  const parts = safeSegments(branch);
  return path.join(NOTES_DIR, repoId, ...parts.slice(0, -1), `${parts.at(-1)}.md`);
}

export async function readNote(repoId, branch) {
  try {
    return await readFile(notePath(repoId, branch), 'utf8');
  } catch {
    return null;
  }
}

export async function writeNote(repoId, branch, markdown) {
  const file = notePath(repoId, branch);
  if (!markdown.trim()) {
    await rm(file, { force: true });
    return;
  }
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, markdown, 'utf8');
}

/** Every note on disk, as { repoId, branch, markdown }. */
export async function allNotes() {
  const notes = [];
  async function walk(dir, repoId, segments) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full, repoId, [...segments, entry.name]);
      } else if (entry.name.endsWith('.md')) {
        const branch = [...segments, entry.name.slice(0, -3)].join('/');
        notes.push({ repoId, branch, markdown: await readFile(full, 'utf8') });
      }
    }
  }
  let repos;
  try {
    repos = await readdir(NOTES_DIR, { withFileTypes: true });
  } catch {
    return notes;
  }
  for (const repo of repos) {
    if (repo.isDirectory()) await walk(path.join(NOTES_DIR, repo.name), repo.name, []);
  }
  return notes;
}

// Markdown allows -, * and + as bullets, and BlockNote serializes with *,
// so a note that round-trips through the editor must still parse as tasks.
const TASK_RE = /^(\s*)([-*+]) \[([ xX])\]\s+(.*)$/;
const ISO_DUE = /@(\d{4})-(\d{2})-(\d{2})/;
const DOT_DUE = /@(\d{1,2})\.(\d{1,2})(?:\.(\d{4}))?/;

function parseDue(text, now = new Date()) {
  const iso = text.match(ISO_DUE);
  if (iso) return { due: `${iso[1]}-${iso[2]}-${iso[3]}`, raw: iso[0] };
  const dot = text.match(DOT_DUE);
  if (dot) {
    const year = dot[3] ? Number(dot[3]) : now.getFullYear();
    const month = String(Number(dot[2])).padStart(2, '0');
    const day = String(Number(dot[1])).padStart(2, '0');
    return { due: `${year}-${month}-${day}`, raw: dot[0] };
  }
  return { due: null, raw: null };
}

/** Checkbox lines out of one note. Line numbers are 0-based, for toggling. */
export function parseTasks(markdown, { repoId, branch } = {}) {
  const tasks = [];
  markdown.split('\n').forEach((line, index) => {
    const m = line.match(TASK_RE);
    if (!m) return;
    const body = m[4];
    const { due, raw } = parseDue(body);
    tasks.push({
      repoId,
      branch,
      line: index,
      done: m[3].toLowerCase() === 'x',
      due,
      text: (raw ? body.replace(raw, '') : body).replace(/\s+/g, ' ').trim(),
    });
  });
  return tasks;
}

export function toggleTaskLine(markdown, line, done) {
  const lines = markdown.split('\n');
  const m = lines[line]?.match(TASK_RE);
  if (!m) throw new Error(`line ${line} is not a checkbox`);
  lines[line] = `${m[1]}${m[2]} [${done ? 'x' : ' '}] ${m[4]}`;
  return lines.join('\n');
}
