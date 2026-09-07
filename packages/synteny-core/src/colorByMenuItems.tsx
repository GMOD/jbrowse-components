import PopoverPicker from '@jbrowse/core/ui/PopoverPicker'
import { withHint } from '@jbrowse/core/ui/menuItems'

import { COLOR_MODES, VALUE_MODES_LABEL } from './colorModes.ts'
import { continuousRampConfig } from './colorRamps.ts'
import { attributeColorBy } from './colorUtils.ts'

import type { AttributeRange } from './colorRamps.ts'
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
    attributeRanges: model.attributeRanges,
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
  attributeRanges: Record<string, AttributeRange>
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
  /**
   * the span each channel has been seen to cover. A preset measurement is
   * offered only once the loaded data has carried one value of it: a plain
   * PAF has no dN/dS, and a CIGAR-less one no identity, so the row says so
   * rather than painting every ribbon the missing-data color.
   */
  attributeRanges: Record<string, AttributeRange>
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

interface ModeEntry {
  value: SyntenyColorBy
  label: string
  helpText: string
  disabledHelpText?: string
}

const presetRamps: Record<string, { attribute: string } | undefined> =
  continuousRampConfig

function structuralModes({
  pointBased,
  showReference,
  tracks,
}: ColorByMenuTarget): ModeEntry[] {
  return COLOR_MODES.filter(
    m =>
      m.kind === 'structural' &&
      (m.value !== 'reference' || showReference) &&
      // one track has nothing to be told apart from
      (m.value !== 'track' || tracks.length > 1),
  ).map(m => ({
    value: m.value,
    label: m.label,
    helpText:
      pointBased && m.pointBasedHelpText ? m.pointBasedHelpText : m.helpText,
  }))
}

// The named measurements, then one entry per column the tracks declare. The
// second list is why the first one stops growing: a preset earns its name by
// carrying domain knowledge a column name cannot — identity is a fraction, MAPQ
// tops out at 60, dN/dS is read against 1.
function valueModes({
  attributes,
  attributeRanges,
}: ColorByMenuTarget): ModeEntry[] {
  return [
    ...COLOR_MODES.filter(m => m.kind === 'value').map(m => {
      const channel = presetRamps[m.value]?.attribute
      const seen = channel !== undefined && channel in attributeRanges
      return {
        ...m,
        disabledHelpText: seen
          ? undefined
          : `The loaded alignments carry no ${m.label[0]!.toLowerCase()}${m.label.slice(1)}`,
      }
    }),
    ...attributes.map(attribute => ({
      label: attribute,
      value: attributeColorBy(attribute),
      helpText: `Color by the ${attribute} column this track carries. A numeric column paints a viridis scale spanning the values seen, labelled with the actual numbers since nothing declares its domain. A text column paints one color per distinct label, or the color the file put beside it in a color column.`,
    })),
  ]
}

function radios(
  modes: ModeEntry[],
  isChecked: (value: SyntenyColorBy) => boolean,
  pick: (value: SyntenyColorBy) => void,
): MenuItem[] {
  return modes.map(({ label, value, helpText, disabledHelpText }) => ({
    label,
    type: 'radio' as const,
    checked: isChecked(value),
    helpText,
    disabled: disabledHelpText !== undefined,
    disabledHelpText,
    onClick: () => {
      pick(value)
    },
  }))
}

// The structural radios at the top, then the measurements one hop in. The
// submenu row names the active measurement as its hint, so a value mode still
// reads as picked from the top level.
function modeItems(
  target: ColorByMenuTarget,
  isChecked: (value: SyntenyColorBy) => boolean,
  pick: (value: SyntenyColorBy) => void,
): MenuItem[] {
  const values = valueModes(target)
  return [
    ...radios(structuralModes(target), isChecked, pick),
    {
      label: withHint(
        VALUE_MODES_LABEL,
        values.find(m => isChecked(m.value))?.label,
      ),
      helpText:
        'Paint each alignment by a number it carries, on a color ramp the legend labels.',
      subMenu: radios(values, isChecked, pick),
    },
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
    ...modeItems(
      target,
      value => track.overridden && track.colorBy === value,
      value => {
        target.setTrackColorBy(track.trackId, value)
      },
    ),
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
    ...modeItems(
      target,
      value => uniformColorBy === value,
      value => {
        target.setColorBy(value)
      },
    ),
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
