---
status: Accepted
summary: "The workspace is the only views container and the \"Use workspaces\" switch is gone. One cell with one tab draws exactly the classic stack, with no tab strip; the strip appears once the layout has a second tab or cell. The session property, the user preference, the admin config slot, the share-link stamp and the classic container went with it. A session saved with workspaces off opens as the stack it showed; `setUseWorkspaces` stays as a no-op for published plugins"
---

# ADR-213: the workspace is always on

## Status

Accepted (2026-10-05). Builds on
[ADR-068](adr-068-workspace-layout-is-an-mst-tree.md).

## Context

After ADR-068 the classic stack and the workspace drew the same `ViewStack`;
the classic stack was a one-cell, one-tab workspace without its strip. A
boolean chose between them, resolved from the session, then the user's
preference, then `configuration.preferences.useWorkspaces`. Most of the code
around it existed for that cascade: a share-link stamp so a recipient saw the
sender's arrangement, a Preferences reset row for a value the override map could
not see, and "is it on?" forks in the View menu, `layoutViews` and the agent
docs. The layout also went stale while the stack showed, because homing only
ran inside the workspace.

## Decision

Always render the workspace. The tab strip shows when the whole layout (not
the maximized view of it) has a second tab or a second cell, so a lone cell
with one tab draws the classic stack pixel for pixel. Views stack in block
layout in both, keeping classic's collapsed 4px gap.

Removed: `useWorkspaces`, `effectiveUseWorkspaces`, `defaultUseWorkspaces`,
`setUseWorkspacesPreference`, `resetUseWorkspaces`, the config slot, both
checkboxes, `bakeSessionCascades` and `ClassicViewsContainer`.

Measured against today's build on volvox with two views: the stack, a split
and a second tab each differ by under 2% of pixels, all of it app bar
anti-aliasing and its drop shadow.

## Consequences

- A session snapshot with `useWorkspaces: false` drops its layout on load, so a
  saved arrangement nobody could see stays unseen.
- A stored preference override the config no longer declares is dropped on
  load, rather than showing as a ghost row in "Reset to defaults".
- `setUseWorkspaces` is a no-op kept for protein3d and msaview's published
  bundles, which call it after placing a view.
- With one tab there is no strip to drag or rename. The View menu's moves are
  the way into tabs and splits, and every strip control returns with the
  second tab or cell.
