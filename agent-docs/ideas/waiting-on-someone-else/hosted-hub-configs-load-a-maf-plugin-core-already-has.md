---
name: hosted-hub-configs-load-a-maf-plugin-core-already-has
description: The genomes.jbrowse.org hub configs list the external MafViewer plugin, which v5's web build carries in core; once hosted launches run v5 the entry becomes a bundle fetch on every launch's critical path that can error-page the session, so drop it when v5 ships.
---

# Hosted hub configs load a MAF plugin core already has

The genomes.jbrowse.org hub configs (built in jb2hubs) name a MafViewer
plugin in `plugins[]`. `@jbrowse/plugin-maf` is in core since v5
([corePlugins.ts](../../../products/jbrowse-web/src/corePlugins.ts)); v4.3.0,
which production launches point at, lacks it, so the entry is required today.

Once hosted launches run v5:

- The entry is a plugin bundle fetch on the critical path of every hosted
  launch, for something core already has, and `plugins[].url` is the one field
  that can error-page a whole session.
- The names differ (`MafPlugin` in
  [plugins/maf](../../../plugins/maf/src/index.ts) against `MafViewerPlugin`), so
  PluginManager's name-match guard does not dedupe them; the registry's
  first-wins guard means the core copy wins anyway.

## What it waits on

The v5 release reaching the hosted builds. Then drop the `plugins[]` entry from
the hub configs, after re-checking it against the hosted builds.
