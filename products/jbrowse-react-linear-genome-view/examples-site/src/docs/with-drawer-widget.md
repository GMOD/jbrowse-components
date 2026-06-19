By default, widgets like the hierarchical track selector and feature-detail
panels open in a modal dialog. Passing `drawerViewHeight` to `createViewState`
switches widgets to render in a resizable side drawer alongside the view, which
matches the behavior of the full JBrowse Web app:

```js
const state = createViewState({
  assembly,
  tracks,
  location: 'ctgA:1105..1221',
  drawerViewHeight: '100vh',
})
```

`drawerViewHeight` accepts any CSS height (`'100vh'`, `'600px'`, `'80%'`). It
constrains the embedded view's grid container while a drawer is open, giving the
drawer a fixed scroll region; when no drawer widget is visible the view sizes to
its parent as usual. The drawer is resizable (drag the handle), repositionable
left ↔ right via the ⋮ menu, minimizable, and closeable.
