---
status: Accepted
summary: "The mark display has one y scale and the display owns it: `scales.y` — a closed sub-schema of `type`, `domainMin` and `domainMax` — replaces `encoding.y`'s `scale`, `domain` and `resolve`, the \"first drawing mark owns the axis\" rule, and the inherited wiggle score slots. A mark's `y` is a field name, as `x`, `x2` and `row` already were: a positional channel is a field, and `color` and `glyph` are a constant or a scale object. The `resolve: 'independent'` second axis is withdrawn — ggplot2 has one scale per aesthetic and a reader of the two-axes picture cannot tell which bars belong to which numbers; two quantities are two plots, or a multiscale pair. `ScoreScaleMixin` splits into the axis contract (`ScoreAxisMixin`) and the slot-backed default, so composing the contract no longer means inheriting `autoscale` and `numStdDev`, which read nothing here"
---

# ADR-141: One y scale, the display's

## Status

Accepted (2026-09-19). Generalised by
[ADR-142](adr-142-one-value-scale-object.md): `scales.y` is now built by a
shared factory and every quantitative display declares one. Supersedes
[ADR-113](adr-113-one-scale-rule-in-one-place.md)
§"`encoding.y` carries the value scale" and
[ADR-115](adr-115-one-mark-may-read-its-own-axis.md)'s
`encoding.y.resolve` decision; amends
[ADR-124](adr-124-the-score-axis-autoscales-over-what-is-loaded.md)'s pin
destination, which is now `scales.y` rather than the owning mark's declaration.
ADR-113's other half — a quantitative colour ramp resolving on the main thread
against a domain unioned over the loaded regions — is untouched, as is
ADR-115's `pileup` step and its three track types.
[MARK_ENCODING.md](../reference/MARK_ENCODING.md) and
[GRAMMAR_OF_GRAPHICS.md](../reference/GRAMMAR_OF_GRAPHICS.md) are the
operational docs.

## Context

The y scale of the mark display had three owners. Each mark declared
`encoding.y.{scale, domain, resolve}`; a rule picked the first drawing mark
whose `y` named a field and made its declaration the axis, with `checkMarks`
refusing a second mark that declared a different one; and the wiggle score
slots the display spread — `minScore`, `maxScore`, `scaleType`, `autoscale`,
`numStdDev` — stood in for whatever the declaration left open. Two of those
five read nothing on this display: the score menu is built with
`autoscale: false`, and `numStdDev` feeds an autoscale computation only the
wiggle displays run. Both were published in the config docs anyway.

`resolve: 'independent'` sat on top of that. One mark could fold a domain from
its own layers and take a second axis on the right, which cost a reader rule
(`markValueScale`), a render-state member (`independentY`), an owner rule the
score menu had to skip, a caption rule that turned on only when two axes were
drawn, and a refusal for the second mark that asked. Colin's review of the
two-axes figure is the input that decided it: "this is two y-axes which ggplot2
doesnt even 'allow'. why. unclear what is even being plotted here."

That is the right reading. ggplot2 has one scale per aesthetic, owned by the
plot; a layer maps onto it and `sec.axis` is a transform of the primary, not a
second scale. Vega-Lite and GenomeSpy reach an independent resolution through
view composition, not through a channel. Here the chrome has one plot box and
one right gutter — `axisGutterLeft` places a second right-side axis on top of
the first — so the tree could never honour more than the one exception, and the
one exception is the picture that cannot be read.

## Decision

**One y scale, owned by the display. A mark's `y` is a field name.**

```jsonc
{
  "type": "LinearMarkDisplay",
  "scales": { "y": { "type": "log", "domainMin": 1 } },
  "marks": [
    { "shape": "bar",   "encoding": { "y": "score" } },
    { "shape": "point", "encoding": { "y": "score", "color": "black" } }
  ]
}
```

### `scales.y` is the declaration

`scales` is a closed sub-schema on the display with one member, `y`, itself
closed: `type` (`linear | log`, default `linear`), `domainMin` and `domainMax`,
both `maybeNumber`. An unset end autoscales over the loaded regions, which is
what `encoding.y.domain`'s `""` sentinel meant. The spelling is Vega-Lite's
`scale.domainMin`/`domainMax` rather than a `[min, null]` array, so the slot
types stay `maybeNumber` and the JSON schema, the config docs and the config
editor each see an end as a number. The colour ramp's `domain: [min, max]`
stays an array, both ends always being pinned there.

**The score menu writes `scales.y` and nothing else.** Set min/max, Pin current
min/max and Clear all land on `domainMin`/`domainMax` through `setConf` on the
sub-schema; there is no owner to find first. The scale-type radio stays opted
out (`scaleType: false`) because the shared radio offers `symlog`, which
`MarkValueScale` does not admit and `valueToYPxScaled` does not place — the
same opt-out Manhattan takes, and the call says so.

### A positional channel is a field

`encoding.y`, `x`, `x2` and `row` are field names or `jexl:` expressions, never
objects. That is the rule a reader learns once: a positional channel is a
field; `color` and `glyph` are a constant or a scale object.
`MarkEncoding.y` is `FieldRef`, `ValueEncoding` and `valueField` are gone, and
`encodeFeatures` reads one form.

The display folds **every** mark drawing at the view's zoom into the one
domain, so `sharedMarkIndices`, `valueMarkIndex`, `independentMarkIndex`,
`independentValueScale`, `markValueScale`, `MarkRenderState.independentY`,
`declaredDomain`, `setDeclaredBound` and the axis caption are all gone, along
with `checkMarks`' two refusals about disagreeing and independent declarations.
A multiscale pair is still coherent for the reason it always was: the density
mark and the feature mark are never both drawing.

### The axis contract splits from the slots that back it

`ScoreAxisMixin` is the derived half — `minScoreBound`, `maxScoreBound`,
`hasManualScoreBounds`, `defaultScoreDomain`, `valueScales`, `axes` — over
three members a composing display answers: `scaleType`, `manualMinScore` and
`manualMaxScore`. `ScoreScaleMixin` is that plus the
`scoreAxisConfigSchemaFields` reads and the setters, and wiggle, the
multi-wiggle, Manhattan and the alignments coverage band compose it unchanged.
The mark display composes `ScoreAxisMixin` and answers the three off `scales.y`,
so it inherits no slot it does not read. `declaredValueScale`, the hook that
existed for this one display, is deleted; the autoscale pair moves out of
`ScoreScaleModel` into an `AutoscaleModel` beside it, since a display can have
a score axis and no autoscale mode behind it.

`displayCrossHatches`, `scatterPointSize` and `minimalTicks` stay as the mark
display's own slots with their own getters, `showCrossHatches` being
`displayCrossHatches` here — nothing on this display spends colour on the score
instead of height, which is the distinction `WiggleScoreConfigMixin`'s
`isDensityMode` drew.

### Two quantities are two plots

A coverage run and a per-read mapping quality are two pictures. The config
writes them as two tracks, or as a multiscale pair on one:

```jsonc
{ "marks": [
    { "shape": "bar", "transform": [{ "type": "coverage" }],
      "encoding": { "y": "coverage" }, "minBpPerPx": 20 },
    { "shape": "point", "encoding": { "y": "score" }, "maxBpPerPx": 20 } ] }
```

`test_data/volvox/config_marks.json`'s `marks_two_axes` track is that pair now,
and the browser suite's scene shows the coverage run zoomed out.

## Consequences

- A config reader finds the y scale in one place, at the plot rather than
  inside a layer, and the axis it draws is the axis every mark was placed
  through. `hasManualScoreBounds` still answers yes for a pinned end, so
  "Clear manual min/max" still appears and still clears.
- `rpcProps` does not move: `encodingOf` already shipped `y.field` alone, so
  `SettingsInvalidate` and the fetch key are unchanged, and toggling linear/log
  still refetches nothing.
- The Plot field dialog's round trip is a function of `marks` alone — it never
  wrote a scale and now has none to write.
- The docs, demos and the `alu_age` dataset still spell the object form and the
  second axis; the sweep is a package of its own, and `website/docs/config/`
  regenerates from the schema.

## Rejected alternatives

- **`y2`, or Vega's named scales (`scales: { y, y2 }` with a mark naming
  `scale: 'y2'`).** Vega needs names because a spec has arbitrarily many axes.
  This display has one plot box and one right gutter — `axisGutterLeft` puts a
  second right-side axis on top of the first — and the picture it produces is
  the one the review could not read: which bars belong to which numbers.
- **A display-level inherited `encoding`, Vega-Lite's layer encoding.**
  Restating `y: 'score'` on a second mark costs one token. A second place to
  write it costs the Plot field dialog a merge, `checkMarks`' bar-needs-y rule a
  parent lookup, and the JSON schema's `requires` an `if`/`then` that cannot see
  a parent object at all (`scripts/configJsonSchema.ts`'s `pathRequirement`
  walks down from the mark). Worth revisiting when a config with three marks
  restating `y` turns up.
- **`{ field }` on the positional channels**, for symmetry with `color` and
  `glyph`. It lifts to nothing — there is no second member to reach for — and
  adds a `normalizeChannel` preprocessor per slot. The rule a reader learns is
  simpler without it.
- **A free-y band per mark, the form for a future config that does want two
  quantities in one display.** ggplot2 spells it `facet_grid(scales = "free_y")`
  and GenomeSpy `vconcat`: stack a band per mark and give each its own domain,
  drawn through the per-band axis the chrome already has
  (`ValueScale.bandTops`, [ADR-126](adr-126-a-row-lane-on-bar-and-point.md)),
  not through a right gutter. Nothing is built for it: the day a config asks
  for two quantities in one display, that is the shape, and a second axis on
  the right is not.
- **Keeping `autoscale` and `numStdDev` on the display for symmetry with the
  wiggle family.** They are two config slots, two rows of generated config
  documentation and two things a reader can set, and nothing on this display
  reads either.
