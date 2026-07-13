export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function csrfField(token: string): string {
  return `<input type="hidden" name="_csrf" value="${escapeHtml(token)}">`;
}

export function layout(title: string, bodyHtml: string, options: { showNav?: boolean } = {}): string {
  const nav =
    options.showNav === false
      ? ""
      : `
    <nav>
      <a href="/projects">Projects</a>
      <a href="/assignees">Assignees</a>
      <a href="/account">Account</a>
      <form method="post" action="/logout" style="display:inline"><button type="submit">Logout</button></form>
    </nav>
  `;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 720px; margin: 2rem auto; padding: 0 1rem; color: #1a1a1a; }
    nav { margin-bottom: 1.5rem; display: flex; gap: 1rem; align-items: center; }
    nav a { text-decoration: none; color: #2952e3; }
    table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
    th, td { border: 1px solid #ddd; padding: 0.5rem; text-align: left; }
    label { display: block; margin: 0.75rem 0 0.25rem; font-weight: 600; }
    input[type=text], input[type=password], input[type=url] { width: 100%; padding: 0.4rem; box-sizing: border-box; }
    .error { color: #b00020; margin: 0.5rem 0; }
    .actions { margin-top: 1rem; display: flex; gap: 0.5rem; }
    button, .button { padding: 0.4rem 0.9rem; cursor: pointer; }
  </style>
</head>
<body>
  ${nav}
  <h1>${escapeHtml(title)}</h1>
  ${bodyHtml}
</body>
</html>`;
}
