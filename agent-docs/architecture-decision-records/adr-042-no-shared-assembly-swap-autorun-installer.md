---
status: Superseded
summary: "Kept dotplot's and synteny's assembly-swap-check autoruns separate while a shared installer would have added mobx to synteny-core — superseded 2026-08 when the fetch skeleton brought mobx there anyway, which is the revisit condition this ADR named"
---

# ADR-042: No shared assembly-swap-check autorun installer

## Status

Rejected (2026-07-25). **Superseded 2026-08-04** — the installer now exists as
`installAssemblySwapCheck` (`@jbrowse/synteny-core`, alongside
`detectDisplayAssembliesSwapped`), and both displays call it.

Nothing about the reasoning below was wrong; its load-bearing premise expired.
The decision rested on the installer being the *sole* justification for a `mobx`
dependency on `synteny-core`. Six days later `installComparativeFetchAutorun`
landed in that same package (df2eab1b66, 2026-07-31), for an unrelated reason —
the shared fetch skeleton — and brought `import { autorun } from 'mobx'` with
it. That is verbatim the revisit condition in "Consequences" below: *"if
`synteny-core` picks up a `mobx` dependency for an unrelated reason — at that
point the installer costs one function and no new dependency, and the calculus
flips."* It flipped.

What tipped it past break-even rather than merely to it: the two `isAlive`
guards. The first exists because teardown fires the parent atom the gate reads
and `getContainingView` throws on a detached node; the second because the RPC
resolves long after a view can be closed, and writing to a dead node throws out
of an unawaited promise. Neither is visible in a diff that omits it, and neither
fails until a user closes a view mid-load — the class of duplication where
"twelve lines" undercounts what is actually being copied.

One loose end this surfaced, unrelated to the extraction: `synteny-core` imports
`mobx` (in `installComparativeFetchAutorun`) without declaring it in its
`package.json`, unlike every sibling package that imports it. Worth fixing at a
moment when the lockfile can be regenerated.

## Context

`dotplotAssemblySwapCheck` (`plugins/dotplot-view/src/DotplotDisplay/afterAttach.ts`)
and `syntenyAssemblySwapCheck`
(`plugins/linear-comparative-view/src/LinearSyntenyDisplay/afterAttach.ts`) are
the same one-shot autorun: bail if dead, read the two axis assembly names off the
containing view, bail if the view isn't ready, `await
detectDisplayAssembliesSwapped(self, top, bottom)`, commit via
`setAssembliesSwapped` behind a second liveness check.

They differ only in how the axis pair is obtained, and the readiness gate that
comes with it:

- dotplot: `view.assemblyNames` → `[hAsm, vAsm]`, gated on `view.initialized`.
- synteny: `views[level]`/`views[level + 1]` `.assemblyNames[0]`, gated on
  `view.initialized && level + 1 < view.views.length`.

The comparison itself (`detectDisplayAssembliesSwapped`, and the
`refNamesLookSwapped` counting under it) is **already shared** in
`@jbrowse/synteny-core`. Only the autorun wrapper is duplicated. So is the
"assemblies appear to be in the wrong order" warning text, which a concurrent
change had already promoted to `swappedAssembliesWarning`.

The candidate: `installAssemblySwapCheck(self, getAxisAssemblies, name)`, where
the callback returns the pair or `undefined` — folding the readiness gate and the
name extraction into one thing, which is right, since they are the same concern
("can I name the two axes yet").

## Decision

**Keep the two autoruns as they are.**

`@jbrowse/synteny-core` is the only package both callers share, so that is where
the installer would have to live. That package imports nothing from `mobx`
today. Hosting an autorun installer means adding **`mobx` as a direct dependency
of a published package** to dedup roughly twelve lines — three of which are the
`addDisposer(self, autorun(…))` idiom used verbatim across the entire codebase,
and two of which are `isAlive` guards that every async autorun here carries.

The abstraction doesn't pay for its placement. What was genuinely drift-prone —
the swap heuristic, and the warning text — is already extracted; what's left is
wiring, and it differs between the two callers in exactly the parameter the
helper would have to take.

## Consequences

- A reviewer who spots the two near-identical autoruns should read this ADR
  before extracting them. The shared part is already shared, one level down.
- Revisit if a **third** comparative display appears, or if `synteny-core` picks
  up a `mobx` dependency for an unrelated reason — at that point the installer
  costs one function and no new dependency, and the calculus flips.
- The general rule this instance illustrates: when the shared home for a helper
  would need a new dependency that the helper is the sole justification for,
  count that dependency as part of the extraction's cost.
