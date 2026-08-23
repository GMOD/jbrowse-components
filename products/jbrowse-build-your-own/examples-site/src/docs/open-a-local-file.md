A `File` from an `<input type="file">` becomes a track in four calls. No server:
`storeBlobLocation` registers the bytes in a map JBrowse's `openLocation` reads,
and adapters range-read a blob exactly as they do a URL — so a 40 GB CRAM costs
the same few requests it would over HTTP.

```ts
const location = storeBlobLocation({ blob: file })
const adapter = guessAdapter(location, indexLocation, undefined, view)
session.addSessionTrackConf({ trackId, type: guessTrackType(adapter.type, view), ... })
view.showTrack(trackId)
```

`guessAdapter` matches the **file name** against every format the loaded plugins
know and puts the index in whichever field that adapter wants; `guessTrackType`
says which track type draws it. Both take an MST node to reach the plugin
manager, and it must be one _inside_ the session: `getSession` starts at the
node's parent, so the session itself throws.

`addSessionTrackConf` is the destination — a track for this visitor, not a
catalogue entry. A config it rejects reports on
[`session.snackbarMessages`](../loading-and-errors/) rather than throwing.

## A blob has no sibling

An index is derived from a URL by appending to it. A blob has nothing to append
to, so `makeIndex` returns the location it was handed: the data file as its own
index. The picker takes the pair, and the pairing rule is yours — every indexing
tool names the index after the data file.

A blobId means nothing to another tab, a reload, or a session snapshot. Local
tracks last for the visit.

## The empty track that is a naming mistake

`1/2/3` and `chr1/chr2/chr3` are both normal, and a file using the other one
loads, fetches, and draws nothing. `track.refNameMismatch` is JBrowse's verdict
for the case it can prove (no name in common), and `refNameMismatchMessage`
phrases it. Draw it even if you draw no other chrome: JBrowse's own copy hangs
off the track label, so a host without labels shows the commonest data mistake
as an empty region. The third button opens a file that hits it.
