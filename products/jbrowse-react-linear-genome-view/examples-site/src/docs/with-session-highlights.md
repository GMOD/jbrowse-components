Highlights paint a region over the genome — a locus of interest, a search hit, a
variant. They live on the session, so they round-trip through saved sessions.

Authoring them on the **view snapshot** lets each one carry its own color and
label:

```js
highlight: [
  {
    assemblyName: 'hg38',
    refName: 'chr1',
    start: 11_130_000,
    end: 11_145_000,
    color: 'rgba(255, 0, 0, 0.25)',
    label: 'Region of interest',
  },
]
```

There is also [`init.highlight`](../session-setup/#with-init-advanced), which
takes plain locstrings and so has nowhere to put a color or a label.
`addToHighlights` / `removeHighlight` are in the
[state model](https://jbrowse.org/jb2/docs/models/lineargenomeview/).
