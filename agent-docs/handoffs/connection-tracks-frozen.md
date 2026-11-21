---
name: connection-tracks-frozen
description: "A connection's fetched tracks are frozen plain configs and bases their edits diff against; ADR-280 records what a hub saves and how its tracks are named. Open: the undo, trackId-keyed delta and stalled-hub bugs, and three UI decisions for Colin."
---

# Connection tracks go frozen

As of 2026-11-20, Colin's direction is that a connection's tracks use
`types.frozen` unless a reason against it turns up. The reasons looked for so
far are under
[Reasons that could stop the move to frozen](#reasons-that-could-stop-the-move-to-frozen),
and none has held.

The bug fixes that came first are in git (`3cf634e045` through `97fb938117`,
six commits whose subjects name a hub or a connection). Three reviews of them
ran; their findings are either fixed in those commits or listed under
[Open bugs in the connection code](#open-bugs-in-the-connection-code).

## Where each track list is stored today

- **A hub's fetched tracks** are a frozen array of plain configs on the
  connection instance
  (`packages/core/src/pluggableElementTypes/models/BaseConnectionModelFactory.ts`),
  expanded from the loose `{ trackId, uri }` form and with types no plugin
  registers left out. A track holding a value its slot refuses loads with the
  hub and fails when opened, as a `config.json` track does
  (`hubConnection.test.ts`); read from the code, an adapter type no plugin
  registers goes the same way. An 8,000-track hub loads in about 15 ms in jest; the
  node list it replaced ran the 4 GB jest heap out of memory on the same
  probe. `finalizeSession.ts` still strips `connectionInstances` from the
  snapshot, so the list is refetched on each load.
- **The config's tracks** are `types.frozen`
  (`packages/product-core/src/RootModel/createConfigModel.ts`). A config node
  is built when a track's `configuration` is first read, and edits are stored as
  deltas ([ADR-031](../architecture-decision-records/adr-031-track-config-hydration-cache-on-pluginmanager.md),
  [ADR-032](../architecture-decision-records/adr-032-track-config-nodes-are-throwaway-views.md),
  [ADR-158](../architecture-decision-records/adr-158-a-session-tracks-entry-is-the-base-its-edits-diff-against.md)).
- **An opened or edited hub track** has a full frozen copy in `connectionTrackConfigs`
  (`packages/product-core/src/Session/Connections.ts`).
  The copy exists exactly while the track is open in a view or edited:
  `captureConnectionTrack` writes it when `showTrackGeneric` shows the track
  or `writeDelta` (`SessionTracks.ts`) stores its first edit, and
  `pruneConnectionTrackConfig` drops it when the last view closes the track
  or its edit is cleared. While it exists, the copy wins over the live entry.
  Delete track's Undo (`DeletedTrack.connectionEntry`) puts the copy back.
- **A hub track is a base.** `trackBaseById` (`Tracks.ts`) resolves an id to its
  session entry, else its config entry, else its hub's entry, the kept copy
  before the live one. A hub track's edits are deltas in `trackConfigDeltas`
  with the edited badge and Reset, as a config track's are. `trackBasesById`
  stays session and config only, because its readers (desktop text indexing,
  `promotableTrackIds`) write back to the base. `teardownConnection` closes
  and resets only the ids that resolve to that hub's own entry, so a config or
  session track of the same id stays open.

## Next

Nothing is queued.
[ADR-280](../architecture-decision-records/adr-280-a-hub-is-a-pointer-plus-the-tracks-a-user-touched.md)
records what a hub saves, which copy wins and how a hub track is named, and
why saving an opened hub track as a session track, and holding the fetched
lists outside the tree, were both declined for now.

## Reasons that could stop the move to frozen

- **`jbrowse-plugin-hubs` sets `assemblyNames` on a JBrowse 2 hub.** The first
  attempt at that filter broke the genomes whose hosted config lists the
  asked-for name as an alias. The alias case in
  `products/jbrowse-web/src/hubConnection.test.ts` pins it; keep that test
  green through this work.

## Open bugs in the connection code

- **Undo unloads every loaded hub**, low priority: Colin is "not super
  worried about undo" (2026-11-20). `applySnapshot` resets
  `connectionInstances` to its default, because the snapshot has none, so the
  hub's row empties until it is expanded again; open hub tracks stay open from
  `connectionTrackConfigs`. Repro in the `hubConnection.test.ts` harness: load
  a hub, `session.setName('x')`, `history.flushPendingRecord()`,
  `history.undo()`. ADR-280's rejected row on a volatile map lists what a fix
  that moves the live list out of the tree must handle.
- **A hub track's edits are keyed by trackId alone**, so they can land on
  another track that later takes the id. Edit hub track `t1`, then add a
  config track `t1`: the config track resolves with the hub's edit, admin
  "save to config" writes it into config.json (`promotableTrackIds`), and
  deleting the hub leaves it. On a reload with the hub dormant, the alias
  migration in `SessionTracks.ts` `afterAttach` can re-key the delta onto a
  config track that lists `t1` in `aliases` (read from the code). A fix keys
  a hub track by (`connectionId`, `trackId`) (ADR-280).
- **The track selector's hub rows list the live entries before any edit**
  (`allTracks` in `HierarchicalTrackSelectorWidget/model.ts`), so an edited
  hub track shows its old name in the tree while it carries the edited badge.
- **A hub that never answers stalls a link or session-spec load.**
  `whenConnectionsSettle` (`packages/app-core/src/SessionSpec/loadSessionSpec.ts`)
  and `settleAssemblyResolution`
  (`packages/core/src/assemblyManager/assemblyManager.ts`) wait on `loading`
  with no bound and show no message.
- **`JBrowse1Connection` reports failure through its own code**
  (`plugins/legacy-jbrowse/src/JBrowse1Connection/model.ts`) rather than
  `lazyConnect`, which lives in data-management. A data directory with
  neither track list now fails with a reason (`db1fc68310`).

## Waiting on Colin

- **The word in the UI.** The menus read "Open connection...", "Add
  connection..." and "Delete connection...". The proposal is "Add track
  hub..." and "Remove hub...", with `connections` staying as the config key.
- **A config `include`** for splitting `config.json` across files, merged at
  startup, with connections kept for hubs loaded on demand. The admin server
  would have to save edits without copying included tracks into `config.json`.
- **The add form** as one URL field that reads the hub before saving, takes the
  type and name from it, and identifies the hub by its URL. The form work
  follows the two decisions above.
