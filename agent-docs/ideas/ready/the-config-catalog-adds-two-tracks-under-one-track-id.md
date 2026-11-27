---
name: the-config-catalog-adds-two-tracks-under-one-track-id
description: `JBrowseModel.addTrackConf` splices into the config catalog with no `trackId` check, so a repeat or a race leaves two entries with one id, where the session's own `addTrackConf` dedupes.
---

# The config catalog adds two tracks under one `trackId`

`addTrackConf` in `packages/app-core/src/JBrowseModel/index.ts` expands the loose
config and splices it into `self.tracks` at the index it is given. Nothing
compares `trackId` against the existing entries, so a repeated call or two
racing calls leave two catalog entries with one id. The session's
`addTrackConf` dedupes; the catalog action it calls through does not.

Fix: replace, or refuse, when an entry with that `trackId` is already there, and
say which in a test.

Doc says, unchecked: a non-admin `deleteTrackConf` dereferences every open view
and removes nothing (TRACK_REGISTRATION).
