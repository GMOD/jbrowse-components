---
status: Accepted
summary: "A mark leaving a channel unwritten reads what its steps wrote (`y` from `coverage` or a single-op `aggregate`, `x2` from `mate`, `row` from `pileup`), resolved by `stepChannels` on the main thread before the request; a written channel wins"
---

# ADR-173: A step names the channel its output feeds

## Status

Accepted (2026-09-26). Colin chose it over keeping every channel written
("steps fill their channels"), shown the two configs side by side.

## Context

Thirteen in-tree `marks` configs wrote a step's output back as a channel:
`y: 'coverage'` after a `coverage`, `y: 'count'` after a count, and
`x2: { refName: 'mate.refName', pos: 'mate.start' }` after a `mate`. Each has one
answer the step already knows. `row` had worked this way since the `pileup`
step landed, resolved in the worker (`survivingPileupField`). Leaving `y` off
a bar behind a coverage step drew nothing and failed the schema's
`mark-without-value`, which reads one mark and so cannot see a step, and
adding a coverage step in Edit plot left the bar empty until `y` was set too.

## Decision

`stepChannels` walks the steps in the order they run and answers `{ y, row,
x2 }`: `coverage` sets `y` to its `as`; an `aggregate` with one op sets `y` to
that op's field and with more sets none; either clears `row` and `x2`, since
it makes its features anew; `pileup` sets `row`; `mate` sets `x2`. The model's
`markChannels` reads it per mark, `encodingOf` fills a channel the config left
unwritten, and every "does this mark plot a value" test reads the result. The
rule list reads the same function, so `mark-without-value` is a rule there,
with `jbrowse validate` carrying it through `generateMarkRules`.

## Consequences

- The worker reads `row` as the request names it. `layerFeatures` lost its
  fallback; the Manhattan request never packed.
- `x2` left at `end` counts as unwritten, so a link behind a `mate` step that
  means its own end must write another field.
- The mark schema has no `requires` left. The mechanism stays in core with its
  tests.
- The default plot a display picks writes these shorter forms: a link over a
  `mate` step, and for aligned reads a coverage bar.
