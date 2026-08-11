Nobody looking for a gene knows its coordinates. `aggregateTextSearchAdapters`
is a `createViewState` option, and with one the location box from the
[Controlling the view](../controlling-the-view/#drive-it-from-your-app) page
takes `EDEN.1` as readily as `ctgA:1,050..9,000`. There is no second call:
`navToLocString` runs the search itself.

The index is three files from `jbrowse text-index`, read by a
[`TrixTextSearchAdapter`](https://jbrowse.org/jb2/docs/config/trixtextsearchadapter/)
over plain HTTP range requests. Nothing runs server side.

## Five inputs, five paths

`navToLocString` tries them in this order, and the buttons above are one of
each:

- **every token is a refName or a range** (`ctgB`) — it navigates, and the index
  is never opened.
- **one hit** (`EDEN.1`) — it navigates with 20% padding and shows the track the
  hit came from.
- **exactly one, among several prefix matches** (`EDEN`) — it navigates too. An
  exact pass runs first, and a row is exact when any indexed attribute equals
  the query, so `EDEN` prefixes four features and _is_ one of them.
- **several, none exact** (`Apple` prefixes three) — nothing to prefer, so it
  asks.
- **none, and the input was a plain word** (`zyzzyva`) — it throws
  `SearchResultsNotFoundError`, a distinct class so you can render "no results"
  calmly rather than as a failure. Everything else that throws is a real error.

Without that pass, every gene whose name prefixes its own isoforms would open a
picker instead of going where you asked.

## The fourth one has nowhere to go

JBrowse asks by queueing a dialog on the session, and a host that draws its own
chrome renders no dialogs — so the promise resolves, nothing throws, and nothing
moves. It is the same side door as the
[snackbar channel](../loading-and-errors/), and it has the same two answers:
render the queue, or never queue one. The section below does the second.
