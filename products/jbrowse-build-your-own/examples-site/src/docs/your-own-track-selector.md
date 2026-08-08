The toolbar above builds its track list from an array written beside it. That
stops working the moment a track exists your source file did not know about, so
this one derives the list instead.

## `session.tracks` is the catalogue

Every track config the session holds: what you passed to `createViewState`, plus
anything added since. **It is not `view.tracks`**, which holds instantiated
tracks and so only what is on screen. Only one of the two answers "what could I
show".

Entries are raw configuration models, so slots come off them with
`readConfObject(conf, 'name')`. `getConf` is for models that _contain_ a
configuration and will not take these.

## Grouping is the `category` slot

A
[`stringArray` on every track config](https://jbrowse.org/jb2/docs/config/featuretrack/#slot-category),
and a path rather than a label: JBrowse's own selector reads
`['RNA-seq', 'Brain']` as a folder inside a folder. This one is a level deep.
Tracks declaring no category still need somewhere to go.

## Only the filter is React state

The checkbox reads `view.tracks` back, so nothing can disagree with it when a
bookmark or a restored session shows a track. The catalogue is read live for the
same reason: **Add a variant track** calls `session.addSessionTrackConf`, and no
callback reaches the selector.

## Order is yours to pick

`showTrack` appends, so `view.tracks` is in tick order and mapping it out gives
a column that reshuffles as the user clicks. This one renders in catalogue order
and skips what is not showing. **Order off `session.tracks`, not off the array
at the top of the file.** The two look identical until something adds a track at
runtime, and then it ticks on and draws nothing.
