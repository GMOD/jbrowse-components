import PopoverPicker from '@jbrowse/core/ui/PopoverPicker'
import { withHint } from '@jbrowse/core/ui/menuItems'

import { COLOR_MODES, VALUE_MODES_LABEL } from './colorModes.ts'
import { presetRamp, resolveCategoricalMode } from './colorRamps.ts'

import type { ColorByMenuTarget } from './colorByMenuTarget.ts'
import type { CategoricalMode } from './colorRamps.ts'
import type { MenuItem } from '@jbrowse/core/ui'

interface ModeEntry {
  value: string
  label: string
  helpText: string
  disabledHelpText?: string
}

const modeOf = new Map(COLOR_MODES.map(mode => [mode.field, mode]))

function structuralRadios({
  structuralFields,
  surface,
}: ColorByMenuTarget): ModeEntry[] {
  return structuralFields.flatMap(value => {
    const mode = modeOf.get(value)
    return mode
      ? [
          {
            value,
            label: mode.label,
            helpText: mode.surfaceHelpText?.[surface] ?? mode.helpText,
          },
        ]
      : []
  })
}

// The named measurements, then one entry per column the tracks declare. The
// second list is why the first one stops growing: a preset earns its name by
// carrying domain knowledge a column name cannot — identity is a fraction, MAPQ
// tops out at 60, dN/dS is read against 1.
function valueModes({
  attributes,
  attributeRanges,
  structuralFields,
}: ColorByMenuTarget): ModeEntry[] {
  const presets = COLOR_MODES.filter(m => m.kind === 'value')
  // one radio per field: a column an aligner happened to name `identity` or
  // `strand` is the preset or the structural radio already listed, since both
  // write the same field
  const named = new Set([...presets.map(m => m.field), ...structuralFields])
  return [
    ...presets.map(m => ({
      value: m.field,
      label: m.label,
      helpText: m.helpText,
      disabledHelpText:
        (presetRamp(m.field)?.attribute ?? m.field) in attributeRanges
          ? undefined
          : `The loaded alignments carry no ${m.label[0]!.toLowerCase()}${m.label.slice(1)}`,
    })),
    ...attributes
      .filter(attribute => !named.has(attribute))
      .map(attribute => ({
        label: attribute,
        value: attribute,
        helpText: `The ${attribute} column: a ramp over the values seen for numbers, a color per label for text.`,
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

// Under a text column: hide the rows it leaves unlabelled, and pin the labels
// seen so far into the domain so each takes a palette color of its own
function categoricalItems(
  target: ColorByMenuTarget,
  { labels }: CategoricalMode,
): MenuItem[] {
  const { colorDomain } = target
  const unpinned = labels.filter(label => !colorDomain.includes(label))
  return [
    {
      label: 'Hide unlabelled rows',
      type: 'checkbox',
      checked: target.hideUnlabelled,
      helpText:
        'Draw only the rows the text column labels, so the groups carry the picture on their own.',
      onClick: () => {
        target.setHideUnlabelled(!target.hideUnlabelled)
      },
    },
    {
      label: 'Pin distinct colors',
      disabled: unpinned.length === 0,
      onClick: () => {
        target.setColorDomain([...colorDomain, ...unpinned])
      },
    },
  ]
}

// One row per overlaid track carrying its palette swatch, so a color can be
// pinned under the `track` field; the row's own submenu is the way back.
function trackColorItems({
  tracks,
  setTrackColor,
  clearTrackColors,
}: NonNullable<ColorByMenuTarget['trackColors']>): MenuItem[] {
  return [
    {
      label: 'Track colors',
      helpText:
        'Pin the color a track draws in under Distinct color per track.',
      subMenu: [
        ...tracks.map(track => ({
          label: track.name,
          subMenu: [
            {
              label: 'Reset color to automatic',
              disabled: !track.pinned,
              onClick: () => {
                setTrackColor(track.trackId, undefined)
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
                  setTrackColor(track.trackId, value)
                }}
              />
            </span>
          ),
        })),
        {
          label: 'Reset all to automatic',
          disabled: !tracks.some(t => t.pinned),
          onClick: () => {
            clearTrackColors()
          },
        },
      ],
    },
  ]
}

/**
 * #api
 * The color-by menu shared by the dotplot and linear-synteny palette buttons
 * and the multi-way synteny track's Color by...: the structural modes the
 * surface paints, the measurements one hop in, the text-column rows while one
 * is painting, and the per-track swatches once more than one track overlays.
 */
export function colorByMenuItems(target: ColorByMenuTarget): MenuItem[] {
  const values = valueModes(target)
  const categorical = resolveCategoricalMode(
    target.colorBy,
    target.attributeRanges,
  )
  const { trackColors } = target
  return [
    ...radios(target, structuralRadios(target)),
    {
      label: withHint(
        VALUE_MODES_LABEL,
        values.find(m => m.value === target.colorBy)?.label,
      ),
      helpText: 'A number each alignment carries, on a ramp the legend labels.',
      subMenu: radios(target, values),
    },
    ...(categorical ? categoricalItems(target, categorical) : []),
    ...(trackColors && trackColors.tracks.length > 1
      ? trackColorItems(trackColors)
      : []),
  ]
}
