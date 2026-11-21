---
status: Accepted
summary: "A hub is a saved pointer plus a refetched track list; the session saves only the hub tracks a user opened or edited, keeps that copy over the hub's current entry, and names a hub track by trackId alone, which can collide"
---

# ADR-280: A hub is a pointer plus the tracks a user touched

## Status

Accepted (2026-11-20). Records the behaviour the connection code had settled
on by `f3bf11e7e9`, so a redesign starts from stated answers rather than from
the code. Builds on
[ADR-158](adr-158-a-session-tracks-entry-is-the-base-its-edits-diff-against.md),
whose base-and-delta model a hub track's edits use.

## Context

A track has two homes JBrowse was built around: `config.json`, which every
visitor loads, and the session, which a share link saves. A connection (a UCSC
`hub.txt`, another JBrowse 2 `config.json`, a JBrowse 1 data directory) fits
neither. Its track list belongs to someone else, can hold thousands of tracks
and can change upstream at any time, yet the few tracks a user opens or edits
from it should survive a reload.

The code answers three questions about such a track without stating them
anywhere, and four places resolve a trackId on their own. This ADR states the
answers.

## Decision

**What is saved: the pointer and the touched tracks, never the list.**

- The connection's config is the pointer. It is saved in `jbrowse.connections`
  for an admin on web and for Desktop and the embedded products, whose config
  and session are one document, and in the session's `sessionConnections` for
  a non-admin on web (`SessionConnections.ts`).
- The fetched list, `connectionInstances[].tracks`, is a frozen array of plain
  configs and is stripped from every snapshot (`finalizeSession.ts`). It is
  fetched when the connection is added, when its track selector group is
  expanded (`hydrateConnection`), or when a session spec or hub link asks for
  it. A saved session reloads with its hubs dormant.
- A hub track the user opened or edited is saved whole in
  `connectionTrackConfigs`, keyed by trackId and tagged with its
  `connectionId`. The copy exists exactly while the track is open in a view or
  carries an edit (`captureConnectionTrack`, `pruneConnectionTrackConfig`).
  Its edits are a `trackConfigDeltas` delta over that copy, as ADR-158 has for
  a session track.

**Freshness: a touched track keeps its copy.** While the copy exists it wins
over the hub's current entry, so an open or edited track shows the version it
was opened with even after the hub changes, and Reset returns to that version.
Once the track is closed and unedited the copy is dropped, and the next open
takes the hub's current entry. A share link shows the recipient what the
sender opened, whether or not the hub has since changed or gone.

**Identity: trackId alone, in the session's one namespace.** `trackBaseById`
(`Tracks.ts`) resolves an id in this order:

- an assembly's sequence track;
- a `sessionTracks` entry;
- a `config.json` entry;
- a hub's entry: the kept copy over a live list, and among live lists the
  last connection.

`teardownConnection` closes and resets only the ids that resolve to that hub's
own entry, so a config or session track of the same id stays open when a hub
is deleted. `allSessionTracks` follows the same order over the live lists.
Alias lookup
(`trackIdsByAlias`) reads only session and config tracks, so a hub track's
`aliases` resolve nothing.

**A failed or partial load keeps what the user has.** A connect that throws
reports the error and drops the live instance; the kept copies stay, so open
hub tracks keep drawing (`breakConnection`). A hub loads what it can and names
what it left out: a track type no plugin registers, a genome whose trackDb
could not be read, a genome the site lacks and the hub does not supply. A hub
may add genomes as session assemblies once their tracks are read.

## Consequences

- A share link stays small for any hub size: it holds the pointer, the
  touched copies and their deltas.
- An opened hub track does not follow its hub. A hub that moves a file breaks
  that track for the user until they close it and open it again.
- **Two sources can share a trackId, and edits are keyed by trackId alone.**
  Outside hubs cannot be made to use unique ids. Today the resolution order
  hides the collision for display, but a delta does not know its source: edit
  hub track `t1`, then add a config track `t1`, and the config track resolves
  with the hub's edit, admin "save to config" writes it into `config.json`,
  and deleting the hub leaves it. A fix keys a hub track by the pair
  (`connectionId`, `trackId`), as a table keys a row by two columns, in the
  delta and in the base lookup. Rewriting a hub's ids to
  `connectionId/trackId` at load is the same key flattened into one string,
  but it breaks every saved session, spec and hub link that names a hub track
  by the hub's own id.
- **The order above is re-derived in three more places** that can drift from
  `trackBaseById`: the deprecated `getTracksById`, `allSessionTracks` (which
  lists live hub entries without the kept copy or edits), and the track
  selector's `allTracks` (which shows a hub's live entries, so an edited hub
  track shows its old name under the edited badge).
- **The live list sits in the tree undo snapshots.** `connectionInstances` is
  stripped from saved snapshots but is still session state, so an undo resets
  it and every loaded hub's group empties until expanded again; open tracks
  keep drawing from their copies.
- A JBrowse 1 connection reports failure through its own code rather than the
  shared `lazyConnect` handler, which lives in another plugin.

## Rejected alternatives

Both redesigns below were reviewed against the code on 2026-11-20. Neither was
found fatal; each saves less than it first appeared to and costs compatibility
work, so neither is worth it while hubs are rarely used.

- **Copy an opened hub track into `sessionTracks`, tagged with its
  `connectionId`** (the parked step in
  `handoffs/connection-tracks-frozen.md`). It deletes `connectionTrackConfigs`
  and its actions, but a prune on close must stay (or a reopened track keeps a
  stale copy and sessions grow), the hub tier of the lookup must stay (an
  unopened hub track resolves only there), `connectionId` needs a real slot
  (a session track drops keys it does not declare), and the legacy
  `afterAttach` pass in `SessionTracks.ts` would fold a tagged entry into a
  config track of the same id or alias, worsening the collision above. A
  non-admin could also delete a hub track that the hub row still lists.
- **Hold the fetched lists in a volatile map outside the tree**, with each
  connection type a plain fetch function. It fixes the undo reset, but v4.3.0
  sessions saved hub tracks inside `connectionInstances` and need a migration;
  the TrackHubRegistry plugin builds its model on `BaseConnectionModelFactory`
  inside `addConnectionType`, whose callback `PluginManager` runs unguarded, so
  removing that export stops boot with the plugin installed; an undo can
  remove a hub's assembly while the map still says loaded; each fetch needs a
  token, since a reopened hub link reuses its `connectionId`; and `silent`
  stays an option, since the Hubs plugin passes it.
- **Unique trackIds across every source.** Not enforceable on hubs someone
  else publishes.
- **Load a JBrowse 2 hub through a config `include`.** The Hubs plugin adds a
  hub on demand for a genome the site lacks, which a startup include cannot
  do.
- **Retire the JBrowse 1 connection for a one-time import.** Nothing in the
  repo imports a JBrowse 1 directory any other way; it would need a CLI
  command first.
