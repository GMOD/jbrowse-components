Nobody looking for a gene knows its coordinates. `aggregateTextSearchAdapters`
is a `createViewState` option, and once one is there the location box you
already have — the one on the
[Controlling the view](../controlling-the-view/#drive-it-from-your-app) page —
takes `EDEN.1` as readily as `ctgA:1,050..9,000`. There is no second call:
`navToLocString` runs the search itself.

The index is three files from `jbrowse text-index`, read by a
[`TrixTextSearchAdapter`](https://jbrowse.org/jb2/docs/config/trixtextsearchadapter/)
over plain HTTP range requests. Nothing runs server side.

## Four inputs, four paths

`navToLocString` tries them in this order, and the buttons above are one of
each:

- **every token is a refName or a range** (`ctgB`) — it navigates, and the index
  is never opened.
- **one hit** (`EDEN.1`) — it navigates with 20% padding and shows the track the
  hit came from.
- **several hits** (`EDEN` matches four features) — it cannot choose, so it
  asks.
- **no hits, and the input was a plain word** (`zyzzyva`) — it throws
  `SearchResultsNotFoundError`, a distinct class so you can render "no results"
  calmly rather than as a failure. Everything else that throws is a real error.

Exact matches are tried before prefix matches, which is why `EDEN.1` navigates
instead of offering you `EDEN.1`, `.2` and `.3`.

## The third one has nowhere to go

JBrowse asks by queueing a dialog on the session, and a host that draws its own
chrome renders no dialogs — so the promise resolves, nothing throws, and nothing
moves. It is the same side door as the
[snackbar channel](../loading-and-errors/), and it has the same two answers:
render the queue, or never queue one. The section below does the second.
