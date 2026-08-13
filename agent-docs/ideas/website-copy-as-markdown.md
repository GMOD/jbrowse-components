---
name: website-copy-as-markdown
description: Per-page Markdown export and `llms.txt` for the docs site: the hybrid weighted toward GitHub raw URLs pinned to the build SHA, and the version-drift trade-off it accepts.
---

# Website: copy-as-markdown / LLM-readiness

`entry.id` from the content collection is the repo-relative path (`config_guide` →
`website/docs/config_guide.md`), so per-page Markdown export needs zero new
infrastructure. "View as Markdown" → an `<a href>` to the GitHub raw URL; "Copy as
Markdown" → `fetch(rawUrl).then(r => r.text()).then(navigator.clipboard.writeText)`
(raw.githubusercontent.com sends `access-control-allow-origin: *`). Trade-offs: **version
drift** (the deployed site is built from a specific commit — pin the URL to the
build-time SHA to stay faithful, or accept `main`'s minor drift); frontmatter noise (LLMs
handle it; non-issue); combined index files (`llms.txt` / `llms-full.txt`) can't come
from GitHub — generate at build from frontmatter + `sidebars.json` and commit them.
Recommendation: hybrid weighted toward GitHub — per-page button → GitHub raw pinned to
build SHA; `llms.txt` curated index → generated at build with links pointing at GitHub
raw URLs; `llms-full.txt` optional generate-and-commit. The only thing hosted is a tiny
index file.
