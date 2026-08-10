---
name: shader-codegen-open-threads
description: What is left open in the shader→JS codegen after the 2026-08-10 sessions that added the generated liftability inventory, the C++ differential oracle, float2 returns, and the per-rule emitter coverage. Four small threads, each with the verdict already reached so it is not re-analysed — the five test-only exports, the inventory's churn risk, why no `vs_main` decision detector was built, and what would justify widening float2 past return position. The `_mix` thread is closed and kept only for the two mistakes it recorded. Read before touching `wgslToJs.ts`, the inventory or the oracle.
---

# Shader→JS codegen: what is still open

State as of 2026-08-10. **Everything settled is in
[ADR-051](../architecture-decision-records/adr-051-shader-js-codegen-is-scalar-only.md)
and [reference/SHADER_JS_CODEGEN.md](../reference/SHADER_JS_CODEGEN.md)** — the
design, the directives, the oracle's mechanics, the parity tiering, and the
facts that cost a session each. Do not look for those here. This file is only
the threads left hanging, and the verdicts already reached on them, so the next
session spends its time somewhere new.

Where things stand: 41 shaders scanned, 68 functions inside the emitter's
subset, 51 exported, 17 declined with a reason, **Candidates empty**, and
`pnpm check-shader-oracle` green at ~68,400 comparisons. Of the emitter's 17
translation rules the oracle exercises 8; the other 9 are held by
`wgslToJs.test.ts`'s per-rule table, whose completeness is asserted against the
exported `TRANSLATION_RULES`.

## 1. Five exports nothing imports — examined, verdict "leave them"

The inventory's last section lists them. Each was checked; none should be
deleted, and re-deriving that is the waste this entry exists to prevent:

| Export | Why it stays |
| --- | --- |
| `extendToMinWidthPx` | still the shared rule. Its direct importer went away when `rectSpanPx` subsumed the call site, but `rectSpanPx`'s own twin calls it as a private helper, and the shader uses it |
| `frequencyAlpha` | production moved to `frequencyFadeGate`; the rule is unchanged and still lifted |
| `normalizeScore` | wiggle's normalizer, still the shared half of the deliberately-divergent `scoreToY` |
| `sBlend`, `yCurve` | the deliberate test oracles ADR-051 describes. The report agreeing with the ADR here is a check on both |

**What would change the verdict:** a shader-side rule that stops being shared at
all — the function deleted from the `.slang`, or its Canvas2D counterpart gone.
Not "nothing imports it", which is the state above and is fine.

This is reported and deliberately not gated. A gate was designed and abandoned:
every row it would raise resolves to "leave it", and it would not catch the
accretion ADR-051 actually fears, since a *new* marginal export always has a
consumer — that being why someone added it.

## 2. `_mix` — CLOSED, and the premise was wrong twice over

Settled 2026-08-10 (second session). Kept only because both corrections are
worth not re-making; the thread itself is done.

This entry said **"nothing checks it"**. There *was* a check —
`wgslToJs.test.ts`'s 'mix uses WGSL's definition' — and it **passed against the
lerp form it existed to reject**, because it asserted on `(0.1, 0.3, 1)`, where
both formulations return `0.3` exactly. Its own comment claimed the lerp form
returned `0.30000000000000004` there; it does not. Confirmed by mutating the
helper and watching the suite stay green. A guard that reads as protection and
is not is worse than the absence this entry described.

The deferral was wrong too, and for a sharper reason than "the tolerance is
1e-5". slangc lowers `lerp` to `x + (y - x) * s` for `-target cpp` while
emitting `mix()` for `-target wgsl`, so **the oracle's reference implementation
uses the form the helper deliberately avoids**. The oracle is not too loose to
see the difference — it is pointed the wrong way, and tightening `REL_TOLERANCE`
would fail a *correct* `_mix`. No shader-side trigger would have changed that,
so there was never anything to wait for.

Both facts are now in
[reference/SHADER_JS_CODEGEN.md](../reference/SHADER_JS_CODEGEN.md): the
oracle's coverage boundary under `check-shader-oracle`, the vacuous-test lesson
under Verified facts.

**What replaced the trigger.** The oracle covers a translation rule only when
some shader in the tree calls that builtin from a liftable function — 8 of 17
as measured. The other nine now have a per-rule case in `wgslToJs.test.ts`, at
inputs checked to discriminate, and `TRANSLATION_RULES` is exported so the
table's completeness is asserted: a new entry in `MATH_BUILTINS`/`HELPERS` fails
the suite until it has one. There is no remaining "add a test when X happens" to
remember, for `mix` or anything else.

`step` is the other rule the oracle cannot referee (same C++/WGSL split, but
only on a NaN, and the WGSL spec has been published with both phrasings —
gpuweb#4527). Its answer is pinned by test rather than defended, and nothing in
the tree calls `step`.

## 3. The inventory's churn risk — watch, do not pre-empt

`SHADER_LIFT_INVENTORY.md`'s value is entirely in its diff: Candidates empty is
a signal only if people read the diff at all. Refusal *rows* were made stable
(`refusalBucket` normalizes line numbers and slangc's per-module suffixes), but
each row carries a **count**, and a count moves whenever any shader gains or
loses a function of that shape.

If that turns out to fire on most unrelated shader edits, people will learn to
skim past the file, and the mechanism is dead. **The remedy is to drop the
counts and keep the example names.** Deliberately not done pre-emptively — the
churn has not been observed yet, and a count is informative when it is stable.

## 4. No `vs_main` decision detector, and that was a decision

The inventory lists *functions*. A decision written inline in a vertex body has
no name, so nothing sees it — and two of the three exports that session added
(`rectSpanPx`, the chevron layout) came from exactly there, while their
Canvas2D twins were ordinary hand-written copies.

A detector was considered and refused: any heuristic available ("this stage body
contains a pixel snap and a magic constant") is noisy enough that people learn
to ignore it, which is worse than no mechanism. **The control is a habit, stated
in SHADER_JS_CODEGEN.md: when a `vs_main` grows a decision, give it a name.**
Naming it is what makes the inventory able to see it.

Reopen this only with a materially better idea than a keyword heuristic.

## 5. float2 is return-position-only; what would justify more

`vec2<f32>` is in the subset as a **return type** and nothing else — no vec2
params, locals, swizzles or arithmetic, and `vec3`/`vec4` refused by name. That
is enough for `rectSpanPx`, the paired decision ADR-051 was holding the door
open for.

The shape that would push on it is a predicate *taking* a pair ("does this span
overlap that one"). Nothing in the tree wants one today. If one turns up,
note that widening to parameters drags in vector locals and swizzles — i.e. the
general vector support the ADR calls unproven — so the first move is still the
ADR's: try splitting the scalar decision out, and only widen if the decision
genuinely is not scalar.

## What these sessions already proved, so it is not re-litigated

- The oracle can fail — verified by seeding a mistranslation, not assumed.
- Sweeping only *exported* functions checks the tested half; widening it to
  every emittable function found a real bug immediately, and widening the draw
  count by arity found a second.
- A green oracle is not "the emitter is checked". It is "the emitter is checked
  on the builtins the tree currently calls", which was 8 of 17.
- Both of those bugs were in fixes previously declared complete — and so was the
  third, which turned out to be a *test* declared complete rather than a fix.
  Expect the fourth to be too. The cheap habit that would have caught this one:
  when a test's whole point is that two formulations differ, run the rejected
  formulation and watch the test fail.
