---
status: Rejected
summary: "Desktop's renderer keeps `nodeIntegration`; the contextIsolation flip was built and dropped, since the RPC workers' `nodeIntegrationInWorker` hands any page script Node through a worker of its own, so the flip closes nothing while costing plugins their page-side Node. MCP agents run programs and write files with their own tools, never through `window.require`."
---

# ADR-253: Desktop keeps Node in the renderer

## Status

Rejected (2026-10-30): the contextIsolation flip is not done.

## Context

Desktop's main window has run with `nodeIntegration: true` and
`contextIsolation: false` since 2021 (79e799fece), by choice: plugins reach Node
from the page (PR #3018, jbrowse-plugin-systeminformation). A July 2026 security
audit proposed removing it and left a migration spec, an unused preload and a
`require` shim behind.

The flip was then built in full: a `setLocalFileOpener` seam in `openLocation`
with page reads over main-process IPC, text indexing moved into the worker,
the preload wired in, `sandbox: false`, webpack's `globalObject` set to
`globalThis`. The app booted and read data under it. Three reviews then found:

- **It closes nothing.** The RPC workers need `nodeIntegrationInWorker`, which
  applies to every dedicated worker the page starts. A page script ran
  `require('child_process')` in a blob worker of its own, and could equally
  install a global plugin that loads into a Node worker. `sandbox: false`, which
  worker Node requires, leaves the renderer outside the OS sandbox as before.
- **It costs features.** Plugins lose Node on the page, which the developer
  guide offers. The MCP docs taught agents `window.require('child_process')` and
  `fs`, and agents used it in 16 of 1334 logged eval runs.

## Decision

- **The renderer keeps Node.** The preload, the shim and the migration spec are
  deleted rather than kept for a flip nobody will make.
- **MCP agents don't use it.** `run_javascript` drives the JBrowse model. An
  agent runs programs, writes files and fetches from hosts that refuse a
  browser with its own tools, under its own client's permissions; JBrowse is
  not a way around them. `agents_live_model.md` says so, and the recipes return
  data for the agent to write.
- **The plugin trust prompt is the control** for untrusted plugins (ADR-038),
  not a stopgap.

## Revisit if

The RPC workers can lose Node: file reads served by the main process over a
MessagePort, or the worker moved into a `utilityProcess`, and text indexing
with it. Only then does a flip contain anything, and it still needs a home for
plugin code that wants Node.
