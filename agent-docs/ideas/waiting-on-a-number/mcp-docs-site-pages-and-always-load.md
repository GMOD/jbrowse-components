---
name: mcp-docs-site-pages-and-always-load
description: "Two MCP-surface changes sit unlanded on branch `worktree-mcp-eval-baseline`: the docs tool serving tutorial and guide pages, and `alwaysLoad` on the four tools (about 2 KB in every Claude Code session). Each waits on an agent eval against the kept baseline."
---

# MCP docs site pages and alwaysLoad

Briefing changes are A/B tested against a kept eval baseline
([reference/AGENT_EVALS.md](../../reference/AGENT_EVALS.md)). Two commits wait on
branch `worktree-mcp-eval-baseline` (tip bfc77fbb8c; its worktree is gone):

- **a09c6a197f**: the docs tool serves `tutorial:<slug>` and `guide:<slug>`
  (site pages through an esbuild virtual module), and search ranks agent, then
  type, then site.
- **bfc77fbb8c**: `_meta["anthropic/alwaysLoad"]` on all four tools. It costs
  about 2 KB of context in every Claude Code session of a user-scope install,
  which is why it waits for the eval.

**The number:** pass rate, turns and dollars on sonnet and opus, each commit
against the baseline. The variant-server matrix that used to run it
(`~/agent-evals/servers/`, `run-matrix.sh`) is gone and has to be rebuilt; a
full matrix is about 400 `claude -p` sessions, so size it against the weekly
limit. Run it with a visible window until
[a-desktop-view-under-xvfb-never-measures](a-desktop-view-under-xvfb-never-measures.md)
is fixed.
