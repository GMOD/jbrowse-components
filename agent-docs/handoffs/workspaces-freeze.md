---
name: workspaces-freeze
description: Many-view sessions freeze under the tiled window manager but not Classic; width-thrash and view-stack windowing are both disproven, the remaining suspect is per-view MST write amplification through the layout echo
---

# Workspaces freeze with many views

A reporter's many-view session (strains) locks up when `useWorkspaces` is on —
the dockview/Tiled path. Classic is fine with the same session. "Can't scroll"
is the symptom people report; it is the freeze, not a scroll bug
(`JBrowseViewPanel` already has `overflowY: auto`).

**Keep dockview.** Fixing the slowness is the goal; removing workspaces or
changing the global-flag persistence is not. See
[ADR-057](../architecture-decision-records/adr-057-dockview-stays-external.md).

## Established, do not re-derive

- **No infinite loop.** `TiledViewsContainer`'s autoruns converge; there is no
  layout ping-pong.
- **Width-set thrash is disproven.** Measured with gated `__WIDTH_DEBUG__`
  instrumentation in `useWidthSetter` plus a `zzstress-workspaces` browser
  suite: Classic and Tiled each fire exactly one `setWidth` per view. Both the
  instrumentation and the suite have since been removed from the tree. **That
  run used canvas2d and empty views, so it never reproduced the freeze** — it
  bounds `setWidth` and nothing else.
- **View-stack windowing is disproven as the fix** (2026-08-05). The earlier
  note proposed virtualizing `JBrowseViewPanel`'s view stack, on the grounds
  that all N views cram into one panel with no windowing. They do — but
  `ClassicViewsContainer` renders **the same `ViewStack` component, with the
  same absence of windowing, over `session.views` entire**, and Classic does not
  freeze. Tiled renders the same number of view containers or fewer (split
  across panels). Windowing cannot be what separates the two paths, so building
  it would not close this.

## The remaining suspect: MST write amplification, not rendering

What is genuinely Tiled-only is the session write traffic, and it scales with
view count:

1. `reconcilePanelAssignments` runs on **every** fire of the sync autorun in
   `useDockviewController`, and its homing loop calls `assignViewToPanel` once
   per unhomed view — N MST writes in a pass.
2. Those writes land on `panelViewAssignments`, which that same autorun reads,
   so the pass re-runs. It converges (the second pass finds everything homed),
   but the cost is paid per fire.
3. The session is the **TimeTraveller's target**. Every write is a snapshot
   event on a session whose size grows with the number of views.
4. `dockviewLayout` is `types.frozen`, and MST compares frozen snapshots by
   reference — so `api.toJSON()` **always** reads as a change and every layout
   echo is another snapshot event. `layoutsEqual` suppresses the *write*, but
   `api.toJSON()` itself still serializes the whole grid on each autorun fire,
   twice more under `JSON.stringify`.

Classic does none of this: it never constructs a dockview api, never writes
`dockviewLayout`, and has no reconcile pass.

## Next steps

Reproduce with the **webgl** backend and **real tracks** per view — the prior
attempt's canvas2d + empty views is why it came back clean. Then profile the
session-write path rather than the render path: count `assignViewToPanel` calls
and snapshot/patch events per interaction, and time `api.toJSON()` at the
reporter's view count. Profile the Classic→Tiled toggle remount separately; it
is a distinct spike from the steady-state cost.

If the write amplification is confirmed, the fix is to make reconcile a no-op
when nothing changed (it already computes enough to know) rather than to
virtualize anything.

Related: [ADR-057](../architecture-decision-records/adr-057-dockview-stays-external.md),
[app-core/CLAUDE.md](../../packages/app-core/CLAUDE.md).
