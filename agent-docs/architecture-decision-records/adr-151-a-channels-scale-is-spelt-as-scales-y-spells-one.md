---
status: Accepted
summary: "A colour or glyph object spells its scale the way `scales.y` and Vega-Lite do: `range` is the output for every kind (a palette, a threshold's colours, a ramp's stops, the glyph names), `scheme` a named ramp from one table every baker reads, `domain` a list only (category order or threshold cuts), `domainMin`/`domainMax` a continuous scale's ends, each pinned or following the data, and `reverse` its direction. `range` is a `colorArray` on a colour object and a `stringEnumArray` on the glyph object. The kind is `scale`, or the display's default for the field (`paintedScale`), never inferred from which output member is written. One bridge, `colorEncodingOf`, builds the encoder's `ColorEncoding` off the live node for the mark and Manhattan displays. Supersedes the `palette`/`ramp` members of ADR-135 and ADR-144, and the mark and alignments colours' `linear` beside a ramp. No migration"
---

# ADR-151: A channel's scale is spelt as `scales.y` spells one

## Status

Accepted (2026-09-20). Supersedes the `palette` and `ramp` members of
[ADR-135](adr-135-the-colour-objects-share-one-shape-and-a-preset-is-a-field.md)
and [ADR-144](adr-144-one-colour-object-on-the-quantitative-display.md), the
mark colour's "unset beside a field, `linear` with a ramp and `categorical`
without", and the same rule on the alignments colour under a tag or attribute
([ADR-148](adr-148-the-alignments-read-fill-is-the-colour-object.md)'s
consequences). The flattening of
[ADR-131](adr-131-a-categorical-channel-is-one-config-object.md) and
[ADR-142](adr-142-one-value-scale-object.md) stands: a channel carries its
scale's members, it does not nest a scale object.
[ADR-153](adr-153-every-display-resolves-its-colour-through-one-function.md)
extends the one bridge below from the mark and Manhattan displays to every
display holding a colour object.

## Context

The colour objects named one scale's output two ways, `palette` for a
categorical or threshold scale and `ramp` for a continuous one, and spelt a
continuous domain as the pair `domain: [min, max]`, where `scales.y` already
said `domainMin`/`domainMax`. Each of the mismatches failed quietly, and every
one below was reproduced before this change:

- `ramp: ['magma']` loaded and painted the invalid-colour sentinel on every
  feature: a scheme name sat in a list of colour stops, and only the bare
  string `'viridis'` was special-cased. The config wrote `['viridis']` and the
  wire needed `'viridis'`, so the display converted between them.
- An entry of `palette` or `ramp` that was not a colour loaded, where the scalar
  `color` slot has refused one since ADR-136. A glyph `range` naming `star`
  drew a disc under a key saying `star`.
- `scale: 'linear'` beside a `palette` read the empty `ramp` and painted
  viridis; the word the scale did not read was ignored.
- The mark colour's kind followed `ramp.length`, so emptying the ramp in the
  config editor turned a linear scale categorical with no message.
- A ramp was reversed by writing its domain high to low, which the key could
  not show, and a half-pinned domain was a problem to report rather than a
  state: there was no way to pin a floor and let the ceiling follow the data.

## Decision

**One vocabulary.** A colour object's members are `value`, `field`, `scale`,
`domain`, `domainMin`, `domainMax`, `domainMid`, `range`, `scheme` and
`reverse`, of which each display declares the ones it paints by spreading
display-kit's pieces: `colorChannelSlots` (`field`, `scale`), `colorDomainSlot`,
`colorRangeSlot`, `colorRampSlots` (`scheme`, `reverse`, `domainMid`) and
`colorDomainEndsSlots`. Each is a fixed table or a one-parameter prose
factory, because the config docs generator recovers slots only from those.
The wire's `ColorEncoding` uses the same names.

- **`range`** is the output of every kind. **`scheme`** names a ramp from
  `COLOR_SCHEMES` (`@jbrowse/core/util/colorSchemes`), whose stop table
  `colorRampStops` reads for the encoder, the alignments bake and the wiggle
  LUT alike, so no display can declare a scheme nothing bakes. `range`'s
  colours win over it.
- **`domain` is a list only**: a categorical scale's order, a threshold
  scale's cuts. A continuous scale reads **`domainMin`** and **`domainMax`**,
  each pinned or following the loaded regions (`rampDomain`), and an open end
  stops at a pinned one rather than crossing it. **`reverse`** turns the stops
  round; ends written high to low span the same interval unreversed.
- **The kind is never inferred from an output member.** `paintedScale` reads
  `scale`, or the display's default for the field: `categorical` on the mark
  display, `categorical` over `source` and `threshold` over anything else on
  the quantitative display. A dialog may guess from data and write the guess;
  a reader does not guess.

**Two slot types.** `colorArray` holds CSS colours and refuses anything else,
the empty string included, at load and at a write. `stringEnumArray` takes the
author's enumeration as `model` and holds a list of its members, the way
`maybeStringEnum` wraps one in `types.maybe`, so `slotChoices`, the JSON
schema and the config docs read one vocabulary. The glyph object's `range` is
one, and its `value` a `stringEnum` over the glyph names.

**One bridge.** `colorEncodingOf(color, fieldScale)` in display-kit reads the
live config node, typed, and answers one fixed set of keys per scale kind, so
a fetch key compares alike whatever members a config happens to write. The
mark display and the Manhattan display both send it; the Manhattan worker no
longer rebuilds an encoding from a `ManhattanColor` of its own. `colorSpecOf`
is the Edit as JSON counterpart, the colour as written.

## Consequences

- A config spelt the old way fails the load naming the member, since every
  colour object is `closed`: `MarkColor takes value, field, scale, domain,
  domainMin, domainMax, range, scheme, reverse and domainMid, not palette`.
- A `domain` written beside a linear or log scale loads, since no slot
  combination is refused (ADR-133), and paints over the regions' extremes. The
  mark rule list reports it (`ramp-domain`), with ends written high to low
  (`ramp-ends`), in the display's notice and in `jbrowse validate`. The
  quantitative, alignments and Manhattan displays report it in their notice
  through the same `colorProblems`; `jbrowse validate` reports it for marks
  alone.
- `{ field: 'score', range: [...] }` with no `scale` is categorical on the mark
  display and a threshold on the quantitative display, where it used to be a
  ramp; a ramp asks for `scale: 'linear'`.
- A ramp table's `pinned` is a pair, one flag per end.
- **The plain fill does not keep a declared kind.** The menus switch to the
  constant by writing `scale: 'none'` over the object, which keeps the field,
  its order, range and ends for the way back but overwrites `linear` or
  `threshold`; a re-picked field then paints through its display's default
  scale. The alignments display recovered `linear` by reading it off a written
  ramp, which is the inference this decision removes, so a linear tag now comes
  back categorical, as a threshold already did. One `scale` slot cannot hold
  both "off" and a kind: keeping both across the round trip needs the set/map
  switch to be a member of its own, which is a change to every menu that
  writes `none` and to ADR-133's rule, and is not made here.
- The Edit as JSON box holds a colour spec to the members the display
  declares, read off its schema (`colorMembersOf`).

## Rejected alternatives

- **Keeping `palette` and `ramp` and making `scale` mandatory beside a ramp.**
  The inference that made two words necessary was itself the defect: dropping
  it makes `scale` defaulted, as every other colour object already had it, and
  every in-tree ramp already named its scale.
- **Nesting a scale object, `color: { field, scale: { type, range } }`.** The
  menus' most used transition, a constant and back, is one `scale: 'none'`
  write today and would become a sub-object write, and `scales.y` is not a
  channel, so nesting would not unify the two either.
- **`type` for the kind on a channel.** `type` names the kind of the object it
  sits on everywhere in a config; a channel is not a scale.
- **A `scheme` enum per display.** One table makes a scheme a display cannot
  bake unspellable; a per-display enum would restate it.
- **`domain: [min, max]` under a linear colour scale**, Vega-Lite's spelling.
  It brings back two spellings of one pin and a precedence rule between them,
  where `scales.y` has one. The trap it answers, a `domain` written under a
  ramp, is reported instead: `ramp-domain` in display-kit's `colorProblems`.
- **`mark` for the mark type and `shape` for the point symbol**, Vega-Lite's
  and GenomeSpy's names for what this display spells `shape` and `glyph`.
  After v5.0.0 ships, a rename breaks every config, and this cycle has no
  migrations. An author who writes their tool's spelling is refused at load
  either way, and `jbrowse validate` names ours: "Vega-Lite's "mark" is
  spelled "shape" here" (2026-09-21).
