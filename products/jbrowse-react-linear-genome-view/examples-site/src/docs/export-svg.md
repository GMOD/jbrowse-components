The view renders to a publication-ready vector image with the `exportSvg`
action, reached through a [`ref`](../navigate-to-location/#external-navigate) on
`<LinearGenomeView>` (or `state.session.view` when you use `createViewState`):

```js
await ref.current.session.view.exportSvg({ filename: 'volvox.svg' })
```

It resolves after every visible track has re-rendered through the SVG code path,
then hands the result to the browser's download flow. Pass `format: 'png'` to
rasterize the same markup, or `trackLabels` / `themeName` / `fontSize` to tune
the output.

`exportSvg` and its options (`ExportSvgOptions`) are documented in the
[LinearGenomeView state model](https://jbrowse.org/jb2/docs/models/lineargenomeview/#method-exportsvg).
