---
name: connection-tracks-frozen
description: "A connection's fetched tracks are the last track list held as MST config nodes. Waiting on: storing them as `types.frozen` bases, saving an opened hub track as a session track, and the undo, trackId-clash and stalled-hub bugs in the same code."
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

- **A hub's fetched tracks** are
  `types.array(pluginManager.pluggableConfigSchemaType('track'))` on the
  connection instance
  (`packages/core/src/pluggableElementTypes/models/BaseConnectionModelFactory.ts`).
  The comment in `addTrackConfs` there has the measured time per track. A
  session rebuilds every node on each load, because `finalizeSession.ts` strips
  `connectionInstances` from the snapshot.
- **The config's tracks** are `types.frozen`
  (`packages/product-core/src/RootModel/createConfigModel.ts`). A config node
  is built when a track's `configuration` is first read, and edits are stored as
  deltas ([ADR-031](../architecture-decision-records/adr-031-track-config-hydration-cache-on-pluginmanager.md),
  [ADR-032](../architecture-decision-records/adr-032-track-config-nodes-are-throwaway-views.md),
  [ADR-158](../architecture-decision-records/adr-158-a-session-tracks-entry-is-the-base-its-edits-diff-against.md)).
- **An opened hub track** is a full frozen copy in `connectionTrackConfigs`
  (`packages/product-core/src/Session/Connections.ts`).
  `captureConnectionTrack` writes the copy after `showTrackGeneric` has shown
  the track, and from then on the copy wins over the live node in
  `connectionConfigsById` (`packages/product-core/src/Session/Tracks.ts`). So a
  shown hub track already resolves from frozen data after its first show.

## Next

Each step can land by itself, in this order.

- **Store the hub's list as frozen data.** `tracks` becomes a frozen array of
  plain configs, and `addTrackConfs` becomes one assignment.
  - The union's preprocessor expands the loose `{ trackId, uri }` form today.
    A frozen list needs the pass `expandLooseTracks` gives `jbrowse.tracks`
    (`packages/app-core/src/JBrowseModel/index.ts`).
  - The chunked push and the `hasNoPlugin` check in `addTrackConfs` exist only
    because the list is built as nodes. Before deleting the check, read what a
    `config.json` track of an unregistered type does in the track selector and
    on open (`products/jbrowse-react-linear-genome-view/src/unloadableTrack.test.ts`),
    and give hub tracks that behavior.
  - `connectionConfigsById` already returns plain objects for captured tracks,
    so `getTrackById` needs no change for this step.
- **Make hub tracks bases.** Add a live hub's tracks to `trackBasesById`
  (`Tracks.ts` and `SessionTracks.ts`), so a hub track resolves through the
  base, `withTrackEdits` and a working copy as a config track does. The
  `connection ??` arm of `exactTrackById` and `connectionConfigsById` then go.
  The order of sources in that index settles the trackId clash below, and the
  order to pick is session entry, then config, then hub.
- **Save an opened hub track as a session track with its `connectionId`.**
  A `sessionTracks` entry is already a base (ADR-158), so the hub track's edits
  become deltas and get the edited badge and Reset. This step deletes
  `connectionTrackConfigs` and the four actions that maintain it, the branch in
  `updateTrackConfiguration`, and the two calls in
  `packages/core/src/util/tracks.ts`. The step needs three things:
  - the track selector lists such an entry under its hub's row
    (`allTracks` in `plugins/data-management/src/HierarchicalTrackSelectorWidget/model.ts`);
  - `teardownConnection` closes tracks by their `connectionId`, where it closes
    by trackId today;
  - a snapshot migration for saved sessions that hold `connectionTrackConfigs`.
- **Decide where the live list is stored.** A frozen property on the instance
  still sits in the tree that undo resets (see the undo bug below). A volatile
  map on the session, keyed by `connectionId`, would stay out of snapshots and
  out of undo. Nobody has tried moving the instances out of the session tree,
  so this is unverified.

## Readers to update

- **Code that takes a hub track as a node:** `captureConnectionTrack` and
  `teardownConnection` (`Connections.ts`), the selector's
  `resolve(filterTracks(live.tracks, self))`, and `allSessionTracks`,
  `trackCatalog` and `annotationTrackIds` in `packages/core/src/util/tracks.ts`,
  whose parameters are typed `TrackConfigNode[]`.
- **Callers of `allSessionTracks`, `trackCatalog` and `annotationTrackIds`:**
  `git grep -n -E "allSessionTracks|trackCatalog\(|annotationTrackIds\(" -- packages plugins products`.
  `packages/core/src/TextSearch/TextSearchManager.ts` is among them, and whether
  it reads `textSearching` through a node or a plain object is unchecked.
- **Types:** `ConnectionInstance` in `packages/core/src/util/types/index.ts`.

## Reasons that could stop the move to frozen

- **The plugin-facing surface changes.** A connection type's `tracks` elements
  become plain objects, and `addTrackConf` returns a node today. A reviewer's
  grep on 2026-11-20 found no connection type and no call to `addTrackConfs`,
  `setTrackConfs` or `addTrackConf` in jb2plugins, the `jbrowse-plugin-*`
  repos, JBrowseR, jbrowse-jupyter, ggjbrowse, jbrowse-demos, Apollo3 or
  jb2hubs; rerun it before relying on it. Record the change in
  `agent-docs/reference/PLUGIN_ABI_STABILITY.md` and
  `website/docs/developer_guides/creating_connection.md`.
- **An invalid hub track is found on open**, as an invalid config track is. A
  node list finds it at load.
- **`jbrowse-plugin-hubs` sets `assemblyNames` on a JBrowse 2 hub.** The first
  attempt at that filter broke the genomes whose hosted config lists the
  asked-for name as an alias. The alias case in
  `products/jbrowse-web/src/hubConnection.test.ts` pins it; keep that test
  green through this work.

## Open bugs in the connection code

- **Undo unloads every loaded hub.** `applySnapshot` resets
  `connectionInstances` to its default, because the snapshot has none. Repro in
  the `hubConnection.test.ts` harness: load a hub, `session.setName('x')`,
  `history.flushPendingRecord()`, `history.undo()`, and the instance's tracks
  are gone. A fix must also handle undoing "add connection", where the
  instance's config leaves with the snapshot.
- **A hub track replaces a config track with the same trackId**, in views
  already open (`exactTrackById`), and deleting the hub then closes it. The
  second step above fixes this by the order of sources.
- **A hub that never answers stalls a link or session-spec load.**
  `whenConnectionsSettle` (`packages/app-core/src/SessionSpec/loadSessionSpec.ts`)
  and `settleAssemblyResolution`
  (`packages/core/src/assemblyManager/assemblyManager.ts`) wait on `loading`
  with no bound and show no message.
- **A hub track whose adapter type has no plugin probably fails the whole
  hub.** This is read from the code and unchecked. The `hasNoPlugin` check
  covers the track type alone, because adapter types may have retired spellings
  that a name lookup would refuse. A frozen list builds no node at load, so the
  failure would move to the one track when it is opened.
- **`JBrowse1Connection` reports failure through its own code**
  (`plugins/legacy-jbrowse/src/JBrowse1Connection/model.ts`). A reviewer's
  probe found that a data directory it cannot fetch loads as zero tracks with
  no message.

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
