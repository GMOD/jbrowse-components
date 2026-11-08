---
name: one-read-field-registry
description: "The alignments read fields are listed once per role (color, facet, column sort, filter). One table with a column per role would let each role accept a field by type: whole-window sort by a tag, `insertSize` as a quantity, a log color scale."
---

# One read-field registry

The alignments field vocabulary is restated per role: `COLOR_FIELDS`,
`READ_DIMENSIONS`, `COLUMN_SORT_FIELDS`, and the filter's `isAdapterField` /
`isDrawnField` / `isReadField` (`shared/filterFields.ts` says so on purpose).
The filter's read dimensions are already derived: `READ_DIMENSIONS` and each
closed dimension's levels (`DIMENSION_LEVELS`) live in the import-free
`readFieldLevels.ts`, which `jbrowse validate` carries, and `DIMENSION_FIELDS`
is `READ_DIMENSIONS` less the fields the filter reads its own way (ADR-259's
2026-11-08 amendment).

A registry entry per field (name, measurement type, levels, per-read reader,
the tier that computes it) would let the other roles accept a field by type
and derive `sortProblems` and the More filters rows.

## What it makes sayable

Each checked as unsayable on 2026-11-07:

- `sort` by any field for the whole window (`tags.HP`, `mapq`), with `order`.
  Today a tag without `pos` keeps position order with a `sortProblems`
  warning, so it is not silent.
- `insertSize` as a quantitative field (sort, `gte`, ramp): no role can name
  TLEN since ADR-240 retired its color field.
- `scale.type: 'log'` for quantitative fields (`ALIGNMENTS_COLOR_SCALES` is
  ordinal, linear, threshold).

## The shape

A table whose columns are roles, not one flat list every role accepts:
`COLOR_FIELD_DEFS` carries a shader path and a menu slot, and a column sort
needs a per-position reader. `readFieldLevels.ts` is where its import-free
columns would go.

## Before any code

- Colin's go-ahead, then a draft of the end state and an adversarial review of
  the whole surface (memory `alignments-vocabulary-is-grammar-of-graphics`).
  The writers to update are in ADR-240's Order of work.
- The first step is the end state, not an interim: the table, the remaining
  lists derived from it (a missing role is a compile error), and
  `sortProblems` reading it.
