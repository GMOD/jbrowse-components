---
name: having-the-rpc-worker-skip-a-plugin-that-fails-to
description: Having the RPC worker skip a plugin that fails to load, the way the apps do with `loadSettled`
area: config-and-mst
---

# Having the RPC worker skip a plugin that fails to load, the way the apps do with `loadSettled`

declined 2026-09-04 by the maintainer, from the v5
release audit. The worker keeps `PluginLoader.load`, all-or-nothing, and a
plugin that throws at worker module scope (the baseline shows Apollo 1.1.1
and Ideogram 2.0.0 doing so) gives the session a dead worker, reported through
the boot error `rpcWorker.ts` posts. That is rare enough not to carry a
skip-and-log path: a half-loaded plugin set would fail renders with a worse
message than the boot error, and a plugin broken at module scope is a plugin
to fix or unlist, not to route around.
