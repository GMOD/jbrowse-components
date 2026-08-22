Widgets — the hierarchical track selector, feature details — open in a resizable
side drawer, the way JBrowse Web does it. It moves left or right via the ⋮ menu,
minimizes and closes.

The view is otherwise content-height, so it can sit in a page that grows with
it. `drawerViewHeight` on `createViewState` is the height it is clamped to
_while a drawer is open_, giving the drawer a definite scroll region. Both sides
of that clamp scroll — the drawer, and the view beside it when the track set is
taller. It accepts any CSS height (`'600px'`, `'80%'`) and defaults to
`'100vh'`.

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
