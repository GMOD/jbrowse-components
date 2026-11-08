---
name: a-desktop-view-under-xvfb-never-measures
description: "Under xvfb a LinearGenomeView that `jb.loadSessionSpec` creates in JBrowse Desktop intermittently never gets a width and stays `initializing`, so `test:mcp:headless` and the headless agent evals fail. Waits on a bisect, and on whether a real window hits it."
---

# A Desktop view under xvfb never measures

`pnpm --filter @jbrowse/desktop test:mcp:headless` (`xvfb-run node
test/mcpConformance.ts`) failed both runs on an idle laptop (2026-11-05, load
2.5): once at "a spec key that reaches nothing", once at the first "spec load
settles", each with `notReady: [{ phase: 'initializing' }]`, then recipe runs
failing with `assemblyName:undefined`. Hidden-window sessions in the headless
MCP evals went from 5 of 129 (231c700ddf, 2026-10-05) to 77 of 180
(dbbe63850d, 2026-10-28), so evals under xvfb are unreliable until this is
fixed.

**The fix is in why the window stops measuring**, not in initializing without
a width: a view that is not on screen gets no assumed width (the `initialized`
getter in `plugins/linear-genome-view/src/LinearGenomeView/model.ts`).

**Waits on two numbers:**

- whether a real (non-xvfb) window hits it;
- which commit made it common. The range 231c700ddf..dbbe63850d is about 2,500
  commits, 376 of them in Desktop, the LGV model and `jbApi`. ada cannot bisect
  it yet: it has no Xvfb (needs sudo), no Electron binary and no Desktop build.
