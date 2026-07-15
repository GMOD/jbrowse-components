An `init.tracks` entry can be an object carrying a `displaySnapshot` — initial
display state read once at startup. This is most useful on alignments tracks,
where the display has a large configuration surface. Here a CRAM track opens
colored by pair orientation, with soft-clipping revealed and an enlarged height,
all declaratively — no post-mount imperative calls:

```js
init: {
  assembly: 'GRCh38',
  loc: '1:100,987,200..100,987,450',
  tracks: [
    {
      trackId: 'my-cram-track-id',
      displaySnapshot: {
        type: 'LinearAlignmentsDisplay',
        height: 250,
        showSoftClipping: true,
        colorBy: { type: 'pairOrientation' },
      },
    },
  ],
}
```

The full set of `displaySnapshot` keys comes from the
[LinearAlignmentsDisplay](https://jbrowse.org/jb2/docs/config/linearalignmentsdisplay/)
config, and the track-level slots from
[AlignmentsTrack](https://jbrowse.org/jb2/docs/config/alignmentstrack/). See
[advanced init](../with-init-advanced/) for the general `displaySnapshot` /
`trackSnapshot` shape.
