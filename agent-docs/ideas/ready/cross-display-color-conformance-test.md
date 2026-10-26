---
name: cross-display-color-conformance-test
description: One table of color specs run through every display's color resolver, with the exceptions named, synteny's data-decided default among them. The predicate half would be vacuous, since compilePredicates is the one compiler.
---

# A cross-display color conformance test

- **In:** one table of `encoding.color` specs, such as `{ field: 'score' }`
  or `{ field: 'type', scale: { domain, unknown } }`.
- **Out:** the color each display paints a given value, with each display's
  divergence listed as a named exception that can only shrink.

## Why only colors

`compilePredicates` (`packages/core/src/util/fieldPredicate.ts`) is the only
filter compiler. Displays differ only in the lanes they supply, and
`fieldPredicate.test.ts` already checks lane parity. A predicate table would
pass by construction.

## The divergences it would name today

Each display picks its own default scale for a color `{ field }`:

- canvas and mark displays: `score` is linear, any other field ordinal
  (`colorScale.ts`, `fieldScaleOf`);
- the multi-sample variant display and the multi-way gene color: always
  ordinal;
- wiggle: threshold, and an ordinal scale paints `MISCONFIGURED_COLOR`;
- synteny: linear whenever the observed column is numeric, ordinal once a
  value is text (`packages/synteny-core/src/colorRamps.ts`), the one default
  that the loaded data decides. A written `scale.type` overrides it.

There are also smaller differences:

- An alignments tag with no `domain` colors each value by a function of the
  value alone, where canvas deals colors first-seen into held slots.
- Synteny declares no `unknown` or `invalid`, though its closed schema refuses
  them loudly.

## The rule

Synteny keeps inferring its default scale and stays a named exception,
because its adapters parse column types and so state a column's kind only in
the loaded data. The test lives in `products/jbrowse-web/src/schemaTests/`, since
display-kit cannot import the plugins. It needs about 300–400 lines, mostly
one adapter per display that turns that display's resolver output into one
answer to "what color does value v get".
