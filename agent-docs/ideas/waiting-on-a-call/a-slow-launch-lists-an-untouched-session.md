---
name: a-slow-launch-lists-an-untouched-session
description: Web autosave counts any snapshot change after the first 400ms tick as an edit, so a late-landing launch (a loc= link on a remote genome, a hub) lists an untouched session in Recent sessions; a views-settled gate was backed out.
---

# A slow launch lists an untouched session

## The mechanism

`saveSessionSnapshot` (`products/jbrowse-web/src/rootModel/persistence.ts`)
writes a session node's first snapshot as unedited and every later one as
edited. The autosave autorun's first run is itself throttled, 400ms after boot.
Anything the app writes into the snapshot after that tick counts as the user's
edit:

- a LinearGenomeView launch (`loc=`, a session spec) whose assembly takes longer
  than 400ms, which clears `launch` and sets `displayedRegions`
- `loadHubSpec` and `loadSessionSpec` with connections, which set an empty
  session first and add views (and, for hubs, rename it) after fetches

The untouched session then shows in Recent sessions. The browser test
`session-tabs.ts` ("an untouched session stays out of Recent sessions") passes
because volvox loads inside the window.

## What was tried

Counting a change as an edit only from a snapshot taken with every view settled
(`openViews(session).some(viewLoading)` from `AppReadyMarker.tsx`). It hid real
work, which is worse than the clutter:

- LGV's `initialized` is false until the view has a measured width, and only
  the shown workspace tab is mounted. A view in a tab never opened this boot
  stays "loading" for the life of the page, so no edit anywhere counts and the
  session is pruned a day later.
- A pending launch on such a view also never applies, so narrowing the gate to
  `pendingLaunch` has the same hole.
- A session with no views yet reads as settled, so the hub and spec cases are
  not covered either.

## What a fix owes

The two errors are not symmetric. A false "edited" is a row of clutter; a false
"unedited" deletes someone's work after a day. A fix should only ever err
towards edited. Candidates:

- the loader marks the session as arriving until `loadSessionSpec` /
  `loadHubSpec` resolve, and each view reports "my launch is applying" only
  once it is measured and applying
- a write is not an edit when the only views whose snapshot changed are ones
  whose `launch` was cleared in it
