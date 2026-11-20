---
name: setsession-drops-a-tracks-entry-without-closing-it
description: jb.setSession closes a view dropped from views[] but leaves a track dropped from a view's tracks[] open, while the agent guide says any dropped entry is closed.
---

# `jb.setSession` drops a track entry without closing the track

## Ruling

A track entry dropped from a view's `tracks[]` closes the track. The agent
guide already promises it, and it makes the document route complete.

Driven on the `jbrowse-web` build, 2026-09-30: take
`jb.mst.getSnapshot(jb.session)`, remove the `volvox_test_vcf` entry from
`views[0].tracks` (or set `tracks = []`), pass it to `jb.setSession`. The
session keeps every track open and raises nothing; the view keeps its id, the
session name edit applies.

`website/docs/agents_live_model.md` says of `jb.setSession` that "an entry
keeping its `id` is patched, one dropped is closed". That holds for `views[]`
(`takeOutViewsMissingFrom`). Nothing carries it to a view's `tracks[]`, and
`JB_HELP` names only that a `{ trackId }` entry there opens a track.

An agent that reads "rewrites the session as a document" will try the edit
first and get silence. `view.hideTrack` is the route that works, and the
`edit-session-document` eval task (`scripts/agent-evals/tasks.ts`) needs it.

The cost is a patch rule in the view launcher. Measure with
`--filter edit-session-document --runs 5` before and after.
