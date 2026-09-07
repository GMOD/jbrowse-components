---
name: move-the-pure-logic-suites-off-jsdom-onto-the-node
description: Move the pure-logic suites off jsdom onto the `node` test environment
area: tooling-tests-and-docs
---

# Move the pure-logic suites off jsdom onto the `node` test environment

—
measured and declined 2026-08-30, and the two figures behind it are worth
keeping because the idea looks like the obvious next lever after the test-file
pass in [TEST_INFRASTRUCTURE.md](../reference/TEST_INFRASTRUCTURE.md). It rests on jsdom
being a per-suite tax, and it is not one. Ten empty suites each way in one run:
**jsdom 43ms median, `node` 53ms** — the node environment is the slower of the
two here, because the ten `setupFiles` run either way and jsdom is already warm
in a reused worker. And the tax it would be reclaiming is small to begin with:
the 1310 suites with under 50ms of test bodies cost **184s of the run's 1120s
between them**, median 92ms each. The 449s a run spends outside test bodies is
not a per-suite floor: a suite importing nothing is 31ms and the same suite
importing the jbrowse-web app graph is 362ms, so what fills that window is the
import graph re-executing per test file. TEST_INFRASTRUCTURE.md, "What the
449s outside test bodies is", has the breakdown. A 1500-file environment sweep
buys nothing and breaks every suite that touches `document`, `localStorage` or
the fetch mock.
