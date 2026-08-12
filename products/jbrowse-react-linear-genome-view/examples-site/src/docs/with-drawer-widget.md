Widgets — the hierarchical track selector, feature details — open in a resizable
side drawer, the way JBrowse Web does it. It moves left or right via the ⋮ menu,
minimizes and closes.

The view is otherwise content-height, so it can sit in a page that grows with
it. `drawerViewHeight` on `createViewState` is the height it is clamped to
_while a drawer is open_, giving the drawer a definite scroll region. It accepts
any CSS height (`'600px'`, `'80%'`) and defaults to `'100vh'`.

This demo calls
[`activateTrackSelector`](https://jbrowse.org/jb2/docs/models/lineargenomeview/#action-activatetrackselector)
on load. Clicking a feature opens its
[BaseFeatureWidget](https://jbrowse.org/jb2/docs/models/basefeaturewidget/)
there too — see
[customizing feature details](https://jbrowse.org/jb2/docs/config_guides/customizing_feature_details/).
Widgets are session actions: `session.addWidget(type, id, initialState)` then
`session.showWidget(widget)`.
