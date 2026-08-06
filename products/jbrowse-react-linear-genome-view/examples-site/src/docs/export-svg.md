`exportSvg` renders the whole view to a publication-ready vector image, reached
through a [`ref`](../navigate-to-location/#external-navigate) (or
`state.session.view` under `createViewState`):

```js
await ref.current.session.view.exportSvg({ filename: 'volvox.svg' })
```

It resolves once every visible track has re-rendered through the SVG code path,
then hands the result to the browser's download flow. `format: 'png'` rasterizes
the same markup; `trackLabels`, `themeName` and `fontSize` tune the output.
Options:
[`ExportSvgOptions`](https://jbrowse.org/jb2/docs/models/lineargenomeview/#method-exportsvg).
