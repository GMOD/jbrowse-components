---
name: evaluate-jexl-channels-a-column-at-a-time
description: a jexl channel or filter evaluated over whole columns runs 2-10x faster than per feature, but only once the data already is columns — gathering the fields off feature objects first gives most of the gain back — so it waits on the call to encode features as columns, or on a window transform (lag, cumsum, score - mean(score)) that needs a column to exist
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
  jexl 5's `getMember` hook already offers without any columnar code.
- Gathering the fields off feature objects and then running columnar is
  0.50-0.74x the no-Proxy arm, so on today's feature objects the columnar pass
  buys little.
- Each pass that writes a fresh JS array costs about 5 ns/row, against 1.8 for a
  typed array. A throwaway typed kernel ran `-log10` at native speed (28.7 vs
  29.3 ns); it needs the grammar's built-in operators to be recognizable by
  identity, which jexl 5.0.1 now does for `&&`, `||` and `??`.

## What would make it worth building

- **The data is already columns.**
  [ADR-152](../../architecture-decision-records/adr-152-wiggle-stays-off-the-column-encoder-until-two-lanes-go.md)
  keeps wiggle off the column encoder; if that or a feature column table
  arrives, the gather row above disappears and the columnar row is the cost.
- **A window transform.** A columnar mode makes vector-only functions possible —
  `lag(score)`, `cumsum(score)`, `score - mean(score)` — which is the missing
  `window` transform in
  [GRAMMAR_OF_GRAPHICS.md](../../reference/GRAMMAR_OF_GRAPHICS.md).

## Where it would plug in

- Per non-bare channel in the encoder walk (`packages/core/src/util/markEncoding.ts`):
  gather the fields `analyze()` names once per region, then evaluate straight
  into the lane.
- The `filter` and `formula` steps (`packages/core/src/util/featureTransforms.ts`)
  as a selection vector and a column.

## Prototype

In the `@jbrowse/jexl` repo, local branch `worktree-agent-a48c86b91ece13085`
(commits `4ca9361` compileColumnar, `7616c93` the 100k-row bench, `a9d714d`
inferType, `56c8777`, `4c5d933`), built on jexl 4.0.1 and never rebased onto 5.
`Expression.compileColumnar({env, dataPronoun, envPronoun})` returns
`(columns, n, out?) => values`, with 23 parity tests against `eval`. One
semantic difference: a function called with no per-row argument runs once, so
functions are assumed pure.
