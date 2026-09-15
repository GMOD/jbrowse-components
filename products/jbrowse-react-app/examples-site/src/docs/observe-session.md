Anything marked `#getter` or `#property` on the
[session model](https://jbrowse.org/jb2/docs/models/basesessionmodel/) or a
[view model](https://jbrowse.org/jb2/docs/models/lineargenomeview/) is reactive.
There is no change callback: to save the session, take
`getSnapshot(viewState.session)` and pass it back as the `session` option.
