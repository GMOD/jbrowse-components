The recommended way to embed JBrowse is the `init` field on
`defaultSession.view`. You give it an assembly name, a starting locstring, and
the trackIds you want open on first paint — JBrowse fills in the rest.

```js
const state = createViewState({
  assembly,
  tracks,
  defaultSession: {
    name: 'My session',
    view: {
      type: 'LinearGenomeView',
      init: {
        assembly: 'hg38',
        loc: 'chr1:11,106,077-11,261,675',
        tracks: ['ncbi-refseq-genes'],
      },
    },
  },
})
```

`init.loc` accepts any locstring, including space-separated multi-region strings
(e.g. `'chr1:100-200 chr1:500-600'`). `init.tracks` is a plain list of trackIds
to open. This is the same `init` shape JBrowse Web serializes into its
`?session=spec-…` [URL query parameter](https://jbrowse.org/jb2/docs/urlparams/)
— the embedded component makes no assumptions about URLs, so you pass it
directly.

Sibling fields on `defaultSession.view` configure the view itself
(`showCytobandsSetting`, `showGridlines`, `colorByCDS`, …). This example wires
up GRCh38 with cytobands, ref-name aliases, and a tabix-indexed RefSeq gene
track.

See [Advanced init](../with-init-advanced/) for per-track display snapshots, and
[Default session](../default-session/) for the full snapshot form.
