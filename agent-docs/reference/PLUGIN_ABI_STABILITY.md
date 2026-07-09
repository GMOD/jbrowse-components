# Plugin ABI stability & architecture ossification

**Purpose.** Why "architecture we built once becomes maintained forever," what
actually causes it, and a menu of fixes ordered by leverage. This is the
problem-analysis + options doc that fleshes out **RFC-001 §7 "API stability
policy (deferred)"** — it is *not* a committed policy. RFC-001 deferred formal
semver/`api-extractor` discipline as premature for an experimental phase; this
doc captures the thinking so it's ready when there are stable surfaces to
protect. Read alongside `ARCHITECTURE.md` "Display stacks".

---

## The symptom

A design decision (e.g. the legacy block-render stack behind `BaseLinearDisplay`)
becomes legacy, but cannot be removed, so it is maintained indefinitely. The
codebase accretes frozen layers that nobody actively wants but nobody can prove
are safe to delete.

## The root cause is not "runtime imports" — it's the *invisible, unbounded,
unversioned ABI* they expose

Runtime-loaded plugins **must** share the host's singletons (React, MST,
`@jbrowse/core`) — bundling their own copies duplicates React, breaks
`instanceof`, and bloats. That sharing is delivered two ways today:

| Surface | Where | How plugins reach it |
| --- | --- | --- |
| Core re-export registry | `packages/core/src/ReExports/list.ts` (~289 lines) | `jbrequire('@jbrowse/core/...')` |
| Per-plugin `exports` object | each plugin's `exports = { … }` (e.g. `LinearGenomeViewPlugin.exports`) | `pluginManager.getPlugin('X').exports.Y` |

The delivery mechanism is **load-bearing and not removable** without killing
no-build runtime plugins (a core JBrowse feature). But the mechanism is just the
pipe. The disease is three properties of *what flows through it*:

- **Invisible** — nothing tells you `BaseLinearDisplay` is load-bearing until an
  external plugin breaks at runtime in a deployment you never see. The host
  build has zero visibility into external consumers.
- **Unbounded** — every symbol ever added to an `exports` object or `list.ts` is
  *accidentally* public. There is no line between "API we promise" and "thing we
  happened to expose."
- **Unversioned** — a plugin built against last year's host resolves against
  today's `.exports` with no compatibility check. Removing a symbol is a runtime
  `undefined is not a function`, not a build error.

"Maintained forever" is the symptom. The cause is: **you can never prove a thing
is safe to remove.** So nothing is removed.

---

## In-tree is already solved; external is the whole problem

For **in-tree** consumers the compiler *is* the contract test: remove a symbol an
in-tree plugin composes and `tsc` fails in the same PR. An in-tree export
snapshot mostly reinvents that — low value.

The unsolved problem is **external** plugins:

- built against a *published* `@jbrowse/*`,
- resolving the ABI at **runtime** in environments you can't observe (a huge
  fraction of JBrowse is self-hosted academic deployments that never phone home),
- failing at **runtime, not build time**.

No amount of in-tree analysis sees them. Design every fix below around "consumers
I cannot see."

> **RFC-001's direction** (§2 goal #3, §4): replace `getPlugin('X').exports.Y`
> with static `import { Y } from '@jbrowse/plugin-x'` resolved via esbuild
> `globalExternals`. This makes a plugin's host-dependencies **explicit in its
> own source and build** (typecheck + visible import graph) — a real
> improvement to *plugin-author* ergonomics. But note: `globalExternals` does
> **not** by itself solve the *host's* problem. The host still exposes a surface,
> still can't see external consumers, and still can't tell what's safe to remove.
> The moves below are what bound/version/observe that surface.

---

## The real cure: bound what external plugins *can* reach

You cannot prove an external plugin doesn't use `BaseLinearDisplay`. The only way
to make an internal **safe to refactor** is to make it **unreachable**. Ordered
by leverage:

### 1. Split the runtime surface into `@public` vs everything else (highest leverage)

Curate a small, named, documented `@public` set that external plugins may reach;
put the rest behind a separate, explicitly-unsupported path (`Plugin.unstable.X`,
or simply absent from the registry). Then "is this safe to remove?" gets a
*static* answer for the first time: if it was never `@public`, a plugin that
reached it did so knowing it could break.

- The stable set becomes **small enough to actually honor forever**; everything
  behind the boundary is free to refactor.
- `BaseLinearDisplay` is the poster child: it's in `.exports` by accident of
  history, not by intent.
- Enforce the boundary with a checked-in snapshot of the `@public` set so changes
  to it are a *reviewed decision with a changelog line*, not silent drift. (The
  snapshot's value is governing the *external-facing* surface — not catching
  in-tree breakage, which the compiler already does.)

### 2. Version the contract and fail *loud*

The worst external failure is silent `undefined is not a function` six months
later. Give the plugin-API surface a **semver** and a **load-time compatibility
check**: a plugin declares the API version it targets; the host refuses to load
on mismatch with a clear *"plugin X targets API v2, host provides v4 — see
migration guide."* You don't avoid breakage — you **schedule** it (break on a
major, with a guide) instead of ambushing a lab admin. This is most of the
difference between "frozen forever" and "deprecate on a cadence."

### 3. Instrument deprecations at runtime — turn "guess" into "know"

Wrap a deprecated export in a getter/Proxy that `console.warn`s (and optionally
telemetry-pings) on access: *"`BaseLinearDisplay` is deprecated, removal in vX."*
Ship a few releases; remove with **evidence** instead of archaeology.

- **Blind spot, stated honestly:** telemetry only sees deployments you observe.
  Self-hosted instances — where external plugins are most common — won't report.
  So use telemetry to *accelerate* removal where visible, never as the *gate*.
  The gate is the `@public` boundary (#1).

### 4. Make the blessed extension points good enough that nobody reaches into internals

gdc/icgc/mafviewer compose `BaseLinearDisplay` because there's no stable
high-level "custom server-rendered display" API — so they grab an internal and
freeze it. Every gap RFC-001 closes is one fewer internal leaking into the
permanent ABI. This is the durable long-term answer; #1–#3 are what make the
*transition* safe.

---

## The honest tension

Part of JBrowse's value proposition *is* "plugins can reach deep — compose our
MST models, extend our displays." A maximally-narrow API throws that away. The
goal is **not** lockdown. It is: make the **blessed surface small and stable**,
and make deep-reach an **explicit, marked, may-break opt-in** rather than an
accidental forever-contract. Power for those who knowingly opt in; freedom for
maintainers to refactor everything else. Evaluate RFC-001 through this lens.

---

## The same disease rots the *docs* (and the cure rhymes)

Architecture docs ossify for the identical structural reason the API does: they
encode **incidental current membership** instead of **durable contracts**, and
nothing checks them against the code. `ARCHITECTURE.md` had drifted into claims
like "these four displays are GPU" and "Manhattan composes
`linearWiggleDisplayModelFactory`" — both false by the time they were read.

- **State invariants/rules, not enumerations.** "A display composes one of three
  foundation mixins; here's how to tell which from its `types.compose`" does not
  rot. "These four displays are GPU" does.
- **When you must enumerate, generate the list from source.** The repo already
  does this with `pnpm autogen` for config/state-model docs — extend the
  philosophy. A membership table an agent hand-maintains *will* drift; one
  emitted from `addDisplayType` registrations cannot.
- **Put a machine between the contract and drift** — a test, or an autogenerated
  region — for the claims that matter.

Unifying principle for code and docs alike: **don't let incidental current state
masquerade as an intentional contract, and put a machine between the contract and
drift.**

---

## Worked example: retiring the legacy block stack

This is why the block stack is "maintained indefinitely" — and the path out.

- **Today:** `BaseLinearDisplay` (state model) + the server-side-render block path
  are `@jbrowse/plugin-linear-genome-view` public exports. In-tree only
  `LinearBareDisplay` composes them (and it's the LGV test suite's lightweight
  test vehicle). External `gdc`/`icgc`/`mafviewer` reach
  `LGVPlugin.exports.BaseLinearDisplay` + `BaseLinearDisplayComponent` at runtime.
  `mafviewer` is already superseded in-tree by `plugins/maf`.
- **Why it's stuck:** can't prove no external plugin composes it → can't remove.
- **Path out:** (a) declare `BaseLinearDisplay`/`BaseLinearDisplayComponent`
  `@public` or not; (b) if not, wrap in a runtime deprecation warning to start the
  clock and learn usage; (c) ship a version-gated API so removal lands on a major
  with a migration guide. "Indefinite maintenance" becomes "removed in v4, warned
  since v3." Keep `LinearBareDisplay` in-tree as long as the path lives — it's the
  only in-tree regression coverage for it.

---

## Follow-ups

Smallest-useful-first; none committed — they need a scope decision and probably
belong *inside* RFC-001 §7 rather than bolted beside it.

- [ ] **Name the `@public` set.** Audit each plugin `exports` object +
  `ReExports/list.ts`; tag entries `@public`/`@internal`. Output: a documented
  list. (Design input for RFC-001 §7.)
- [ ] **Snapshot the `@public` set + CI diff.** Minimal (a JSON snapshot + a
  jest diff test), *not* a heavyweight `api-extractor` toolchain — keep it a net
  simplification, not a new thing to maintain.
- [ ] **Runtime deprecation-warning wrapper.** A tiny helper to mark a specific
  export deprecated; apply to gray-area exports like `BaseLinearDisplay` first.
  Ships now, starts learning usage.
- [ ] **API-version declaration + load-time compat check.** Plugins declare a
  target API version; host fails loud on mismatch. Largest piece; depends on
  having a named `@public` set first.
- [ ] **Doc anti-rot.** Convert hand-maintained membership lists in
  `ARCHITECTURE.md` to autogenerated regions (sourced from `addDisplayType`
  registrations) or invariant-style prose; add a drift check for the
  foundation→display mapping.
- [ ] **Confirm RFC-001 `globalExternals` migration** removes new-plugin reliance
  on `getPlugin('X').exports`, then measure how much of the runtime surface is
  *only* reached the legacy way (candidates for the `unstable` namespace).
