---
name: grammar-of-graphics-crosscheck
description: A brief for a fable review of the channel objects (facet, the four colour objects, displayDefaults routing; ADR-130, 131, 133, 134) against ggplot2 — our own critique of the approach first, then fourteen questions naming the tree's files and the ggplot2 functions to check each against. Delete once the review's findings are filed in ADRs or ideas.
---

# Grammar-of-graphics cross-check of the channel objects

Four ADRs landed on 2026-09-18 and shaped how a display's categorical
channels are written:
[ADR-130](../architecture-decision-records/adr-130-a-facet-is-the-displays-and-splits-before-each-layers-steps.md)
(the facet is the display's),
[ADR-131](../architecture-decision-records/adr-131-a-categorical-channel-is-one-config-object.md)
(a channel is one config object),
[ADR-133](../architecture-decision-records/adr-133-a-channel-objects-slots-are-each-valid-alone.md)
(each slot of it is valid alone) and
[ADR-134](../architecture-decision-records/adr-134-displaydefaults-routes-a-value-to-the-displays-that-take-it.md)
(`displayDefaults` routes by value). Each was settled against the defect in
front of it, and none of the four mentions ggplot2. This brief asks a fable
review to read the result against ggplot2, the grammar most of our users
already think in, and to say which of our choices are the grammar's and
which are local accidents.

## What to read

- The channel objects: `packages/display-kit/src/colorConfigSchema.ts`
  (FeatureColor, `normalizeChannel`, `paintedScale`),
  `packages/display-kit/src/facetConfigSchema.ts`,
  `plugins/gwas/src/LinearManhattanDisplay/colorConfigSchema.ts`,
  `plugins/linear-comparative-view/src/MultiWaySyntenyDisplay/ribbonColorConfigSchema.ts`
  and `ribbonColorBy.ts` beside it, and MarkColor, MarkGlyph and MarkValue in
  `plugins/marks/src/LinearMarkDisplay/configSchema.ts`.
- The framework they declare through: `shorthand` and `closed` in
  `packages/core/src/configuration/configurationSchema.ts`, the lift in
  `snapshotPreprocess.ts`, and `slotValueRefusal` and the editor's
  `makeSlotFacade` in `slotFacade.ts`.
- The routing: `packages/core/src/pluggableElementTypes/models/expandTrackConfigShorthand.ts`,
  and `displayDefaults` in `scripts/configJsonSchema.ts`.
- The map across the whole layer:
  `agent-docs/reference/GRAMMAR_OF_GRAPHICS.md`, and its "Gaps against the
  grammar" section in particular.
- ggplot2 4.0.3 is installed (`~/R/x86_64-pc-linux-gnu-library/4.5/ggplot2`),
  so a claim about its behaviour can be run rather than recalled:
  `Rscript -e 'print(ggplot2::scale_colour_identity)'` prints a function's
  source. `~/src/vendor/gggenomes` is a ggplot2 extension for genome plots
  (feature tracks, synteny links, `position_strandpile`), the closest thing to
  a grammar-native genome browser to compare against.

## Our critique

What a reread of the landed design found. Each item is a fact checked in the
tree; whether it is a defect is what the questions below ask.

1. **`scale` names four different things.** On MarkColor it is a scale type
   (`categorical`, `linear`, `log`). Everywhere, `none` is the switch between
   mapping a field and setting a constant. On RibbonColor, `strand`,
   `identity`, `mappingQuality` and `dnds` each name a variable with a preset
   ramp. On ManhattanColor, `ld` names a variable computed by joining a
   second adapter (`makeLdEvaluator.ts`). In ggplot2 those are a scale, the
   difference between `aes(colour = x)` and `colour = "red"`, a variable
   (`aes(colour = identity)` with a gradient), and a stat.
2. **Mapping and setting share one object, and ADR-133 made it keep both.**
   A field under `none` or `ld` now persists in the config unread, so the
   Manhattan and multi-way menus can switch back to it. ggplot2 has no
   unread mapping: a plot specification is a value, and switch-back memory is
   the UI's concern. The cost we accepted: `jbrowse validate` no longer
   flags `color: { domain: [...] }` written without a `field`, which draws no
   field colours and says nothing.
3. **An unset scale follows the presence of a field, not the field's type.**
   `paintedScale` reads unset as `categorical` beside a field, MarkColor as
   `linear` only beside a `ramp`, so a numeric field with no ramp is
   categorical. ggplot2 picks discrete or continuous from the data. The
   ribbon's explicit `categorical` paints a numeric column as a ramp
   (RibbonColor's `field` docs), so its name says the opposite of what it does
   and its behaviour is what an unset scale would mean in ggplot2.
4. **Order lives on each channel, not on the field.** `facet.domain` and
   `color.domain` over the same field are two lists that can disagree. ggplot2
   takes facet order and legend order from one place, the variable's factor
   levels (or a scale's `limits`).
5. **Colour scales are per mark.** In the mark display two marks' colour
   scales never union, and each draws its own key (GRAMMAR_OF_GRAPHICS.md,
   "Scale resolution across layers is y's alone"). ggplot2 shares a scale
   across layers and merges their guides by default; Vega-Lite's
   `resolve.scale.color` defaults to shared for a layer.
6. **Four colour objects, four shapes.** FeatureColor has no `scale`,
   ManhattanColor and RibbonColor have display-specific ones, RibbonColor has
   no `palette`, and MarkColor has a `ramp`. ADR-134 routes a value to the
   displays that take it rather than giving them one shape. On a FeatureTrack
   the user meets the difference directly: Attribute → Solid color →
   Attribute on the feature display loses the attribute (FeatureColor cannot
   keep a field it is not painting), while the same round trip on the
   Manhattan display keeps it.
7. **The string shorthand means a field on one channel and a constant on
   another.** `facet: "strand"` is a field; `color: "strand"` is a colour
   string, and the `color` slot type is `types.string`, so nothing checks
   that `color: "biotype"` names a colour at all. ggplot2 separates the two by
   position (`aes()` or a parameter); Vega-Lite by the `field` and `value`
   keys.
8. **Identity scales go unnamed.** `color: "jexl:…"` computes a colour per
   feature, and an unset FeatureColor `value` lets a BED `itemRgb` paint:
   both map a variable through an identity scale, with no scale object and no
   legend from one. ggplot2 spells both `scale_colour_identity()`, whose
   legend is opt-in. RibbonColor's `identity` means per-cent identity, a name
   that collides with the grammar's term.
9. **Which slots a scale reads is known only to the readers.** `FIELD_SCALES`
   in `paintedScale` is a hand-kept list, and no schema declares that `ld`
   reads no `field`. So the config editor shows an unread field as though it
   painted, and neither the validator nor the docs can say "ignored here".
10. **`displayDefaults` judges each key alone.** `slotValueRefusal` runs a
    display's own preprocessor over `{ [key]: value }`, so a value whose
    meaning depends on a sibling key would be judged without it. No current
    rule breaks this: the one `requires` rule sits inside a mark, and the
    legacy pairs (`showLabels` with `showDescriptions`, `autoHeight` with
    `heightMode`) were already dropped as undeclared keys. The check's cost is
    within run-to-run noise: 0.72–0.78 ms to create a FeatureTrack with one
    `displayDefaults` key against 0.78 ms routing by name alone, since
    creating the display entries dominates.
11. **Synteny spells one channel two ways.** The synteny view's `colorBy` is
    a mode string (`attribute:group`), the multi-way display's `ribbonColor`
    an object, and `ribbonColorBy.ts` keeps a hand-written map between them.
12. **The editor test pins reload, not meaning.**
    `ChannelObjectSlotWrites.test.ts` proves every one-slot write reloads as
    written; that `{ field, scale: 'none' }` then paints `value` is pinned per
    display, not across the family.

## Questions for the review

For each, compare with ggplot2 (naming the functions) and, where it helps,
Vega-Lite and gggenomes. Say whether our choice is the grammar's, a
genome-browser need the grammar lacks, or an accident, and what a change
would touch.

1. **Mapping versus setting.** Should the constant (`value`) and the mapping
   (`field` through a scale) share one object selected by `scale`, or should
   they be two spellings as in ggplot2's `aes()` versus a parameter? What
   does each cost the config editor, which writes one slot at a time, and the
   menus' switch-back? Is ADR-133's unread field the right home for
   switch-back memory, or does it belong in session state?
2. **What `scale` is.** Classify every value of every colour object's
   `scale` (critique 1). Would `ribbonColor: { field: 'identity' }` with the
   preset ramp chosen by the field (synteny-core's `continuousRampConfig`),
   and Manhattan's LD as a computed variable, read more like the grammar than
   `{ scale: 'identity' }` and `{ scale: 'ld' }`? What is `ld` in ggplot2
   terms: a stat, `after_stat()`, or data preparation before the plot?
3. **Inferring the scale.** Should an unset scale resolve from the field's
   values, as ggplot2's default scales do, rather than from whether a field is
   named? The worker sees one region at a time; what would a region whose
   values all parse as numbers, beside one whose values do not, do to the
   legend? Should RibbonColor's explicit `categorical` force a discrete scale?
4. **Where order lives.** Should a field's level order be declared once and
   read by the facet, the colour, the glyph and the legend, as factor levels
   are in ggplot2? Where would that declaration live when the fields come
   from an adapter: the track, the display, the adapter?
5. **Sharing a scale across layers.** Should the mark display's colour scale
   be shared across marks by default, with a key merged as ggplot2 merges
   guides? What would break: per-mark palettes, the density-tier layer
   (ADR-117)?
6. **One colour vocabulary.** If question 2 reclassifies `ld` and the ribbon
   schemes as variables, do the four colour objects become one shape with a
   per-display list of scales, and is ADR-134's rejection of one vocabulary
   still sound? Critique 6's asymmetry on a FeatureTrack is the user-facing
   case.
7. **The string shorthand.** Is a per-channel meaning for a bare string
   (`shorthand: 'value'` or `'field'`) acceptable, given ggplot2 and
   Vega-Lite never make a bare value ambiguous? Should a `color` slot check
   that its value is a CSS colour or a `jexl:` expression, so
   `color: "biotype"` is caught?
8. **Identity scales.** Should a per-feature `jexl:` colour and a BED
   `itemRgb` be an identity scale with a name, as `scale_colour_identity()`
   is? Would that let the multi-row display's key and the multi-way lane
   glyphs' key, which today are derived from painted colours, become
   channel-backed? Should RibbonColor's `identity` be renamed?
9. **Facets.** Ours take one field, stack rows only, share x, carry an order
   and a cap (`MAX_GROUPS`), and can hide a section. Which of
   `facet_wrap`/`facet_grid`'s `scales = "free_y"`, a second variable, `drop`
   and labellers does a genome browser want? Is the alignments facet on a read
   dimension (`pairOrientation`, `mapq`) a field or a computed variable?
10. **Stacking.** ggplot2 separates stats from position adjustments
    (`position_stack`, `position_dodge`), and gggenomes packs features with
    `position_strandpile`. Our `stack` is a transform step. Is packing a
    position adjustment, and would saying so change anything: ADR-130's
    per-section stack is ggplot2's position computed per panel?
11. **Unread slots.** Should a schema declare which slots each scale reads,
    as a `ConfigurationSchema` option beside `shorthand` and `closed`, so the
    editor greys an unread slot, `jbrowse validate` warns, and the docs print
    it? ggplot2 warns "Ignoring unknown aesthetics"; is a warning the right
    level for a field the scale does not read?
12. **Routing `displayDefaults` by value.** Is routing each key to the
    displays that take its value the grammar's answer, or should
    `displayDefaults` name channels rather than slots? Compare ggplot2's
    `inherit.aes` and its per-layer handling of an aesthetic a geom ignores.
    Find any sibling-dependent value in the tree that critique 10's per-key
    check would misjudge.
13. **Synteny.** Should the synteny views' `colorBy` become the same channel
    object as the multi-way display's `ribbonColor`?
14. **Guides.** `derivedColorScale` builds a categorical key with one row
    per painted colour, named by the first value seen in it, where ggplot2
    derives a key from the scale's breaks. Where do the outcomes differ (two
    unlisted values hashing onto one colour share a row here and would be two
    rows there), and is the colour-keyed legend sound?

## What to hand back

One section per question: a verdict (keep, change, or measure first), the
evidence as `file:line` in the tree and the ggplot2 function or R session
output that settles it, and what a change would touch. Keep the authoring
surface apart from the implementation, and don't count a grammar's
generality as simplicity. End with the three findings that matter most to
someone writing a config or clicking a menu, and the ones that are naming
alone. Read only; make no edits; spawn no subagents or forks.

## Running it

From the primary checkout, not a worktree session, since the worktree guard
refuses a child's `Bash` grant:

```sh
CLAUDE_CONFIG_DIR=~/.claude3 timeout 2400 claude -p --model fable \
  --allowedTools "Read" "Grep" "Glob" "Bash(Rscript:*)" \
  "Read agent-docs/handoffs/grammar-of-graphics-crosscheck.md and do what it asks."
```

A fable review took about ten minutes on 2026-09-15. Its answers are claims to
check against the tree before any of them becomes an ADR.
