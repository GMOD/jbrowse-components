---
status: Rejected
summary: "Keep dotplot's and synteny's assembly-swap-check autoruns separate; a shared installer would put a mobx dependency on synteny-core to dedup ~12 lines"
---

# ADR-042: No shared assembly-swap-check autorun installer

## Status

Rejected (2026-07). Same genre as
[ADR-040](adr-040-no-genome-quad-vertex-helper.md): a real duplication that does
not clear the bar for extraction, recorded so the next reader doesn't re-derive
it.

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
