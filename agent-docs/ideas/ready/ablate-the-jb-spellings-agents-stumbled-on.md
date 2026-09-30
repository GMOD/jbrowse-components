---
name: ablate-the-jb-spellings-agents-stumbled-on
description: jb accepts two extra spellings because sonnet runs stumbled on the documented one — addTrack's location doubling as a catalog trackId, and getFeatures' positional form. Each overloads a slot for an agent that guessed, so the eval should say whether a plain refusal costs sonnet or opus anything before either stays.
---

# Ablate the `jb` spellings agents stumbled on

The target agents are sonnet and opus at their best, and a spelling that exists
only to forgive a guess is a workaround to test rather than keep by default.

## The two candidates

- **`jb.addTrack`'s `location` names a file, a URL, or a catalog trackId.**
  `catalogName` (`packages/app-core/src/JbApi/jbApi.ts`) reads `trackId`, or a
  `location` that is neither a URL nor a path, as the name of a track the
  catalog holds and shows it. It landed in `3cb905c96b` after agent runs reached
  for `addTrack` to show a catalog track and paid a round trip for a refusal
  that named another helper. `view.launchTrack(trackId)` already shows a
  catalog track.
- **`jb.getFeatures('trackId', loc, { assembly })`.** The positional form exists
  because two of four filmed takes wrote it and lost a turn, and a third passed
  options third and had them silently ignored.

Both fit the pattern of one helper answering several spellings, which the
surface otherwise avoids.

## What the baseline says

Eighty-one eval sessions from 2026-09-15/16, all sonnet, made 369
`run_javascript` calls with 42 errored; six of those were the harness reporting
the app still loading. Of the 14 calls naming `addTrack`, 9 errored, and six
were the old refusal for a catalog trackId passed as `location`. The refusal
cost one extra call each and the agents recovered. That corpus predates the
overload, so it measures the cost of the plain refusal, not of the overload.

## The test

Hide each spelling behind the refusal it replaced, then run the dev and
held-out sets on sonnet and opus with `--runs 5`
(`agent-docs/reference/AGENT_EVALS.md`). Compare pass rate, turns and dollars
on `unknown-name`, `action-not-slot` and the `count-*` tasks, which reach those
routes. Keep a spelling only if removing it lowers pass rate or adds turns
that a clearer refusal would not recover.
