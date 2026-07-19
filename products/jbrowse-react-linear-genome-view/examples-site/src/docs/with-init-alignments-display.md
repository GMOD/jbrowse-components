An `init.tracks` entry can be an object carrying a `displaySnapshot`, the initial
display state read once at startup. This is most useful on alignments tracks,
where the display has a large configuration surface:

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
[advanced init](../session-setup/#with-init-advanced) for the general
`displaySnapshot` / `trackSnapshot` shape.
