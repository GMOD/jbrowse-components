---
name: evaluate-jexl-channels-a-column-at-a-time
description: A jexl channel or filter evaluated over whole columns runs several times faster than per feature, but only over columnar data; with column-table adapters and the plain-field fast path in, the call is whether computed channels over them are common enough.
---

# Evaluate jexl channels a column at a time

Written 2026-09-21 from a prototype in `@jbrowse/jexl`. What is held up is a
decision, not a measurement: the prototype and its numbers exist, and they say
the gain arrives only with columnar data.

**The idea.** A `jexl:` channel, `filter` or `formula` step today runs once per
feature, and each run walks the compiled expression once. R evaluates an `aes()`
mapping over a whole column instead, and the encoder here already fills
typed-array lanes. A columnar mode evaluates each node of the expression once
per region over all rows — `-log10(pvalue)` is one loop over a `pvalue` column —
using selection vectors so `?:`, `&&` and `||` evaluate a branch only over the
rows that reach it.

## Measured

100k rows, ns per row, minimum of 31 interleaved rounds, every arm checked to
agree before timing:

| Arm | `-log10(pvalue)` | `score>10 ? 'red' : 'blue'` | template |
| --- | ---: | ---: | ---: |
| Proxy per feature (before jexl 5) | 190 | 143 | 303 |
| `get()` from a reused context, no Proxy | 134 | 76 | 192 |
| plain row objects | 91 | 34 | 108 |
| getter cursor over columns | 93 | 39 | 118 |
| **columnar** | **68** | **13** | **60** |
| gather from features, then columnar | 99 | 38 | 110 |
| hand-written loop | 27 | 2.9 | 34 |

- Most of the gain over the old path is removing the per-feature Proxy, which
  jexl's `getMember` hook (since 5) already offers without any columnar code.
- Gathering the fields off feature objects and then running columnar is
  0.50-0.74x the no-Proxy arm, so on today's feature objects the columnar pass
  buys little.
- Each pass that writes a fresh JS array costs about 5 ns/row, against 1.8 for a
  typed array. A throwaway typed kernel ran `-log10` at native speed (28.7 vs
  29.3 ns); it needs the grammar's built-in operators to be recognizable by
  identity, which jexl 5.0.1 now does for `&&`, `||` and `??`.

## What has changed under it

- **Some data is already columns.** The mark pipeline runs over tables
  ([ADR-191](../../architecture-decision-records/adr-191-the-mark-pipeline-runs-over-tables.md)),
  and an adapter whose parser answers typed arrays hands them over as one
  ([ADR-193](../../architecture-decision-records/adr-193-an-adapter-answers-the-mark-pipeline-its-typed-arrays.md):
  BigWig's `ColumnTable` over bbi, the MAF arena). Over those sources the
  gather row above disappears and the columnar row is the cost. BAM, VCF and
  GFF stay feature objects: a column table for them would be a new
  representation between the parser and the instance buffer, which rule 1 of
  the grammar refuses.
- **A plain-field ref already takes the column path.** `jexl:feature.score`,
  `feature['score']` and `get(feature, 'score')` read through the field's
  columnar reader (`plainFieldName`, `f8b10f70f7`), so what is left is an
  expression that computes something.
- **The window transform exists without it.** The `window` step
  (`featureTransforms.ts`) runs fixed ops over each row's group in the worker.
  A columnar mode would add vector functions inside an expression (`lag(score)`,
  `cumsum(score)`, `score - mean(score)`), which nothing has asked for since.

The call is whether a computed channel over a column-table source is common
enough to carry a second evaluator.

## Where it would plug in

- Per non-bare channel in the encoder walk (`packages/core/src/util/markEncoding.ts`):
  gather the fields `analyze()` names once per region, then evaluate straight
  into the lane.
- The `filter` and `formula` steps (`packages/core/src/util/featureTransforms.ts`)
  as a selection vector and a column.

## Prototype

Branch `columnar-prototype` on
[GMOD/jexl](https://github.com/GMOD/jexl/tree/columnar-prototype) (commits
`4ca9361` compileColumnar, `7616c93` the 100k-row bench, `a9d714d` inferType,
`56c8777`, `4c5d933`), built on jexl 4.0.1 and never rebased; the repo pins
`@jbrowse/jexl` ^8.
`Expression.compileColumnar({env, dataPronoun, envPronoun})` returns
`(columns, n, out?) => values`, with 23 parity tests against `eval`. One
semantic difference: a function called with no per-row argument runs once, so
functions are assumed pure.
