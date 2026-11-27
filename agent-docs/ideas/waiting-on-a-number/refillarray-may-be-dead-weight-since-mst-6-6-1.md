---
name: refillarray-may-be-dead-weight-since-mst-6-6-1
description: "`refillArray` works around a quadratic array reconcile that `@jbrowse/mobx-state-tree` 6.6.1 made linear; time a 5,000-name reorder through plain assignment and drop the refill if it holds."
---

# refillArray may be dead weight since MST 6.6.1

`refillArray` in
[`configurationSchema.ts`](../../../packages/core/src/configuration/configurationSchema.ts)
refills an observable array slot in place rather than assigning it, because
assigning made MST reconcile entry by entry: its comment puts a 5,000-name
reorder at seconds, against 50 ms for the refill.

`@jbrowse/mobx-state-tree` 6.6.1 reconciles children in linear time (its
CHANGELOG, `530e27f`), and the tree is on ^6.10.1 (`pnpm-workspace.yaml`).

## The number

Time a 5,000-name row reorder through plain assignment. If it lands
near the refill's 50 ms, drop `refillArray` and assign.
