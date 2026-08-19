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

### A uniform encoding block = ggplot's aes() (the #1 expressiveness gap)

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

### First-class, reusable scales

`scaletype:log` + `minmax:1:1024` (bigwig) is already a scale spec — it's just
trapped inside one display's vocabulary. Generalize a Scale object (type, domain,
range/scheme) usable by any quantitative channel: coverage height, feature color
ramps, methylation, GWAS -log10(p). One scale abstraction shared everywhere, the
way Vega scales are.

### Collapse the three dialects to one canonical form + sugar

Make the jb2export CLI grammar (`color:tag:HP`, `display:multivariant`) a
lowering onto the same `displaySnapshot` JSON that sessions use — one canonical
schema, multiple front-ends (terse CLI sugar, full JSON). This structurally
eliminates the CLI-vs-session drift, and it means the screenshot corpus's `cli`
and `url` modes are testing the same code path.

