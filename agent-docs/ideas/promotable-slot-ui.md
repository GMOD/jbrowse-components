---
name: promotable-slot-ui
description: How far a single promotable flag can drive generated UI in the config editor and the track menus.
---

# Promotable-slot UI (config editor + track menus)

Follow-on to the shipped display-type defaults (promotable config slots that
resolve at read time — master doc `agent-docs/reference/DISPLAY_TYPE_DEFAULTS.md`): how far
the single promotable flag can drive UI generation, and where it can't.

**What the earlier sketch got wrong.** `ConfigurationEditorWidget.target` is not
the live display model — it's either `track.configuration` or a temporary MST
config `trackSchema.create(...)` (`DrawerWidgets.ts:184`), and edits are
debounce-saved back as a `trackConfigDeltas` diff, not a live mutation. Three
consequences:

- The node can be **detached**, so `getSession(node)` inside `makeSlotFacade` can
  throw. Session has to be threaded from the widget (which can reach it, as its
  own debounce autorun proves) — prop-drilling/context, not a tidy SlotFacade
  field.
- **Two persistence axes in one form.** The value editor writes a per-track
  delta; a promotion checkbox writes a session-wide preference. Mixing them in
  one panel is conceptually muddy — workable, but not the clean "it's just more
  chrome like the jexl toggle" story.
- **Raw stripped values diverge from what's rendered.** An un-pinned track has
  the slot stripped, so `slot.value` is the default (or the `'inherit'`
  sentinel), while the track visually renders the active session default
  (Compact). So the editor would show `displayMode: 'inherit'` on a track that's
  drawing Compact. The "inheriting…" caption papers over it, but the
  raw-vs-resolved gap is real, and worst exactly for the sentinel slots.

**Calibrated confidence.**

- Metadata-driven, single promotable flag feeds the UI (~85%): architecturally
  sound; the badge already proves zero-per-slot enumeration works.
- Track-menu auto-generation via the mixin (~80%): operates on the live display
  model, where `resolveSlot`/`getConf` already work correctly and
  reactively. The safe generalization.
- Config-editor GUI as a clean drop-in (~40%): feasible, but it's the three
  frictions above — detached target, two persistence axes, raw-vs-resolved
  display — not a small SlotEditor addition.

Unmeasured, and gating: the field-wise slot surface (how many existing
subclasses override only `inherit`/`base`/`advanced`/`description` — unknown,
potentially wide) and the test surface (`displayMode`/`showSoftClipping`
overrides).

**Recommendation.** Do the mixin-driven track-menu auto-generation first — the
high-confidence generalization, running where the resolver already behaves, which
gets per-slot cost down to a schema line without touching the editor's
delta/detached-target problem. Treat the config-editor control as a separate,
later spike, and only after deciding how raw-vs-resolved and the two-axes mixing
should read — that's a UX call, not just code.
