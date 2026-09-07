---
name: jb-views-jb-view-index-so-an-agent-stops-writing
description: `jb.views()` / `jb.view(index)`, so an agent stops writing `session.views[0]`
area: tooling-tests-and-docs
---

# `jb.views()` / `jb.view(index)`, so an agent stops writing `session.views[0]`

declined 2026-09-06, same review. `jb.sessionSummary()`
already returns every open view with its id, type, name, assemblies and
height; a second list of the same is what the roster rule in `jbApi.test.ts`
refuses ("the raw model is verbose" does not admit a member), and no
transcript lost a turn to the index form.
