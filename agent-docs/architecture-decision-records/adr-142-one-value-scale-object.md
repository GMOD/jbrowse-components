---
status: Accepted
summary: "Every quantitative display writes its y scale as one `scales.y` object built by `valueScaleSchema({ types, autoscale, symlogConstant })` in wiggle-core: `type`, `domainMin`, `domainMax`, and `autoscale`/`numStdDev`/`numQuantile`/`symlogConstant` where the display draws them. A factory rather than a fixed object because the five displays' scale enums, autoscale modes and defaults differ, and a fixed object would put dead slots back on Manhattan and the mark display. The `Number.MIN_VALUE`/`MAX_VALUE` sentinels die with the flat slots — an unset `maybeNumber` end is what autoscales. `ScoreScaleMixin` reads and writes the object, so the score menu's two radios derive from what the scale declares instead of being opted out of, the mark display gains the three autoscale modes, and jbrowse-img's `--autoscale`/`--minmax`/`--scaletype` write `snap.scales.y`. `applyDisplaySettings` merges a partial sub-schema write rather than replacing the node, except on a channel, which a `shorthand` marks. No migration: a v5 config still saying `scaleType: 'log'` loses it. Amended 2026-09-20: the scale also owns `rules`, its reference lines as a typed array with a bare-number shorthand, and `title`, its axis caption as a three-state `maybeString`, each a factory opt-in; `ValueScale` carries both to the chrome, which draws a scale's rules down its own bands and its caption once however many bands it rules"
---

# ADR-142: One value-scale object, on every quantitative display

## Status

Accepted (2026-09-19). Generalises
[ADR-141](adr-141-one-y-scale-the-displays.md), whose `scales.y` was the mark
display's alone, to wiggle, the multi-wiggle, Manhattan and the alignments
coverage band, and retires
[ADR-124](adr-124-the-score-axis-autoscales-over-what-is-loaded.md)'s
`preProcessSnapshot` remap along with every other config migration on the v5
path. Amended 2026-09-20 under Consequences: the scale owns its reference
lines and its title.

## Context

Five displays draw a value axis and spelled its scale four ways.

The mark display had ADR-141's `scales.y`: `type`, `domainMin`, `domainMax`.
Wiggle and the multi-wiggle had seven flat slots — `scaleType`, `minScore`,
`maxScore`, `autoscale`, `numStdDev`, `numQuantile`, `symlogConstant` — two of
them widening a shared table the moment it was spread, since `symlog` is only
offered where a shader places it. `minScore` and `maxScore` defaulted to
`Number.MIN_VALUE` and `Number.MAX_VALUE`, sentinels standing for "unset" that
every reader had to resolve and that the config docs published as defaults.
Manhattan spread the same table and read three of its slots, opting the other
two out of the track menu by hand. The alignments coverage band hand-declared
its own six with different enums and a different `symlogConstant` default.

A config author met four vocabularies for one idea, and three displays
published slots that did nothing.

## Decision

**One factory, one object, and what a display draws decides its members.**

```jsonc
{
  "type": "LinearWiggleDisplay",
  "scales": { "y": { "type": "log", "domainMin": 1, "autoscale": "local" } }
}
```

`valueScaleSchema({ types, autoscale, symlogConstant })` in
`packages/wiggle-core/src/valueScaleConfigSchema.ts` returns a closed
`ConfigurationSchema`; `scalesSchema(y)` wraps it as the `scales` object, the
shape ADR-141 introduced as `MarkScales`, generalised. `scales` holds `y`
alone — one scale per aesthetic, owned by the plot.

### The members

| member | present when | wiggle / multi | Manhattan | coverage band | mark |
| --- | --- | --- | --- | --- | --- |
| `type` | always | `linear\|log\|symlog`, `linear` | `linear` | `linear\|log\|symlog`, `linear` | `linear\|log`, `linear` |
| `domainMin`, `domainMax` | always | unset | unset | unset | unset |
| `autoscale` | the factory is given modes | `local\|localsd\|localpercentile`, `localpercentile` | — | `local\|localsd`, `local` | `local\|localsd\|localpercentile`, `local` |
| `numStdDev` | `localsd` is a mode | 3 | — | 3 | 3 |
| `numQuantile` | `localpercentile` is a mode | 0.99 | — | — | 0.99 |
| `symlogConstant` | `symlog` is a type | 0 | — | 1 | — |
| `rules` | the factory is given `rules: { color }` | — | — | — | none, a rule drawn grey |
| `title` | the factory is given `title: true` | — | — | — | unset, which derives the shared `encoding.y` field |

`numStdDev` and `numQuantile` gate on the modes rather than on `autoscale`
being present at all: the coverage band offers `local` and `localsd`, so a
`numQuantile` there would be the dead slot this factory exists to remove.

An unset `domainMin` or `domainMax` autoscales that end. Both are
`maybeNumber`, so "unset" is `undefined` at every layer — the slot type, the
config editor, the JSON schema and the generated docs each see an end as a
number or as nothing. The `Number.MIN_VALUE`/`MAX_VALUE` sentinels are gone,
and with them `ScoreScaleMixin`'s raw `minScore`/`maxScore` getters, which
existed only to be resolved.

### The menu derives from the scale

`ScoreScaleMixin` is the `scales.y`-backed composer of `ScoreAxisMixin`. It
answers `scaleType`, `manualMinScore` and `manualMaxScore` off the object, adds
`autoscaleType`, `numStdDev`, `numQuantile` and `symlogConstant` — the last two
lifted out of `WiggleCommonMixin`, which held them because only the wiggle
schemas declared the slots — and writes all of them with `setConf` on the
sub-schema node.

It also answers `scaleTypeChoices`, the declared enum read back through
`slotChoices(getSlotDefinition(...))`. `makeScoreSubMenu` draws the scale-type
radio where that list has more than one member and the autoscale radios where
`autoscaleType` is defined, so its `scaleType: false` / `autoscale: false`
options go. Manhattan and the mark display each took one of those opt-outs, and
each took it for a fact its own enum now states.

The mark display therefore gains the scale-type radio (`linear`, `log`), and
every display gains a guarantee: a radio cannot offer a value the display's own
enumeration rejects.

### The mark display gains the autoscale modes

Its domain used to fold the worker-shipped `yMin`/`yMax` of each loaded layer.
It now scans the `y` lanes through `autoscale.ts`'s `ScoreSpan` — a count, a
stride into sorted starts and ends, and the low/high/avg value arrays — which
the wiggle packer's interleaved `featurePositions` and three summary arrays
also present themselves as. One walker, one percentile histogram, both callers.

**This clips the domain to the window.** The shipped extremes covered the whole
loaded region, buffered half a screen either side; the scan covers the visible
blocks, the way the wiggle family's always has. A pan can now move the mark
display's axis where it previously did not, which is
[ADR-124](adr-124-the-score-axis-autoscales-over-what-is-loaded.md)'s design
rather than a departure from it.

### The coverage band's object is `scales.y`

Not `coverageScales.y`. The alignments display has a pileup beside its band,
but nothing on it other than the band plots a value on an axis: the pileup has
no value, and the read-connection arcs have their own `arcYScale`. A second
name would be a distinction the display does not hold.

### A partial sub-schema write merges

`applyDisplaySettings` called `setSubschema(key, value ?? {})`, which replaces
the node. A settings bag, a session spec or a share link naming one member —
`{ scales: { y: { domainMin: 5 } } }` — therefore reset `type` and `autoscale`
with it, and every route through `showTrackGeneric` takes that door.
`mergedSubschemaValue` puts the incoming members over the node's own snapshot,
recursing where both sides are plain objects.

**A `shorthand` is what says a sub-schema is not merged.** A schema that takes a
bare string — `facet`, `color`, a mark's `glyph` — takes one written value, so
`{ field: 'biotype' }` after `{ field: 'biotype', domain: [...] }` is a facet
with no domain; merging would leave the old domain standing with no way to clear
it, and `channelSpec.test.ts` pins that. `Scales` and `ValueScale` declare no
shorthand: they are a namespace of independent settings, and naming one is not a
statement about the others. The config editor's own `setSubschema` is untouched
— its object is whole, and `configurationSchema.test.ts` pins that.

## Consequences

- One object on five displays, in one place, with the members each of them
  actually reads. Manhattan publishes two scale members rather than five;
  the coverage band publishes the same names as everything else.
- **No migration.** A config or session still saying `scaleType: 'log'`,
  `minScore`, `autoscale` or `numQuantile` at the display level loses it
  silently — MST drops an undeclared snapshot key without a word. This is the
  v5 position: no back-compat shims for old configs, so `remapRetiredAutoscale`
  is deleted rather than taught the new path, and a `global` autoscale in an
  old config is simply not read. In-repo configs move by hand.
- jbrowse-img's `--autoscale`, `--minmax` and `--scaletype` write
  `snap.scales.y.autoscale`, `domainMin`/`domainMax` and `type`. Three
  modifiers writing one object merge into each other, and the merge above lands
  the result on a display's own defaults rather than over them.
- Nothing crosses the wire. `sharedRpcProps` carries `bicolorPivot`,
  `resolution` and `scoreField`, single wiggle adds `useBicolor` and multi
  `summaryScoreMode`; no scale member is among them, so toggling linear/log or
  pinning a bound still refetches nothing.
- The generated config docs move from five sets of flat rows to one
  `ValueScale` page the `scales.y` row of each display links to.
- `scoreAxisConfigSchemaFields` and `ScoreAxisConfigModel` are gone.
  `displayCrossHatches` moved to `wiggleScoreConfigExtraSlots` — it is a
  display setting, not a member of the scale, and `RestatedMixinSlots.test.ts`
  now checks it across the four displays that declare it.

### Amended 2026-09-20: the scale owns its reference lines and its title

The factory takes two more opt-ins, `rules` and `title`, present only where a
display passes them, for the reason `autoscale` is: a slot a display does not
read is a dead slot. `rules: { color }` adds an array of
`{ value, color, label }`, a bare number standing for `{ value }`, and names
what a rule with no colour of its own is drawn in; `title: true` adds the axis
caption. The members table above carries which display takes which.

- **`rules` is a typed sub-schema array, never `frozen`**, for
  [ADR-107](adr-107-the-quantitative-class-is-authored-in-config.md)'s reason:
  the config docs, the JSON schema and the validator see `value`, `color` and
  `label`. The bare-number form needed `shorthand` to lift a number where the
  slot it names holds one (`shorthandForm`,
  `packages/core/src/configuration/snapshotPreprocess.ts`); a string shorthand
  lifts what it did.
- **A rule is a member of the scale all the way to the chrome.** `ValueScale`
  gains `rules` beside `caption`, and `YAxis` gains `ruleMarks`:
  `ScoreAxisMixin.axes` places each scale's rules through that scale's type and
  tick box, in the band's pixel space, and the two shells draw an axis's own
  marks down its own bands. The host-level `scoreRuleMarks` member is gone. It
  was one list the chrome drew over every axis of the host, so a display with
  two scales would have ruled its coverage band and its insert-size band with
  the same lines; and each display computed it in the whole-track box, which is
  why a faceted wiggle track drew none. `ScoreScaleMixin` reads
  `scales.y.rules` off the live nodes, since a snapshot strips a slot at its
  default and a rule at 0 is one. Each display's `domain` widens its raw range
  to the rule values through `widenRangeToRules`, under the pinned ends.
- **`title` is the `caption` ADR-109 gave `ValueScale`, in three states.** It
  is a `maybeString` slot, a slot type this change adds beside `maybeNumber`
  and `maybeColor`: unset derives, some text is that text, and `""` is an axis
  the author wants bare. A `string` slot defaulting to `''` had two states and
  spent the empty string on "unset", and `null` cannot be the third because
  [ADR-146](adr-146-null-is-the-json-spelling-of-a-slot-reset.md) reads it as
  a reset. The config editor drives it with the text field and its reset
  button, the JSON schema types it `string | jexl`, the docs generator links
  it to the `maybe*` section of the slot-types guide, and
  `ConfigSlotDefaults` snapshots it with no default. The mark display's
  derivation is the `encoding.y` field every mark drawing a value at the
  view's zoom shares, so a multiscale pair reads `score` at one zoom and
  `count` at the other; marks naming two fields, a `jexl:` y, and the density
  sidecar while it stands in derive none.
- **The chrome draws a caption once per scale.** `AxisGutter` drew it once per
  band, so the alignments' `TLEN` repeated down every grouped section and a
  faceted plot would have repeated its title down every row. A caption names
  the scale, and a scale with many bands still has one: `AxisCaption` draws it
  beside the bands on screen, centred on their extent, the way ggplot2 titles
  a faceted plot's axis beside the panel stack, on screen and in the export.
  That is one guide per scale and no choice between two drawings, so ADR-109's
  refusal of a member read only to pick a form does not reach it. A scale too
  short for an axis leads its `[min, max]` caption with its title, which
  otherwise had no gutter to be drawn in.
- **What the scale still does not own.** `displayCrossHatches` stays a display
  setting, as above: it toggles a guide, and the ticks the hatches sit on are
  already the scale's. `scatterPointSize` is a mark's size. A rule has no zoom
  range, so on a multiscale pair whose marks plot two quantities a rule drawn
  for one draws over the other; the form that fixes it is a rule as a layer
  with `minBpPerPx`/`maxBpPerPx`, and nothing is built for it
  ([GRAMMAR_OF_GRAPHICS.md](../reference/GRAMMAR_OF_GRAPHICS.md) §"Gaps against
  the grammar").

## Rejected alternatives

- **One fixed `valueScaleSchema` object, no factory.** It re-adds the dead
  slots the last two ADRs removed: `autoscale` and `numStdDev` on the mark
  display, which reads neither, and a `symlog` type Manhattan's shader does not
  place. A display's scale should publish what it draws, and the displays
  differ in what they draw.
- **Keeping the flat slots and documenting them as a group.** The four
  spellings were the problem, and a doc section does not make `minScore` and
  `domainMin` one name. The sentinels would have to stay too: a flat
  `minScore` needs a default, and `maybeNumber` on a flat slot reads as a
  display-level setting rather than as one end of a scale.
- **The autoscale mode outside the scale object**, as a display slot beside it.
  It is how the domain's unpinned ends are chosen, which is the scale's own
  business; put it outside and `scales.y` no longer answers "what does this
  axis do", which is the question the object exists to answer in one place.
- **GenomeSpy's `domain: { source: 'viewport' }`.** It spells autoscaling as a
  domain value rather than as a mode, which is elegant for one mode and has
  nowhere to put the other two — `localsd` and `localpercentile` are
  parameterised (`numStdDev`, `numQuantile`), so they become
  `{ source: 'viewport', method: 'sd', n: 3 }` and the flat members come back
  nested. Vega-Lite's `domainMin`/`domainMax` plus a named mode is the simpler
  pair, and it is already the spelling ADR-141 chose.
- **A migration lifting the five flat keys into `scales.y`.** It is one
  `preProcessSnapshot` and would cost nothing to write. v5 takes no config
  migrations at all, and one here would be the exception that makes the next
  one arguable.
