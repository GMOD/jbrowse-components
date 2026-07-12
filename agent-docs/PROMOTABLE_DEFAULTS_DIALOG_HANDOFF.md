# Promotable defaults: manage-default dialog — handoff

Status: shipped on `webgl-poc` (uncommitted-tree work is committed; see SHAs
below). All tests green, `pnpm typecheck` clean, lint clean.

This documents the "make this a default for all tracks of this type" UI that
sits on top of the promotable-slot cascade. For the cascade itself (config slots
marked `promotable: true`, `getConfResolved`, the session store
`get/setDisplayTypeDefault`), see `packages/core/src/configuration/
promotableDefaults.ts` header comment — this doc only covers the control/UI layer
and the one open issue.

## What it does (user-facing)

Every promotable menu row (feature-height presets, track-height mode, colorBy
schemes, soft-clipping, mismatch alpha, read-connection modes, sashimi, canvas
displayMode, wiggle/arc size sliders) has a subtle trailing `⋯` icon
(`MoreHorizIcon`, muted; tints to the accent color only when that value is
currently the default). Clicking it opens the **manage-default dialog**:

- Two independent checkboxes, applied on submit:
  - **Apply to future tracks** — sets (or clears) the session-wide default for
    this display type. New + un-pinned open tracks inherit it via
    `getConfResolved`. Non-destructive.
  - **Apply to currently open tracks** — also updates the open tracks whose
    resolved value differs; the label names the count (`Apply to 3 currently
    open tracks`) and the checkbox disables when nothing differs.
- Staged: nothing changes until Submit. The count is the preview-before-overwrite
  (replaces an undo).

## Commits (chronological; each supersedes the prior)

| SHA | What |
| --- | --- |
| `7e1fa4bda5` | first cut: pin click force-applied to all open tracks (auto-sweep, no undo) |
| `e3ad3431dd` | reworked to opt-in: pin sets default, snackbar offers "Apply to N open tracks" |
| `b128557bf4` | **current design**: pin → subtle `⋯` → manage-default dialog; retired the snackbar |
| `c0d7e5de12` | render test mounting the real dialog over a real MST tree |

The snackbar and auto-sweep iterations are fully replaced; don't resurrect them.

## Architecture

### Control layer — `packages/core/src/configuration/promotableDefaults.ts`

`SessionDefaultControl = { active, toggle, self, entries }`:
- `active` — this exact value is the current default.
- `toggle()` — pure set/clear default (non-destructive, no sweep). Used by the
  model-getter tests and internally; the adornment does NOT call it.
- `self` / `entries` — carried so the UI adornment can open the dialog. `self` is
  the display (a `PromotableDisplay`); `entries` is `{slot, value}[]`.

One builder, three thin factories (unchanged call sites across
alignments/canvas/wiggle/arc):
- `makeSessionDefaultControl(self, slot, onValue)` — one fixed value.
- `makeCurrentValueSessionDefaultControl(self, slots)` — promotes each slot's
  current resolved value (captured at control creation).
- `makeSlotsValueSessionDefaultControl(self, entries)` — a multi-slot preset
  (e.g. featureHeight+featureSpacing+heightMode = "Compact").

Dialog-facing helpers (all exported from the module):
- `isPromotableDefault(self, entries)` — checkbox `checked` state.
- `setPromotableDefault(self, entries, on)` — set/clear the default.
- `tracksDifferingFrom(self, entries)` — open tracks across **all** views
  (`openDisplaysOfType` → `isViewContainer(session).views`) whose resolved value
  differs. Backs the count.
- `applyPromotableDefault(self, entries, { future, openTracks })` — the submit
  action. Matrix:

  | future | openTracks | effect |
  | --- | --- | --- |
  | ✓ | ✗ | set session default only (un-pinned tracks inherit reactively) |
  | ✓ | ✓ | set default + `clearPinsToInherit(differing)` → they un-pin and inherit (track later changes) |
  | ✗ | ✓ | write the value onto each differing open track directly (bake) — works without a persistent default |
  | ✗ | ✗ | clear the session default |

### UI layer — `packages/core/src/ui/`

- `DefaultForAllAdornment.tsx` — the subtle `⋯` button. Takes the whole `control`
  (not `isDefault`/`onToggle`), reads `control.active` for the tint, and on click
  calls `openPromotableDefaultDialog(control, label)`.
- `PromotableDefaultDialog.tsx` — the dialog. Plain component (NOT observer;
  staged local `useState`). Component-only export (fast-refresh lint rule).
- `openPromotableDefaultDialog.ts` — the `queueDialog` helper, split into its own
  file so (a) the dialog file only exports a component and (b) `configuration`
  never imports a React component (that would cycle configuration → ui).
- `promotableMenuItems.tsx` (`promotableToggleItem` / `promotableRadioItem`) and
  `makeSizeMenu.tsx` — pass `control={sessionDefault}` to the adornment.

## Test coverage (three levels)

- `promotableDefaults.test.ts` — helpers over a real MST session/views shim:
  `clearPinsToInherit`, `tracksDifferingFrom`, `applyPromotableDefault` (both
  future+open and open-only), cross-view reach.
- `DefaultForAllAdornment.test.tsx` — the adornment renders + click calls
  `openPromotableDefaultDialog` (mocked).
- `PromotableDefaultDialog.test.tsx` — mounts the **real** dialog over a real
  MST tree and drives checkbox → Submit, asserting real config mutation.
- Consumer menu tests (`showSoftClipping`, `readConnections`, `sashimi`,
  `colorBy`) drive `endAdornment.props.control.toggle()` (they no longer render +
  click the — now dialog-opening — button). Their control stand-ins carry
  `self`/`entries` placeholders (`self: undefined as unknown as
  SessionDefaultControl['self']`, one localized cast each).

## OPEN ISSUE — heightMode grow-exit bake bypass (not fixed; needs a reaction)

Symptom: a track in **grow** mode whose resolved `heightMode` is flipped to
`fixed`/`fit` via the cascade snaps to a **stale `height` slot value** instead of
the grown height it was showing.

Root cause: only `setHeightMode` (the imperative menu action) calls
`bakeGrownHeightOnExit` (bake `grownHeight` into the `height` slot before leaving
grow). In grow mode the layout height comes from `GROW_MAX_HEIGHT`/`grownHeight`
(`plugins/alignments/src/LinearAlignmentsDisplay/model.ts:1118`), never the
`height` slot — the bake exists precisely because grow never writes the slot. Any
resolved-mode exit that does NOT go through `setHeightMode` skips the bake.

There are **multiple** such paths, which is why a targeted sweep patch is
insufficient (it would fix one path and silently leave another broken):
- `clearPinsToInherit` un-pinning a grow-pinned track (the "apply to open tracks"
  path).
- `setPromotableDefault` on its own: setting a non-grow default flips every
  **un-pinned** grow-following track's resolved mode with no bake — no "apply to
  open tracks" required.

Correct fix = make the bake a **reaction** on the resolved `heightMode` so it
fires however the transition happens. That requires **removing** the bake from
`setHeightMode` (else double-bake), and getting the MobX lifecycle right:
- guard on `view.initialized` (grownHeight reads view geometry; before init those
  getters throw by design — see `BaseLinearDisplay/CLAUDE.md`
  `autorunOnReadyView`);
- react to the grow→non-grow transition only (store prev mode);
- no loop (baking `setHeight` writes the `height` slot, which must not re-trigger);
- lands in the shared `HeightModeMixin`
  (`plugins/linear-genome-view/src/BaseLinearDisplay/models/HeightModeMixin.ts`)
  used by BOTH canvas `LinearBasicDisplay` and alignments
  `LinearAlignmentsDisplay`; verify the `fitTargetHeight` readers (alignments,
  canvas baseModel, maf, canvas multirow) aren't perturbed.

Severity: narrow (grow mode + a non-grow default) and self-correcting (a drag or
a mode-switch rebakes). Deferred because the only complete fix touches
load-bearing height-layout code across 4 display types; judged higher risk than
the cosmetic bug. Do it as its own focused change with grow-mode verification,
not folded into the dialog work.

## Minor notes / taste calls (deliberate, revisit if usage shows otherwise)

- The `⋯` icon is intentionally subtle (user request). Tradeoff: it trades
  discoverability for calm — a user may not notice the "set a default" capability.
  If telemetry/feedback shows people can't find it, make it slightly more present
  or add a row-hover hint.
- Dialog wording "Use \"<label>\" as the default" is slightly vague for boolean
  toggles (names the setting, not on/off), because `makeCurrentValueSession
  DefaultControl` promotes "whatever it currently is." Fine, but a per-caller
  value label would read better.
- Submit stays enabled even when it would be a no-op (both boxes match the
  current state). Harmless.

See memory `project-display-type-defaults` for the running history.
