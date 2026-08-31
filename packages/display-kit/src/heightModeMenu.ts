import { makePin } from '@jbrowse/core/configuration'
import { promotableRadioItems } from '@jbrowse/core/ui/menuItems'

import { getHeightModeOptions } from './heightMode.ts'

import type { HeightMode } from './heightMode.ts'
import type { HeightModeConfigModel } from './heightModeConfigSchemaFields.ts'
import type {
  AnyConfigurationModel,
  ResolvableDisplay,
} from '@jbrowse/core/configuration'
import type { MenuItem } from '@jbrowse/core/ui'

// The minimal display surface the "Track sizing" radio group drives: the
// resolved mode (for the radio's `checked`), the setter (for `onClick`), and the
// promotable-slot plumbing `makePin` needs for the pin.
//
// `CONF` is a parameter rather than `AnyConfigurationModel` because the pin's
// slot name is only checked against a concrete schema, and each composing
// display brings its own — canvas also pins `displayMode` through a model that
// extends this. The default keeps the mixin's own table for a caller with
// nothing more to pin.
export type HeightModeMenuModel<
  CONF extends AnyConfigurationModel = HeightModeConfigModel,
> = ResolvableDisplay<CONF> & {
  heightMode: HeightMode
  setHeightMode: (mode: HeightMode) => void
}

// The "Track sizing" radio group (fixed/grow/fit), built identically for every
// display that exposes the `heightMode` slot: each radio selects the mode for
// this track, its pin applies that mode to every open track of the display type
// and offers it as that type's default. Sharing the whole builder — not just the
// labels — makes the canvas and alignments menus identical by construction
// rather than by two call sites that happen to agree. `noun` is the singular of
// what the track holds ('feature', 'read').
//
// Callers render these under a "Track sizing" subHeader inside the per-feature
// size menu ("Feature height" / "Read height"), so one menu holds both halves
// of the diametric split: the size radios are how tall each feature is drawn,
// these are how the TRACK responds to more content than fits.
export function heightModeMenuItems<CONF extends AnyConfigurationModel>(
  model: HeightModeMenuModel<CONF>,
  noun: string,
): MenuItem[] {
  // The rows keep the menu open, like every other radio that only writes a
  // setting (`radioItems` states nothing, so `CascadingMenu` decides by type).
  // These render directly below the size presets, which already stay open, so
  // dismissing here made one submenu behave two ways.
  return promotableRadioItems(
    getHeightModeOptions(noun),
    model.heightMode,
    mode => {
      model.setHeightMode(mode)
    },
    // Narrowed to this mixin's own table for the pin rather than to `CONF`: the
    // slot pinned here is `heightModeConfigSchemaFields`' regardless of which
    // display's schema `CONF` is, and every composing display's config extends
    // the base that declares it. `CONF` stays open for the caller's own pins.
    mode => makePin(model as HeightModeMenuModel, 'heightMode', mode),
  )
}
