An `init.tracks` entry can be an object rather than a trackId string, carrying a
`displaySnapshot` — the initial display state, read once at startup. That
matters most on alignments tracks, whose display has a large configuration
surface (`height`, `showSoftClipping`, `colorBy` here).

The keys come from
[LinearAlignmentsDisplay](https://jbrowse.org/jb2/docs/config/linearalignmentsdisplay/),
and the track-level slots from
[AlignmentsTrack](https://jbrowse.org/jb2/docs/config/alignmentstrack/). See
[advanced init](../session-setup/#with-init-advanced) for the general
`displaySnapshot` / `trackSnapshot` shape.
