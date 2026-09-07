---
name: vendoring-dockview
description: Vendoring dockview
area: performance-and-measurement
---

# Vendoring dockview

(copying the source in) —
[ADR-057](../architecture-decision-records/adr-057-dockview-stays-external.md).
Moot as of 2026-08-12: dockview was **replaced**, not vendored, and is no
longer a dependency —
[ADR-068](../architecture-decision-records/adr-068-workspace-layout-is-an-mst-tree.md).
Left here for the reason it is instructive rather than the reason it was
filed. ADR-057 declined the rewrite four times on a ~8-9k-line cost estimate
that measured the whole library rather than the subset a workspace needs; the
real figure was ~1,940. **A cost nobody has measured is not evidence, however
many times it gets restated.**
