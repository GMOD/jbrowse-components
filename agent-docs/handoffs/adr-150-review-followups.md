---
name: adr-150-review-followups
description: A review of ADR-150 (a transform step is one schema per type) on 2026-09-21 found it implemented as written, with no defects. Three small items remain — the config-read-types gate is red from multiway gene colour's two utrColor reads, one ADR sentence overstates what the type-level parity test checks, and 19 live demo configs lag the repo's colour shape. Read before re-reviewing ADR-150 or chasing a red check-config-read-types.
---

# ADR-150 review follow-ups

The review drove ADR-150's claims rather than reading them: typecheck clean,
95 suites green across configuration, marks, the config editor, `jbrowse
validate`, the worker transforms and the rings. Blanking flatten's `index` on the
wire in `stepsOf` fails three `model.test.ts` tests, so the one-fetch-key pin
bites. A step with no `type`, or a key belonging to another step, fails with a
message naming the vocabulary. Every transform in `demos/`, `test_data/`,
`website/docs/` and the capture specs is in the new shape. **Delete this file
when the three items below are done.**

## 1. `pnpm check-config-read-types` is red on main

The gate counts 122 unchecked source reads against a baseline of 120, and
`push.yml` runs it on the typecheck job. The two new reads are
`readConfObject(conf, 'utrColor')` at
`plugins/linear-comparative-view/src/MultiWaySyntenyDisplay/geneColor.ts:74,78`,
from `bb7be68489`, where `geneColors` takes `conf: AnyConfigurationModel`. The
fix is to type `conf` as the multiway display's concrete schema, or the
`ConfigModelForFields` of the slot it reads, not to re-baseline. ADR-150's own
files moved lines only.

## 2. One ADR-150 sentence overstates the type-level test

The Decision section says `markTransformConfigSchema.test.ts` asserts at the type
level that the union, the wire's `TransformStep` and the rule list's
`StepSnapshot` "name the same types and the same slots". The type-level check
compares the step types across all three but compares slots only between the
schema and `StepSnapshot`. The schema-against-wire slot check is the runtime one
in `model.test.ts`, which the section's previous paragraph already names. Reword
the sentence so it names that split.

## 3. Nineteen live demo configs differ from the repo

`pnpm check-demo-configs` (run by `links.yml`) reports 19 demos drifted. For
`read_marks` the diff is the colour object's `domain` → `domainMin`/`domainMax`
and `ramp` → `range`, not transforms. Push with `scripts/deploy-demo.sh` only
once the hosted app reads the new shape, or the live demos break.
