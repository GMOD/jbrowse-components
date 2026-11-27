---
name: a-failed-set-session-closes-views-before-it-fails
description: `jb.setSession` takes out the views the new document lacks before it applies the snapshot, so a lifecycle hook that throws or two nodes claiming one id fail the apply after the views are already closed; the typecheck catches type errors only.
---

# A failed `jb.setSession` closes views before it fails

`jbApi.ts` calls `takeOutViewsMissingFrom(next)` and then `applySnapshot(session,
next)`. The typecheck before them catches type errors only, so a failure inside
the apply (a lifecycle hook throwing, two nodes claiming one id) leaves the
session with its views closed and the new document not applied.

Fix: apply the snapshot first and let the views the new document lacks leave
through the session's own detach once the apply has succeeded, or restore the
closed views when it throws. ADR-069 sets the detach order.

Found by the same audit as
[jb-setsession-blames-the-document-for-a-bad-live-value](jb-setsession-blames-the-document-for-a-bad-live-value.md).
