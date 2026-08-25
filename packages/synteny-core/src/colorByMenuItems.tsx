import PopoverPicker from '@jbrowse/core/ui/PopoverPicker'

import { COLOR_MODES } from './colorModes.ts'
import { attributeColorBy } from './colorUtils.ts'

import type { SyntenyColorBy } from './colorUtils.ts'
import type { ColorableTrack } from './trackColors.ts'
import type { MenuItem } from '@jbrowse/core/ui'

export interface ColorByMenuTrack {
  trackId: string
  name: string
  /** the mode this track currently draws with */
  colorBy: SyntenyColorBy
  /**
   * whether `colorBy` came from a per-track override rather than the view.
   * Checked state has to key on this, not on whether `colorBy` happens to equal
   * the view's mode — otherwise a track pinned to the mode the view already
   * uses shows both "Use view setting" and that mode checked, and clearing the
   * override changes nothing on screen.
   */
  overridden: boolean
  /** the color it draws under `colorBy: 'track'` */
  trackColor: string
  /** whether that color was pinned by hand rather than taken from the palette */
  pinned: boolean
}

/**
 * #api
 * Project a view carrying `TrackColorsMixin` onto the menu builder's input.
 * Both palette menus were building this by hand, walking the model's tracks a
 * third time (after `colorableTracks` and the legend) and repeating the same
 * five setter lambdas.
 */
export function colorByMenuTargetFor(
  model: TrackColorsModel,
  {
    pointBased,
    showReference,
  }: { pointBased: boolean; showReference: boolean },
): ColorByMenuTarget {
  return {
    uniformColorBy: model.uniformColorBy,
    attributes: model.colorableAttributes,
    tracks: model.colorableTracks.map(({ trackId, name, color }) => ({
      trackId,
      name,
      colorBy: model.resolveColorBy(trackId),
      overridden: model.trackColorBy.has(trackId),
      trackColor: model.trackColorFor(trackId),
      pinned: color !== undefined,
    })),
    pointBased,
    showReference,
    showColorLegend: model.showColorLegend,
    setColorBy: value => {
      model.setColorBy(value)
    },
    setTrackColorBy: (trackId, value) => {
      model.setTrackColorBy(trackId, value)
    },
    setTrackColor: (trackId, value) => {
      model.setTrackColor(trackId, value)
    },
    clearTrackColorSettings: () => {
      model.clearTrackColorSettings()
    },
    setShowColorLegend: value => {
      model.setShowColorLegend(value)
    },
  }
}

// The slice of a TrackColorsMixin-bearing view the adapter reads. Structural
// rather than the concrete view model: dotplot and linear synteny both satisfy
// it, and naming either here would drag a plugin type into this package.
export interface TrackColorsModel {
  colorableTracks: ColorableTrack[]
  colorableAttributes: string[]
  uniformColorBy: SyntenyColorBy | undefined
  showColorLegend: boolean
  trackColorBy: { has: (trackId: string) => boolean }
  resolveColorBy: (trackId: string) => SyntenyColorBy
  trackColorFor: (trackId: string) => string
  setColorBy: (value: SyntenyColorBy) => void
  setTrackColorBy: (trackId: string, value: SyntenyColorBy | undefined) => void
  setTrackColor: (trackId: string, value: string | undefined) => void
  clearTrackColorSettings: () => void
  setShowColorLegend: (value: boolean) => void
}

export interface ColorByMenuTarget {
  /** the view-wide mode, or undefined when tracks disagree */
  uniformColorBy: SyntenyColorBy | undefined
  tracks: ColorByMenuTrack[]
  /**
   * numeric columns the overlaid tracks declare, each offered as its own mode.
   * Taken from the track config rather than from the data so the menu is right
   * before anything has loaded.
   */
  attributes: string[]
  /** dotplots draw flat points and have no 'reference' anchor */
  pointBased: boolean
  /** 'reference' is meaningless below two stacked levels */
  showReference: boolean
  showColorLegend: boolean
  setColorBy: (value: SyntenyColorBy) => void
  setTrackColorBy: (trackId: string, value: SyntenyColorBy | undefined) => void
  setTrackColor: (trackId: string, value: string | undefined) => void
  clearTrackColorSettings: () => void
  setShowColorLegend: (value: boolean) => void
}

// The named presets, then one entry per numeric column the tracks declare.
//
// The second list is why the first one stops growing. A preset earns its name by
// carrying domain knowledge a column name cannot — identity is a fraction, MAPQ
// tops out at 60, dN/dS is read against 1 — and every other measurement is
// reachable without a new enum member, menu entry, legend arm, LUT, typed array
// and RPC transfer slot.
function visibleModes({
  pointBased,
  showReference,
  tracks,
  attributes,
}: ColorByMenuTarget) {
  return [
    ...COLOR_MODES.filter(
      m =>
        (m.value !== 'reference' || showReference) &&
        // one track has nothing to be told apart from
        (m.value !== 'track' || tracks.length > 1),
    ).map(m => ({
      ...m,
      helpText:
        pointBased && m.pointBasedHelpText ? m.pointBasedHelpText : m.helpText,
    })),
    ...attributes.map(attribute => ({
      label: attribute,
      value: attributeColorBy(attribute),
      helpText: `Color by the ${attribute} column this track carries, on a viridis scale spanning the values in view. A relative scale: unlike the named modes above it has no declared domain, so the legend labels it with the actual numbers.`,
    })),
  ]
}

function perTrackSubMenu(
  target: ColorByMenuTarget,
  track: ColorByMenuTrack,
): MenuItem[] {
  return [
    {
      label: 'Use view setting',
      type: 'radio',
      checked: !track.overridden,
      onClick: () => {
        target.setTrackColorBy(track.trackId, undefined)
      },
    },
    { type: 'divider' },
    ...visibleModes(target).map(({ label, value, helpText }) => ({
      label,
      type: 'radio' as const,
      checked: track.overridden && track.colorBy === value,
      helpText,
      onClick: () => {
        target.setTrackColorBy(track.trackId, value)
      },
    })),
    { type: 'divider' },
    {
      label: 'Reset color to automatic',
      disabled: !track.pinned,
      onClick: () => {
        target.setTrackColor(track.trackId, undefined)
      },
    },
  ]
}

/**
 * #api
 * The palette-button menu shared by the dotplot and linear-synteny headers: the
 * view-wide mode radios, a per-track section once more than one track is
 * overlaid, and the legend toggle.
 */
export function colorByMenuItems(target: ColorByMenuTarget): MenuItem[] {
  const { uniformColorBy, tracks, showColorLegend } = target
  const anyOverride = uniformColorBy === undefined || tracks.some(t => t.pinned)
  return [
    ...visibleModes(target).map(({ label, value, helpText }) => ({
      label,
      type: 'radio' as const,
      checked: uniformColorBy === value,
      helpText,
      onClick: () => {
        target.setColorBy(value)
      },
    })),
    ...(tracks.length > 1
      ? [
          { type: 'divider' as const },
          {
            label: 'Customize per track',
            helpText:
              'Advanced: override the setting above for one track at a time. Each track can take its own color-by mode, and its automatic palette color can be pinned to one you choose. Picking any mode above clears these overrides.',
            subMenu: tracks.map(track => ({
              label: track.name,
              subMenu: perTrackSubMenu(target, track),
              // the swatch sits on a submenu row, so its click has to stop
              // short of the row or picking a color also opens the submenu
              endAdornment: (
                <span
                  data-testid={`color_by_track_swatch-${track.trackId}`}
                  onClick={event => {
                    event.stopPropagation()
                  }}
                >
                  <PopoverPicker
                    color={track.trackColor}
                    unset={!track.pinned}
                    onChange={value => {
                      target.setTrackColor(track.trackId, value)
                    }}
                  />
                </span>
              ),
            })),
          },
          {
            label: 'Reset per-track colors',
            disabled: !anyOverride,
            onClick: () => {
              target.clearTrackColorSettings()
            },
          },
        ]
      : []),
    { type: 'divider' },
    {
      label: 'Show color legend',
      type: 'checkbox',
      checked: showColorLegend,
      onClick: () => {
        target.setShowColorLegend(!showColorLegend)
      },
    },
  ]
}
