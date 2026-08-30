async function request(url, options) {
  const res = await fetch(url, {
    headers: options?.body ? { 'content-type': 'application/json' } : undefined,
    ...options,
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail.error ?? `${res.status} ${res.statusText}`);
  }
  return res.json();
}

export const api = {
  repos: (refresh) => request(`/api/repos${refresh ? '?refresh=1' : ''}`),
  branches: (repoId) => request(`/api/repos/${encodeURIComponent(repoId)}/branches`),
  note: (repoId, branch) =>
    request(`/api/repos/${encodeURIComponent(repoId)}/note?branch=${encodeURIComponent(branch)}`),
  saveNote: (repoId, branch, markdown) =>
    request(`/api/repos/${encodeURIComponent(repoId)}/note`, {
      method: 'PUT',
      body: JSON.stringify({ branch, markdown }),
    }),
  tasks: () => request('/api/tasks'),
  toggleTask: (repoId, branch, line, done) =>
    request('/api/tasks/toggle', {
      method: 'POST',
      body: JSON.stringify({ repoId, branch, line, done }),
    }),
};
