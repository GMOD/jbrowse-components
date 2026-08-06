Per-track appearance — color, height, display mode — belongs to a track's
**displays**, the different ways a track can be drawn. Rather than writing out
the `displays` array, list the settings in a `displayDefaults` object and
JBrowse works out which display each one belongs to:
`displayDefaults: { color: 'green' }` on a `FeatureTrack` lands on that track's
`LinearBasicDisplay`, with no need to name it.

A `jexl:` expression goes in the same slot for per-feature coloring. For full
control — two displays with different values, an explicit `displayId`, choosing
the default display — pass the `displays` array instead, per the
[track config guide](https://jbrowse.org/jb2/docs/config_guides/tracks/).
