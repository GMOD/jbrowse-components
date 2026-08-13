---
name: admin-tier-display-defaults
description: An admin tier above the session default in the promotable-slot cascade, and the three frictions to read before starting.
---

# Admin tier for promotable display-type defaults

Today a promoted display-type default (see `DISPLAY_TYPE_DEFAULTS.md`) is
**user-only**: `session.setDisplayTypeDefault` writes `preferencesOverrides`,
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
