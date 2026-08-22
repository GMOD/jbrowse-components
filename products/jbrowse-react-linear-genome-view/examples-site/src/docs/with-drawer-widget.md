Widgets — the hierarchical track selector, feature details — open in a resizable
side drawer, the way JBrowse Web does it. It moves left or right via the ⋮ menu,
minimizes and closes.

A drawer needs the view beside it to be tall against something, so an otherwise
content-height view gets bounded while one is open: `height` on
`createViewState` if you passed one, `drawerViewHeight` (default `'100vh'`)
otherwise. Both sides of that bound scroll — the drawer, and the tracks beside
it, under a header that stays put. With the drawer on the left that is the
JBrowse 1 arrangement: sidebar, header, scrolling tracks. Prefer `height`, which
does the same without waiting for a drawer — see
[fitting the view in a fixed-height box](../default-session/#fixed-height).

`menuBar` is on here, which is the other thing this page shows: the app-shaped
`File` bar above the view, off by default everywhere else. Its two items open a
track or a connection, and both land in this same drawer.

`init.tracklist` opens the track selector on load. Prefer it to calling
[`activateTrackSelector`](https://jbrowse.org/jb2/docs/models/lineargenomeview/#action-activatetrackselector)
on the built engine: init opens the drawer and waits for the view to be resized
around it before navigating, so the region is framed at the width it ends up
drawn at. Clicking a feature opens its
[BaseFeatureWidget](https://jbrowse.org/jb2/docs/models/basefeaturewidget/)
there too — see
[customizing feature details](https://jbrowse.org/jb2/docs/config_guides/customizing_feature_details/).
Widgets are session actions: `session.addWidget(type, id, initialState)` then
`session.showWidget(widget)`.
