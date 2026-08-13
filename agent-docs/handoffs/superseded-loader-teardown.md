---
name: handoff-superseded-loader-teardown
description: Live state of the plugin-reload teardown thread — three PRs merged, one open, one branch unlanded. The durable knowledge is filed elsewhere and linked from here.
---

# Handoff: the superseded-loader teardown

**Started** as a review of #5616, Garrett's report that reloading with
`reloadPluginManagerCallback` crashed the page. It was one instance of a class:
destroying an MST tree React is still rendering. Two code paths had it, and the
suite could not see either.

Everything durable is filed. This file holds only what is still live.

## Where the knowledge went

- **The decision, and the three alternatives measured and rejected** →
  [ADR-069](../architecture-decision-records/adr-069-detach-do-not-destroy-what-react-may-hold.md)
- **The rule, where it gets read before the mistake** → `CLAUDE.md`, MST section
- **What is still open, with the numbers** → [TODO.md](../TODO.md), two entries:
  the observer reactions that leak from discarded renders, and the untested
  worker-pool termination
- **What was done and when** → `git log`

## Landed

| | |
| --- | --- |
| #5617 | a plugin install left every relative config uri 404ing |
| #5618 | the loader + rootModel teardown, and the tests that can finally see it |
| #5620 | `rpcManager.destroy()` on teardown — the pool outlived every install |

**#5616 should be closed** in favour of #5618. Its diagnosis was right — the
commit message already names `hubURL` and the uninitialized array node — and
#5618 fixes strictly more.

## Live

**#5621**, `setSession` detaches instead of destroying. Open, and deliberately
framed as a **console-noise fix rather than a crash fix**: measured, every read
on that path is of a scalar or a reference, which warns and cannot throw. An
earlier draft of that PR claimed otherwise by carrying the severity over from
#5618 without measuring it. Merge it or close it on that basis.

**`plugin-reload-browser-tests`**, this branch. Carries
`browser-tests/suites/plugin-reload.ts`, which drives a real plugin reload in a
real browser and asserts no dead-node reads, no page errors and no 404s. It
needed #5617 to pass — written to assert only that the shell came back, it
passed while every track 404ed — and that is now merged, so this can go up as a
PR whenever someone wants it. Run it with
`node products/jbrowse-web/browser-tests/runner.ts --filter pluginreload` after
a build.

## Two things to know before touching this area

- **`tests/loaderUtil.tsx` no longer mocks `disposeLoader`.** It did, for all
  ten suites that mount JBrowse, which is why nothing could see the bug or the
  fix. Don't reintroduce it; `rootModelTeardown.test.tsx` holds that closed.
- **`Miscellaneous Tracks > NCBI alias adapter` drifts 1.08% against a 1%
  threshold**, identically on a clean `main` build. Environment, not yours.
