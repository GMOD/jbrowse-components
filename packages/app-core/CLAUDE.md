# @jbrowse/app-core

The workspace layout is its own subsystem with its own rules —
[`src/WorkspaceLayout/CLAUDE.md`](src/WorkspaceLayout/CLAUDE.md).

## `@jbrowse/react-app2/styles.css` is intentionally empty

Keep it exported even while empty. It used to be an `@import` of dockview's
stylesheet, and owning the entry point is what let that dependency be dropped
without breaking a single embedder's import (ADR-057's one prediction that paid
off as written). Deleting it is a breaking change for every consumer.

## Products key `<App>` on `session.id`

jbrowse-web, -desktop and -react-app all do, so a session swap remounts the
container and `session` is effectively constant for a mounted one. Undo
(`applySnapshot` on the same node) keeps the id and does not remount.
