---
name: session-spec-grammar
description: A Vega-Lite-style channel grammar for the session spec, in six parts: versioning the format, a uniform encoding block, reusable scales, collapsing three dialects to one canonical form, view combinators, and no sentinels in the public form. Plus the two config-layer proposals that outlived the note this grew out of.
---

# Session-spec expressiveness: a Vega-Lite-style channel grammar

Six changes that would make the session/figure spec behave like a published
visualization grammar rather than an internal MST serialization. Written against
the jb2export figure corpus, which is where the drift shows up. This is the
worked-out version of a two-line "declarative JBrowse spec" note that used to
sit in a `configuration-spec-layer` doc; that doc is gone and its two surviving
proposals are at the bottom of this one.

### 1. Version + schema the session format (the #1 stability gap)

The helpers file is littered with tells: "render against the local build because
`jbrowse.org/latest` ignores this prop" (`drawCurves`, `readConnections`,
`geneGlyphMode`). That is precisely the forward-compat problem Vega solved with a
`$schema` stamp and additive-only evolution.

- Add a `formatVersion` discriminator to sessions/configs and publish a JSON
  Schema per version.
- Provide an upgrade/compat layer that lifts old specs forward, so a figure can
  pin a version and be guaranteed to render the same across releases.
- Validate on load. Today a spec that's subtly malformed (see the synteny tracks:
  `[[...]]` vs flat `string[]` footgun, where a flat array silently collapsed to
  "level-0 only") fails by rendering wrong, not by erroring.

Without this, every published figure is implicitly pinned to "whatever latest
does today," which is the opposite of stable.

### 2. A uniform encoding block = ggplot's aes() (the #1 expressiveness gap)

Right now `colorBy`/`sortBy`/`groupBy`/`filterBy` are bespoke per display type —
they mean something on alignments, something different or nothing on
variants/synteny. Vega and ggplot feel expressive because channels are orthogonal
to marks: any aesthetic maps onto any geom. Define one shared channel grammar:

```json
"encoding": {
  "color":  { "field": "tag:HP", "scale": { "scheme": "haplotype" } },
  "sort":   { "field": "tag:HP" },
  "group":  { "field": "tag:HP" },
  "height": { "field": "score", "scale": { "type": "log", "domain": [1, 1024] } }
}
```

and interpret it uniformly wherever a channel is meaningful, per display type
declaring which channels it supports. This is the single change that most makes
it "feel like ggplot."

### 3. First-class, reusable scales

`scaletype:log` + `minmax:1:1024` (bigwig) is already a scale spec — it's just
trapped inside one display's vocabulary. Generalize a Scale object (type, domain,
range/scheme) usable by any quantitative channel: coverage height, feature color
ramps, methylation, GWAS -log10(p). One scale abstraction shared everywhere, the
way Vega scales are.

### 4. Collapse the three dialects to one canonical form + sugar

Make the jb2export CLI grammar (`color:tag:HP`, `display:multivariant`) a
lowering onto the same `displaySnapshot` JSON that sessions use — one canonical
schema, multiple front-ends (terse CLI sugar, full JSON). This structurally
eliminates the CLI-vs-session drift, and it means the screenshot corpus's `cli`
and `url` modes are testing the same code path.

### 5. Formal view combinators

You already have layer/concat-like composition (stacked views, multi-level
synteny tracks: `[[…],[…]]`, circular). Name a small closed set of combinators —
single / vstack / syntenyBetween / circular — with an explicit nesting contract,
analogous to Vega's layer/concat/facet. That removes ambiguities like the "is
this array a level or a single entry" trap and gives the schema a clean recursive
shape.

### 6. No sentinels in the serialized/public form

Your own CLAUDE.md flags `rowHeight === 0` = fit-to-height →
`effectiveRowHeight`. A public schema must not leak that. Offer a
`getResolvedSession()` that emits explicit resolved values — which is exactly
what a portable, reproducible figure spec wants anyway. Keep sentinels internal.

### Two config-layer proposals that outlived their own doc

Neither is part of the six above; both were folded in when
`configuration-spec-layer.md` retired, its other three entries having shipped or
been superseded (the bare-`{ uri }` shorthand and the Jupyter/R hosts both
landed, and the R export has its own doc at [r-export](r-export.md)).

**ConfigurationLayer (fanciful).** A construct that acts as a "layer over"
another config schema: same slots and types, but every slot's default is
whatever the parent schema's *current value* happens to be. Use case: cascading
config for subtracks, where a child overrides a handful of slots and inherits
the rest dynamically. Never built; the current `baseConfiguration` extension
covers most of the practical need, inheriting the *schema* rather than the live
values.

**Adapter-type inference from a file extension** (`fasta: 'foo.fa.gz'` → infer
`BgzipFastaAdapter`). This is the riskier half of a pair whose other half
shipped: `refNameAliases` and `cytobands` both take a bare `{ uri }` now, via
the `preProcessSnapshot` idiom in `assemblyConfigSchema.ts`. Extension-sniffing
is implicit magic — do it only if comfortable with that, and note the same
inference is what a `formatVersion` (§1 above) would have to keep stable across
releases.
