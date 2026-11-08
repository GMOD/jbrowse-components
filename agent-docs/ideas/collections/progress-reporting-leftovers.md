---
name: progress-reporting-leftovers
description: Small status-channel cleanups left after the 2026-11 review — two fetches that fake silence with a no-op sink, loading surfaces that each spell their own fallback and delays, phase labels as bare strings the aggregate keys on, and progress.ts restating its ADRs.
---

# Progress reporting leftovers

The channel itself is settled (ADR-071, 080, 081, 087, 122). These are the
edges a review of it found, none of them a defect a user sees.

## A silent fetch hands the RPC no callback

`installLodTierInfoFetch` and `LinearMarkDisplay`'s `MarkRowSources` read pass
`report: { setStatusMessage: () => {} }`. That builds a status window and hands
the RPC a truthy `statusCallback`, so the worker computes and posts statuses the
main thread throws away. `PROGRESS_REPORTING.md` §"No callback is a value"
forbids the same shape for a callback; the lint catches only the destructuring
default. The fix is a `report` that `installPrerequisiteFetch` may omit, which
makes the rotation pass no `statusCallback`. Cheap, and worth little: both are
header reads.

## One loading presentation

The `'Loading'` fallback is spelled in `LoadingOverlay`, `LoadingProgress` and
`viewLoading`; the slow and stall hooks are wired twice, in `ViewLoadingScreen`
and the embed's `ViewLoading`; the anti-flash delay is 250 ms in
`LoadingOverlay`, `0.25s` CSS in `ProgressChip` and 400 ms in the chord
`Loading`. One hook returning the label, the fraction and the stalled source
would hold them.

Waiting on a call: a view's loading screen holds its phase label back for two
seconds (`useSlowLoad`, from `72b75d91a6`), a track's overlay shows it as soon
as the overlay appears at 250 ms. Unifying the hook does not have to unify
that; keeping both is today's behaviour.

## Phase labels the aggregate keys on

`aggregateStatus` ranks and sums phases by exact label, and ADR-080's nesting
relies on an adapter's phase and the RPC's sharing one ("Downloading features",
seven call sites). A typo splits a phase into two incommensurable ones with no
error. Named constants for the shared labels would close it; worth doing beside
any other change to `downloadStatus`, not alone.

## `progress.ts` restates its ADRs

About half of its 1135 lines are comments, many retelling the defect each ADR
was written against. The rule is current behaviour plus the ADR number in code,
the story in the ADR.
