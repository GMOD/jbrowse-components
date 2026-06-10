

  The mapping is already there. entry.id from the content collection is the repo-relative path
  (config_guide → website/docs/config_guide.md). So per page you can build a GitHub URL with zero new
  infrastructure:

  - "View as Markdown" → just an <a href> to the raw URL:
  https://raw.githubusercontent.com/GMOD/jbrowse-components/<ref>/website/docs/<id>.md. No JS, no
  endpoint, no build step.
  - "Copy as Markdown" → client-side fetch(rawUrl).then(r => r.text()).then(t =>
  navigator.clipboard.writeText(t)). raw.githubusercontent.com sends access-control-allow-origin: *,
  so the cross-origin fetch works without a proxy. (Worth a quick curl to confirm before committing to
  it.)
  - Or link to the blob URL (github.com/.../blob/<ref>/...) and let GitHub's own "Copy raw file"
  button do the work — least code of all, though it sends users off-site.

  The three real trade-offs:

  - Version drift (the important one). What <ref> do you use? main is "live" but the deployed site is
  built from some specific commit, so a main link can show content that differs from the page the
  reader is on. To be faithful, inject the build commit SHA at build time and pin the URL to it. If
  you're fine with minor drift, main is simpler.
  - Frontmatter noise. The raw repo file includes the YAML frontmatter and any :::note admonition /
  figure syntax that your remark plugins transform. LLMs handle all of that fine, but you can't strip
  it the way a self-hosted .md endpoint could. I'd consider that a non-issue.
  - The combined/index files can't come from GitHub. llms.txt and llms-full.txt are concatenations
  GitHub won't produce. But you can generate them and commit them into website/docs (or static/), at
  which point they're normal repo files served both by your site and by GitHub raw.

  My recommendation: hybrid, weighted toward GitHub.
  - Per-page "View / Copy as Markdown" → GitHub raw, pinned to the build SHA. No rehosting.
  - llms.txt (the curated index) → generate at build from frontmatter + sidebars.json, but have its
  links point at GitHub raw URLs. Small, high-value.
  - llms-full.txt → optional, generate-and-commit if you want it.

  That gets you the LLM-ready story while the only thing you actually build/host is a tiny index file.
  Want me to start with the header button (GitHub-raw, SHA-pinned) + a generated llms.txt?

