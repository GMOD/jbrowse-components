The view can paint highlighted regions over the genome — useful for calling out
a region of interest, a search hit, or a variant locus. Highlights live on the
session, so they round-trip through saved sessions.

Authoring them on the **view snapshot** lets each highlight carry its own color
and label:

```js
view: {
  type: 'LinearGenomeView',
  highlight: [
    {
      assemblyName: 'hg38',
      refName: 'chr1',
      start: 11_130_000,
      end: 11_145_000,
      color: 'rgba(255, 0, 0, 0.25)',
      label: 'Region of interest',
    },
  ],
  init: { loc: 'chr1:11,106,077-11,261,675', assembly: 'hg38', tracks: [/* ... */] },
}
```

The simpler [`init.highlight`](../session-setup/#with-init-advanced) field also exists, but it
only accepts plain loc-strings (no per-highlight color or label). The
`highlight` property and its `addToHighlights`/`removeHighlight` actions are
documented in the
[LinearGenomeView state model](https://jbrowse.org/jb2/docs/models/lineargenomeview/).
