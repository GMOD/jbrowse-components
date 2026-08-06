Widgets — the hierarchical track selector, feature details — open in a modal
dialog by default. Passing `drawerViewHeight` to `createViewState` puts them in
a resizable side drawer instead, the way JBrowse Web does it.

It accepts any CSS height (`'100vh'`, `'600px'`, `'80%'`) and constrains the
view's grid container while a drawer is open, so the drawer has a fixed scroll
region. With no drawer visible the view sizes to its parent as usual. The drawer
resizes, moves left or right via the ⋮ menu, minimizes and closes.

This demo calls
[`activateTrackSelector`](https://jbrowse.org/jb2/docs/models/lineargenomeview/#action-activatetrackselector)
on load. Clicking a feature opens its
[BaseFeatureWidget](https://jbrowse.org/jb2/docs/models/basefeaturewidget/)
there too — see
[customizing feature details](https://jbrowse.org/jb2/docs/config_guides/customizing_feature_details/).
Widgets are session actions: `session.addWidget(type, id, initialState)` then
`session.showWidget(widget)`.
