---
name: promotable-slot-ui
description: Two follow-ons to the shipped promotable-slot cascade that interlock: an admin tier above the session default, and how far the single promotable flag can drive generated UI in the config editor and the track menus. Read both before starting either — the admin tier changes what the UI's checkbox means.
---

# Promotable slots: the two follow-ons

Both hang off the shipped display-type defaults (promotable config slots that
resolve at read time — master doc
[reference/DISPLAY_TYPE_DEFAULTS.md](../reference/DISPLAY_TYPE_DEFAULTS.md)),
and they are filed together because they interlock in one place: an admin tier
makes `resolveSlot.promoted` mean *effective* rather than *the user set this*,
which is the value the generated pin reads. Taking either alone is fine;
taking the second without reading the first is how the pin ends up lying.

## 1. An admin tier above the session default

Today a promoted display-type default is **user-only**: `session.setDisplayTypeDefault` writes `preferencesOverrides`,
persisted to localStorage per browser. There is no way for an admin/embedder to
ship a house default ("all alignments compact by default" baked into
`config.json`). The design's historical note explicitly dropped the admin config
slot when the cascade was simplified to resolve-on-read — this would add it back,
minimally.

**Not a new cascade tier.** `resolveSlot` already delegates its whole middle tier
to one method, `getDisplayTypeDefault(type, slot)`, and doesn't care where the
value comes from. Its sibling `getPreference` four lines above
(`BaseSession.ts:156`) already layers `userOverride ?? getConf(['preferences',
key])`; `getDisplayTypeDefault` (`BaseSession.ts:167`) reads the user map only.
The two sibling preference-readers are asymmetric — this squares them off. The
cascade stays three tiers; the admin fallback lives entirely inside
`getDisplayTypeDefault`.

Three separable pieces:

- **Make it work (~15 lines, 2 files).** Add a `frozen` slot
  `displayTypeDefaults` (nested `type → slot → value`, `defaultValue: {}`,
  `advanced`) to `PreferencesConfigSchemaFactory` (`PreferencesConfig.ts`, next to
  `theme`/`extraThemes`); in `getDisplayTypeDefault` fall back to
  `getConf(self, ['preferences', 'displayTypeDefaults'])` when the user map has no
  entry. Authored via `config.json` JSON, no new UI. **Safety property:** slot
  unset → `getConf` returns `{}` → nested read `undefined` → byte-identical to
  today, so no existing install can regress. `isUsableValue` gates the admin value
  like any promoted value, so a malformed entry degrades to base.
- **Checkbox honesty (small).** `resolveSlot.promoted` would now mean *effective*
  (user-or-admin), and it drives the track-menu "make default" pin's `active`
  (`isSlotValueSessionDefault` / `areSlotsAtSessionDefault`). So with an admin
  default set, the pin reads checked (truthful) but a user un-checking it can't
  clear the admin value and it snaps back — looks stuck. Fix: split
  `SlotResolution` into `promoted` (effective, drives the cascade) vs
  `userPromoted` (raw user map, drives the pin) — one field + one getter.
- **Admin-mode write-back UI (biggest, defer).** Make the existing "make default
  for all tracks" action write the config slot instead of localStorage when
  `session.adminMode` — mirrors track editing (admin → `jbrowse.updateTrackConf`;
  else a delta). Lets admins author by clicking instead of editing JSON.

**Precedence** is user-wins (track pin > user type-default > admin type-default >
base), consistent with `getPreference` and the "user choice wins" decision the
promotable design kept. An admin who wants a *locked* (non-overridable) value is a
separate, larger feature: a `locked` flag, inverted precedence, and greying out
every pin/promote affordance — not this.

## 2. How far the promotable flag drives generated UI

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
