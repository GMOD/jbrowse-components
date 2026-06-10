# Next steps: auditing other model-type families

Status: **planning.** The session-model pass is done (commit `efb249582a`):
extracted `AppSessionMixin` + `AppRootModel` into app-core so desktop and web
stop re-declaring root-delegating getters, fixed a malformed assembly-config
annotation and a `menus` getter-vs-method divergence, and tightened config-type
naming. This doc applies the **same audit lens** to the other model families.

## The lens (what the session pass looked for)

1. **Cross-product duplication / divergence** — the same getter/action
   hand-rewritten in desktop vs web vs react-app, with subtle drift (e.g. desktop
   `get menus()` returned the uncalled root method; web `menus()` called it).
   Fix: extract a shared mixin + a structural contract interface; have the
   product-specific types `extends` the contract.
2. **Config-type sloppiness** — `Instance<typeof xConfigSchema>` inlined instead
   of a named `XConfigModel`; malformed `Instance<Schema[]>`; dead/mis-named
   aliases. Convention now documented in `configuration/types.ts`
   (`XConfigSchema` = IType, `XConfigModel` = `Instance<XConfigSchema>`).
3. **The `self as typeof s & BaseSession` cast** — do **not** try to remove it.
   Proven (see `key_pattern_mst_session_cast_equilibrium` memory) that
   extension-function chains are strictly worse. It's the equilibrium. Audits
   below should *not* relitigate this; it's listed only so nobody re-opens it.

Adjacent workstream, already underway, do not duplicate:
`agent-docs/CONFIG_TYPED_READS_NEXT_STEPS.md` (adapter `BaseAdapter<CONF>` typed
reads — the dense config-read lever lives in adapters, not displays/views).

---

## P1 progress (in flight)

- **desktop** — `_checkDesktopRootModel(m): AppRootModel` assertion added (mirrors
  jbrowse-web's `_checkWebRootModel`). Compiles clean; desktop composes
  `HistoryManagementMixin` + `BaseRootModelFactory` so it satisfies the contract.
- **jbrowse-web** — already enforced via `_checkWebRootModel(m): WebRootModelInterface`
  (and `WebRootModelInterface extends AppRootModel`).
- **react-app — FINDING: its root satisfies NEITHER contract.** It composes
  `BaseRootModelFactory + InternetAccountsRootModelMixin + RootAppMenuMixin` —
  no `HistoryManagementMixin`, and none of the session-DB actions. Yet its session
  is `BaseWebSession`, whose `get root(): WebRootModelInterface` and `AppSessionMixin`
  delegate `history`, `activateSession`, `deleteSavedSession`, `savedSessionMetadata`,
  `setSavedSessionFavorite`, `renameSavedSession` to `self.root.*`. Those 6 members
  do not exist on the react-app root. The unchecked `getParent<WebRootModelInterface>`
  cast in BaseWebSession hides this. react-app works today only because the embedded
  use-case never invokes those session methods (no undo/redo UI, no session manager).
  This is real divergence, not a typing nit — the contract its own session assumes is
  wider than what react-app provides. Adding a compile-time assertion to react-app
  therefore is NOT a free win; it forces a behavior decision (see "react-app options"
  below). Left for a deliberate follow-up.

### react-app options (deferred — needs a decision)

- **A. Harden:** add `HistoryManagementMixin` + no-op/stub the 5 session-DB actions
  so react-app satisfies `WebRootModelInterface`. Fixes latent crashes, adds code/behavior.
- **B. Split the contract:** extract a narrower `BaseWebRootModel` that react-app truly
  satisfies; move the session-DB surface into a jbrowse-web-only mixin that BaseWebSession
  composes conditionally. Architecturally cleaner (mirrors react-app being a reduced root)
  but a real refactor touching BaseWebSession.
- **C. Document only:** leave as-is, record the gap. Lowest risk.

## P1 — Root models (highest value; directly parallel)

`products/{desktop,web,react-app}/src/rootModel/rootModel.ts` (320 / 496 / 207
lines) all compose the same shared mixins (`BaseRootModelFactory`,
`HistoryManagementMixin`, `RootAppMenuMixin`, `InternetAccountsRootModelMixin`)
and each hand-defines `version`, `menus()`, `setSession`-driven session
management. This is the exact shape the session pass just fixed, one level up.

**Look for:**
- `menus()` defined in all three (desktop:174, web:289, react-app:137). Decide
  what is genuinely product-specific (File-menu contents differ) vs shared
  scaffolding that could move to `RootAppMenuMixin` or a builder.
- Session-management actions (`activateSession`, `setSession`, duplicate/snapshot
  flows) — overlap between web and react-app especially (both are "web" roots;
  react-app has no `BaseWebRoot` equivalent the way sessions have `BaseWebSession`).
- `AppRootModel` (app-core, added this pass) is the contract the session layer
  needs but is **not yet structurally enforced** on the concrete roots — only
  `WebRootModelInterface extends AppRootModel`. Consider a `z()`-style assertion
  (like the session models use for `AbstractSessionModel`) so each product root
  is checked against `AppRootModel` at compile time.

**Payoff:** large — biggest remaining duplication surface, and a `BaseWebRoot`
(mirroring `BaseWebSession`) could collapse web+react-app roots.
**Risk:** high — roots own RPC manager, assembly manager, session lifecycle, and
plugin/worker teardown (`key_pattern_pluginmanager_teardown`). Behavior-preserving
only; cover with `rootModel.test` + a build/load smoke before landing.
**First step:** diff web vs react-app root line-by-line; tag each member shared /
divergent / product-only. Decide `BaseWebRoot` vs targeted mixin.

## P2 — Config models (`createConfigModel`)

`packages/product-core/src/RootModel/createConfigModel.ts` plus the two react
products' `createModel/createConfigModel.ts`. App-core's `JBrowseModel` is the
shared piece (`JBrowseModelParent` typed-parent already landed per memory).

**Look for:** inconsistent typed-parent reach (`getParent<any>` vs the typed
`JBrowseModelParent`); per-product config getters that could share a contract;
config-typing convention adherence (named `…ConfigModel` aliases).
**Payoff:** medium. **Risk:** medium (config hydration is load-bearing — see
`configuration/CLAUDE.md` on frozen tracks + `ConfigurationReference`).

## P3 — View models

`plugins/*/src/*View/model.ts` (LinearGenomeView, CircularView, DotplotView,
LinearComparative/Synteny, BreakpointSplit, SvInspector). These are plugin-level
(shared across products), so **not** a duplication target — audit angle differs:
- The `as typeof s & ...` cast population is 19 files repo-wide; confirm each is
  the sanctioned BaseSession/Root equilibrium and not masking a real type gap.
- "Keep the main model chain in one file" (root `CLAUDE.md`) — flag any view that
  split `.views()`/`.actions()` chains across files.
**Payoff:** low–medium (consistency, not dedup). **Risk:** low if read-only audit.

## P4 — Display models, connections, internet accounts, widgets

- **Displays:** config-typed-reads is a **known dead end** here
  (`getConfWithOverride<T>` bypasses typed `getConf`; see the config doc). The
  real audit is the **override-field naming convention** (`<name>Override` stored
  field, bare `<name>` getter — root `CLAUDE.md`). ~28 files touch
  `getConfWithOverride`/`Override`; spot-check for `<name>Setting` getters or
  opaque field names that violate it.
- **Connections / InternetAccounts / Widgets:** smaller surface. Check for a
  shared contract interface (like `AppRootModel`) where products re-declare, and
  named `…ConfigModel` aliases. Low priority.

---

## Suggested order

1. **P1 root models** — same lens, one level up, biggest payoff. Start with the
   web vs react-app diff and the `AppRootModel` compile-time assertion (cheap win
   that hardens what this pass already built).
2. **P2 config models** — small, bounded, complements P1.
3. **P3/P4** — opportunistic consistency audits; do alongside other work in those
   files rather than as a standalone sweep.

Each should be behavior-preserving, gated on `tsgo` + scoped `pnpm test <dir>` +
(for P1/P2) a build/load smoke, and committed file-explicitly (the worktree is
shared — never `git add -A`).
