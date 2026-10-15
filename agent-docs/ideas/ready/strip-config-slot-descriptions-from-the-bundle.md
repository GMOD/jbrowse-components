---
name: strip-config-slot-descriptions-from-the-bundle
description: Config-slot `description` strings weigh about 12 KB gz, but the saving needs plot-example and adapter descriptions stripped too, and "Edit plot" and the synchronous jb.describeSlots read them. Low priority; jest never runs the babel pass, so a key mismatch drops helper text silently.
---

# Strip config-slot descriptions from the bundle

About 12 KB gz, measured 2026-10-08. Low priority.

- The saving needs plot-example and adapter descriptions stripped as well, and
  "Edit plot" reads those.
- `jb.describeSlots` is synchronous, and desktop's MCP shares `jbApi`, so
  neither can wait on a lazy load.
- jest never runs the babel pass, so a key mismatch drops helper text silently
  with no red test.
