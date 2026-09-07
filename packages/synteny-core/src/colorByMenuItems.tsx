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
 * setter lambdas.
 */
export function colorByMenuTargetFor(
  model: TrackColorsModel,
  {
    pointBased,
    showReference,
  }: { pointBased: boolean; showReference: boolean },
): ColorByMenuTarget {
  return {
    colorBy: model.colorByMode,
    attributes: model.colorableAttributes,
    attributeRanges: model.attributeRanges,
    tracks: model.colorableTracks.map(({ trackId, name, color }) => ({
      trackId,
      name,
      trackColor: model.trackColorFor(trackId),
      pinned: color !== undefined,
    })),
    pointBased,
    showReference,
    setColorBy: value => {
      model.setColorBy(value)
    },
    setTrackColor: (trackId, value) => {
      model.setTrackColor(trackId, value)
    },
    clearTrackColors: () => {
      model.clearTrackColors()
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
  colorByMode: SyntenyColorBy
  trackColorFor: (trackId: string) => string
  setColorBy: (value: SyntenyColorBy) => void
  setTrackColor: (trackId: string, value: string | undefined) => void
  clearTrackColors: () => void
}

export interface ColorByMenuTarget {
  colorBy: SyntenyColorBy
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
  setColorBy: (value: SyntenyColorBy) => void
  setTrackColor: (trackId: string, value: string | undefined) => void
  clearTrackColors: () => void
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

function radios(target: ColorByMenuTarget, modes: ModeEntry[]): MenuItem[] {
  return modes.map(({ label, value, helpText, disabledHelpText }) => ({
    label,
    type: 'radio' as const,
    checked: target.colorBy === value,
    helpText,
    disabled: disabledHelpText !== undefined,
    disabledHelpText,
    onClick: () => {
      target.setColorBy(value)
    },
  }))
}

// One row per overlaid track carrying its palette swatch, so a color can be
// pinned for `colorBy: 'track'`; the row's own submenu is the way back.
function trackColorItems(target: ColorByMenuTarget): MenuItem[] {
  const { tracks } = target
  return [
    {
      label: 'Track colors',
      helpText:
        'The color each track draws in under "Distinct color per track". Pick one with its swatch to pin it; a track without one takes an automatic slot from the palette.',
      subMenu: [
        ...tracks.map(track => ({
          label: track.name,
          subMenu: [
            {
              label: 'Reset color to automatic',
              disabled: !track.pinned,
              onClick: () => {
                target.setTrackColor(track.trackId, undefined)
              },
            },
          ],
          // the swatch sits on a submenu row, so its click has to stop short
          // of the row or picking a color also opens the submenu
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
        { type: 'divider' as const },
        {
          label: 'Reset all to automatic',
          disabled: !tracks.some(t => t.pinned),
          onClick: () => {
            target.clearTrackColors()
          },
        },
      ],
    },
  ]
}

/**
 * #api
 * The palette-button menu shared by the dotplot and linear-synteny headers: the
 * structural mode radios, the measurements one hop in, and the per-track
 * swatches once more than one track is overlaid.
 */
export function colorByMenuItems(target: ColorByMenuTarget): MenuItem[] {
  const { tracks } = target
  const values = valueModes(target)
  return [
    ...radios(target, structuralModes(target)),
    {
      label: withHint(
        VALUE_MODES_LABEL,
        values.find(m => m.value === target.colorBy)?.label,
      ),
      helpText:
        'Paint each alignment by a number it carries, on a color ramp the legend labels.',
      subMenu: radios(target, values),
    },
    ...(tracks.length > 1
      ? [{ type: 'divider' as const }, ...trackColorItems(target)]
      : []),
  ]
}
