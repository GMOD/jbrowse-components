# plugins/wiggle

One display over five shaders, one Canvas2D twin and one hit test, all in
`src/shared`. Scale/axis/score machinery is `packages/wiggle-core`, because six
other plugins draw a wiggle-shaped axis against it.

`LinearWiggleDisplay` registers against both `QuantitativeTrack` and
`MultiQuantitativeTrack`; the track types differ in adapter shorthand and
add-track workflow, and `MultiQuantitativeTrack/displaySchema.ts` is the whole
of what they differ in on screen — one row per source, average scores, 200px, as
the slot defaults of the wiggle schema the multi track's `displays` union holds.
ADR-143, ADR-172.

## Rules

Each is a section of
[reference/WIGGLE_DISPLAY.md](../../../agent-docs/reference/WIGGLE_DISPLAY.md),
which has the why — read that section before changing what it covers.

- Four records, because a module reflects one instance struct
- `rows` is the layout, and `plotGeometry` is where it lands
- A BigWig answers in bins below its first zoom level
- The rows are a getter over `rpcDataMap`
- `viewportWidth` is CSS px — `clip.scissorW`, never `clip.pxW`
- Three separate decisions inside "how wide is a bar"
- `makeScoreNormalizer` is the one `js-export` twin that doesn't retire
- One fetch, and `rowIndex` is the position in the display's own `sources`
- Three gap rules, one owner each
- Effective vs raw `summaryScoreMode`
- A band splits into solid layers only when the bars nest
- A line plot is one line, colored by the band between two cuts it is in
- The color key follows the scale
- The whole color UI is one menu row
- The shipped arrays are aliased — read, never write
