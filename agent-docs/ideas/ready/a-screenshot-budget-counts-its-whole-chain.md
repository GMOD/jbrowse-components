---
name: a-screenshot-budget-counts-its-whole-chain
description: Desktop's MCP `LONGEST_CALL_MS` counts a screenshot as one relay, though it chains settles, paints and a 20 s wait for a listening page, so the client's stdio timeout can fire first with a vague error and no cancel.
---

# A screenshot's budget counts its whole chain

`LONGEST_CALL_MS` (`products/jbrowse-desktop/electron/mcp/budgets.ts`) counts a
screenshot as one relay. A screenshot chains a settle, a paint and, for a full
page, a second settle, paint and measure, and the 20 s wait for a listening
page (`READY_WAIT_MS` in `bridge.ts`) runs before any relay's timer. The stdio
timeout can fire first, which gives a vaguer error and no cancel, not a hang.

The fix: the screenshot's term in `LONGEST_CALL_MS` sums its chain and the
ready wait, as `open`'s term sums its two phases, so `BRIDGE_TIMEOUT_MS`,
derived from it, outlasts the whole screenshot. `budgets.test.ts` walks the
nesting.
