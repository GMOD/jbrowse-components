Nobody looking for a gene knows its coordinates. `aggregateTextSearchAdapters`
is a `createViewState` option, and with one the location box from the
[Controlling the view](../controlling-the-view/#drive-it-from-your-app) page
takes `BRCA1` as readily as `chr17:43,044,295..43,125,364`. There is no second
call: `navToLocString` runs the search itself.

The index is three files from `jbrowse text-index`, read by a
[`TrixTextSearchAdapter`](https://jbrowse.org/jb2/docs/config/trixtextsearchadapter/)
over plain HTTP range requests. Nothing runs server side.

## Five inputs, five paths

`navToLocString` tries them in this order, and the buttons above are one of
each:

- **every token is a refName or a range** (`chr13`) — it navigates, and the
  index is never opened.
- **one hit** (`gene15876`) — it navigates with 20% padding and shows the track
  the hit came from.
- **exactly one, among several prefix matches** (`TP53`) — it navigates too. An
  exact pass runs first, and a row is exact when any indexed attribute equals
  the query, so `TP53` prefixes twenty relatives and still matches one exactly.
- **several, none exact** (`BRC` prefixes five) — nothing to prefer, so it asks.
- **none, and the input was a plain word** (`zzzznotagene`) — it throws
  `SearchResultsNotFoundError`, a distinct class so you can render "no results"
  calmly rather than as a failure. Everything else that throws is a real error.

Without that pass, a gene whose name prefixes a relative's would open a picker
instead of going where you asked.

## The fourth one has nowhere to go

JBrowse asks by queueing a dialog on the session, and a host that draws its own
chrome renders no dialogs — so the promise resolves, nothing throws, and nothing
moves. It is the same side door as the
[snackbar channel](../loading-and-errors/), and it has the same two answers:
render the queue, or never queue one. The section below does the second.
