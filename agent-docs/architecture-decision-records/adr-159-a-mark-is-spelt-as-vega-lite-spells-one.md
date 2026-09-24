---
status: Accepted
summary: "The mark display spells a mark's kind `mark` and the point symbol `encoding.shape`, as Vega-Lite and GenomeSpy do, where it said `shape` and `encoding.glyph`; the symbols are `circle`, `triangle-down` and `diamond`, Vega-Lite's names for what the painter draws. The keys a Vega-Lite or GenomeSpy author reaches for are the ones this schema declares, and `jbrowse validate`'s table translating the two is gone. The grammar's side says `shape` throughout — `ShapeEncoding`, `ShapeName`, `SHAPE_CODES`, the `MarkShape` config object and the legend's `shapeScale` — while the worker lane the point painter reads keeps render-core's word, `glyph`, beside `GLYPH_DISC` and `appendGlyph`. render-core's `MarkShape` interface, the painter/shader/hit triple, keeps its name. No migration"
---

# ADR-159: A mark is spelt as Vega-Lite spells one

## Status

Accepted (2026-09-23), Colin's call on a Fable review's open naming item.
[MARK_ENCODING.md](../reference/MARK_ENCODING.md) and
[mark_display.md](../../website/docs/config_guides/mark_display.md) carry the
operational description.

## Context

A `marks` entry named its kind `shape` and the point symbol channel `glyph`.
Vega-Lite and GenomeSpy name the kind `mark` and the symbol channel `shape`,
so the same word meant the kind here and the symbol there, and an agent
writing either grammar's layer produced a config that failed to load.
`jbrowse validate` carried a table for it: `SPELLED_HERE` told a reader that
"Vega-Lite's `mark` is spelled `shape` here" and "Vega-Lite's `shape` is
spelled `glyph` here". A Fable review leaned toward keeping the names,
because `MarkShape` already names render-core's painter/shader/hit triple.

## Decision

- **The config uses Vega-Lite's keys and shape names.** `marks[i].mark` is
  `bar`, `point` or `span`; `encoding.shape` is `circle`, `triangle-down` or
  `diamond`, a `jexl:` expression returning one, or a categorical scale over
  them. `disc` became `circle`, and `triangle` became `triangle-down`, since
  the painter draws it pointing down and Vega-Lite's `triangle` points up. A
  channel is still a bare field name or this schema's own object, not
  Vega-Lite's `{ field, type }`, so a layer copied from Vega-Lite needs its
  channels rewritten; its keys do not.
- **The grammar's code follows the config.** The encoding's channel and its
  types are `shape` (`ShapeEncoding`, `ShapeName`, `SHAPE_CODES`,
  `SHAPE_NAMES` in `@jbrowse/core/util/shapeNames`), the legend's scale
  table is `kind: 'shape'` on `shapeScale`, and inside the mark display a
  mark's kind is its type (`MarkType`, `MARK_TYPES`, `MARK_SPECS`,
  `markTypeOf`).
- **The painter keeps its word.** The lane the encoder fills and render-core's
  point mark reads stays `glyph`, beside `GLYPH_DISC`, `appendGlyph` and
  `PointChannels.glyph`: it is the painter's code per instance, not the
  grammar's channel, and `markLanes` maps the one to the other.
- **The translation table is gone.** `mark` and `shape` are declared keys, and
  a key the schema does not declare, `glyph` included, is refused like any
  other.

## Consequences

- A config writing `shape: 'bar'` or `encoding.glyph` fails to load, naming
  the key. There is no migration.
- Manhattan spread its mode's readers into the encoding (`{ y, ...readers }`),
  which passed the old `glyph` key through without an excess-property check;
  it names `shape: glyph` now, so a rename of the channel is a compile error
  there.
- `@jbrowse/core/util/glyphNames` is `shapeNames`, and `LegendSwatch.glyph`
  is `shape`; both were served only by v5 betas. `LegendSwatchGlyph` keeps its
  name: it draws a swatch that may be a glyph.
- The config object is `MarkShape`, as the colour one is `MarkColor`; the
  render-core interface of the same name is internal and never reaches a
  config or an error message.
- The measurement rows `jexl-glyph` and `scale-glyph` keep their ids, which
  the generated tables key on.

## Rejected alternatives

- **Keep `shape` and `glyph`.** The Fable review's lean. The collision it
  cited is internal — render-core's `MarkShape` — and a config's names are
  read by the people and agents who write configs.
- **`type` for the kind, as Vega spells `marks[i].type`.** A JBrowse config
  already reads `type` as a pluggable element's name, so a mark's `type`
  would read as one.
- **Rename the lane and render-core's painter too.** The painter's vocabulary
  is `glyph` from the shader constants to the hit test, and the lane is its
  input; renaming it buys no reader anything.
