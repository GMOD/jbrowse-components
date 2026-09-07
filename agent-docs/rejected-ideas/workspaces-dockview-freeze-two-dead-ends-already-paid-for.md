---
name: workspaces-dockview-freeze-two-dead-ends-already-paid-for
description: Workspaces/dockview freeze — two dead ends already paid for.
area: performance-and-measurement
---

# Workspaces/dockview freeze — two dead ends already paid for.

Width-set
thrash disproven (that run used canvas2d + empty views and never reproduced
the freeze, so it bounds `setWidth` only). View-stack windowing disproven as
the fix: `ClassicViewsContainer` renders the same unwindowed `ViewStack` over
all of `session.views` and doesn't freeze — don't build virtualization.
Suspect is MST write amplification.
[ADR-057](../architecture-decision-records/adr-057-dockview-stays-external.md).
