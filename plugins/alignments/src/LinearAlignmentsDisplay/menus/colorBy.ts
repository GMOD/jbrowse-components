import { lazy } from 'react'

import { radioItem, radioItems } from '@jbrowse/core/ui/menuItems'
import { getDialogHost } from '@jbrowse/core/util'
import {
  colorByMenuItem,
  solidColorItem,
} from '@jbrowse/display-kit/colorByMenu'

import { baseLayerOfField, tagColorFor } from '../../shared/alignmentsColor.ts'
import {
  ARC_COLOR_OPTIONS,
  DEFAULT_ARC_COLOR_FIELD,
  SAME_AS_READS_LABEL,
  isArcColorField,
} from '../../shared/arcColorOptions.ts'
import { colorFieldKindOf } from '../../shared/colorFieldDefs.ts'
import { radioColorFieldOptions } from '../../shared/colorFieldOptions.ts'
import { fieldTag } from '../../shared/facetLabels.ts'
import { MODIFICATIONS_LABEL } from './baseLayerLabels.ts'
import { bisulfiteRadio } from './bisulfiteMenu.ts'
import {
  cytosineContextItems,
  modificationsRadio,
  unmodifiedInBlueItems,
} from './modificationsMenu.ts'

import type { AlignmentsColorEncoding } from '../../shared/alignmentsColor.ts'
import type { ColorFieldOption } from '../../shared/colorFieldOptions.ts'
import type {
  ArcColorField,
  BaseLayer,
  BasesFilter,
  BasesPatch,
  TagColorScale,
} from '../../shared/types.ts'
import type { ModificationsMenuModel } from './modificationsMenu.ts'
import type { Plot } from '@jbrowse/core/configuration'
import type { MenuItem } from '@jbrowse/core/ui'
import type { ColorSlots } from '@jbrowse/core/util/colorScale'

const TagDialog = lazy(() => import('../dialogs/TagDialog.tsx'))

interface ColorByModel {
  colorField: string | undefined
  colorEncoding: AlignmentsColorEncoding
  writtenColor: ColorSlots
  parkedColor?: ColorSlots
  parkColor: (name: string, written: ColorSlots, next: unknown) => void
  colorByField: (field: string | undefined) => void
  pickDefaultColor: () => void
  pickSolidColor: () => void
  applyPlot: (draft: Plot) => void
  baseLayer: BaseLayer | undefined
  basesFilter: BasesFilter
  setBases: (patch: BasesPatch) => void
}

// The MM/ML radios' own surface plus the two readiness flags that decide
// whether they are built at all, read here in `modificationsItems`.
export interface ModificationsModel extends ModificationsMenuModel {
  modificationsReady: boolean
  regionTooLarge: boolean
}

/** A display of reads, which carries a tag, a pair and per-base calls. */
export type ReadsColorByModel = ColorByModel & ModificationsModel

// Derived from the shared COLOR_FIELD_DEFS registry (single source of menu
// placement + shader path), in registry order so the menu is unchanged.
const basicColorOptions = radioColorFieldOptions('basic')
const pairedEndColorOptions = radioColorFieldOptions('pairedEnd')

// --- menu sections ----------------------------------------------------------
//
// Each builder returns its item(s) and nothing else — whether a section is
// OFFERED is decided once, visibly, in the `subMenu` list at the bottom. The
// builders used to take the caller's `include` flag as an extra parameter,
// which spread one caller decision across six signatures and hid the opt-in
// list the file's comments keep describing.

// A constant paints the reads while no field does
function paintsConstant(model: ColorByModel) {
  return (
    model.colorField === undefined && model.writtenColor.value !== undefined
  )
}

// A plain radio naming a field: the read fill's, or a per-base layer's. The
// plain fill's radio names none.
function colorRadio(
  model: ColorByModel,
  { label, field }: ColorFieldOption,
): MenuItem {
  const layer = baseLayerOfField(field)
  return layer
    ? radioItem(label, model.baseLayer?.field === layer, () => {
        model.setBases({ show: true, field: layer })
      })
    : field === undefined
      ? radioItem(
          label,
          model.colorField === undefined && !paintsConstant(model),
          () => {
            model.pickDefaultColor()
          },
        )
      : radioItem(label, model.colorField === field, () => {
          model.colorByField(field)
        })
}

// The per-base layer draws over whatever fills the reads, so its radios are a
// group of their own under a sub-header, with None as the way off (ADR-149).
function baseLayerItems(
  model: ColorByModel,
  options: ColorFieldOption[],
  mods: ModificationsModel | undefined,
): MenuItem[] {
  return options.length > 0 || mods
    ? [
        radioItem('None', model.baseLayer === undefined, () => {
          model.setBases({ show: false })
        }),
        ...options.map(o => colorRadio(model, o)),
        ...(mods ? modificationsItems(mods) : []),
      ]
    : []
}

function tagColorScaleOf({
  colorField,
  colorEncoding,
}: ColorByModel): TagColorScale {
  return colorFieldKindOf(colorField) === 'tag' &&
    typeof colorEncoding === 'object' &&
    colorEncoding.scale === 'linear'
    ? 'linear'
    : 'ordinal'
}

// A field only a config names (an attribute, `mateAssembly`, a `jexl:`
// expression, a preset or tag this menu does not offer) ticks none of `rows`,
// so it gets a checked, disabled row of its own, as Group by's does.
function unlistedFieldItems(model: ColorByModel, rows: MenuItem[]): MenuItem[] {
  const { colorField } = model
  return colorField !== undefined &&
    !rows.some(row => 'checked' in row && row.checked)
    ? [
        radioItem(colorField, true, () => {}, {
          disabled: true,
          disabledHelpText: "Set in the track's config",
        }),
      ]
    : []
}

// The dialog opens on the tag in use, so the label names no tag.
function tagItem(model: ColorByModel): MenuItem {
  const tag = fieldTag(model.colorField)
  return radioItem(
    'Tag...',
    tag !== undefined,
    () => {
      getDialogHost(model).queueDialog((handleClose: () => void) => [
        TagDialog,
        {
          title: 'Color by tag',
          prompt: 'Pick or enter a tag to color by:',
          initialTag: tag,
          colorScale: tagColorScaleOf(model),
          onSubmit: (tag: string, scale: TagColorScale | undefined) => {
            const color = tagColorFor(
              model.writtenColor,
              tag,
              scale ?? 'ordinal',
              model.parkedColor,
            )
            model.parkColor('color', model.writtenColor, color)
            model.applyPlot({ encoding: { color } })
          },
          handleClose,
        },
      ])
    },
    {
      // its click opens a dialog rather than writing a value, so it dismisses
      // the menu instead of the builder's default of staying open
      keepMenuOpen: false,
    },
  )
}

// The Modifications radio shows once any type has loaded, greyed out while
// types are still loading (unless the region is too large to ever detect
// them); a ready display with zero detected types offers bisulfite only, which
// is reference-based and needs no MM/ML tags.
//
// It also shows whenever modifications is the ACTIVE field, whatever
// detection returned. Detection is per-fetch volatile state, so a track
// colored by modifications that lands on a region whose reads carry no MM/ML
// calls otherwise dropped the only row that could read as checked.
function modificationsItems(model: ModificationsModel): MenuItem[] {
  const detecting = !model.modificationsReady && !model.regionTooLarge
  const active = model.baseLayer?.field === 'modifications'
  const detected =
    model.modificationsReady && model.detectedModificationTypes.length > 0
  return [
    ...(active || detected
      ? [modificationsRadio(model)]
      : detecting
        ? [
            {
              label: MODIFICATIONS_LABEL,
              type: 'radio' as const,
              checked: false,
              disabled: true,
              disabledHelpText: 'Looking for modification calls in the reads',
              onClick() {},
            },
          ]
        : []),
    bisulfiteRadio(model),
    ...unmodifiedInBlueItems(model),
    ...cytosineContextItems(model),
  ]
}

/** The arcs, read cloud and connectors' own color field, for "Advanced". */
// "Same as reads" only while the reads paint a field an arc can; under any
// other read fill an unset field draws the default, so that radio is ticked.
export function getReadConnectionsColorItem(arcColor: {
  own: ArcColorField | undefined
  readField: string | undefined
  setField: (field?: ArcColorField) => void
}): MenuItem {
  const followsReads = isArcColorField(arcColor.readField)
  const rows: readonly { value: ArcColorField | ''; label: string }[] =
    followsReads
      ? [{ value: '', label: SAME_AS_READS_LABEL }, ...ARC_COLOR_OPTIONS]
      : ARC_COLOR_OPTIONS
  return {
    label: 'Read connections color',
    type: 'subMenu',
    subMenu: radioItems(
      rows,
      arcColor.own ?? (followsReads ? '' : DEFAULT_ARC_COLOR_FIELD),
      field => {
        arcColor.setField(field || undefined)
      },
    ),
  }
}

/**
 * Color by for a display of reads: the basic fields, a tag, the paired-end
 * colorings and the modification and bisulfite layers.
 */
export function getReadsColorByMenuItem(model: ReadsColorByModel) {
  return colorByItem(model, basicColorOptions, model)
}

/**
 * Color by over `colorOptions` alone, with nothing only reads carry:
 * LGVSyntenyDisplay composes the alignments state model, and a PAF block has
 * no pairs, tags or basecaller calls.
 */
export function getColorByMenuItem(
  model: ColorByModel,
  {
    colorOptions = basicColorOptions,
  }: { colorOptions?: ColorFieldOption[] } = {},
) {
  return colorByItem(model, colorOptions, undefined)
}

function colorByItem(
  model: ColorByModel,
  colorOptions: ColorFieldOption[],
  reads: ModificationsModel | undefined,
) {
  const readOptions = colorOptions.filter(
    o => baseLayerOfField(o.field) === undefined,
  )
  const layerOptions = colorOptions.filter(
    o => baseLayerOfField(o.field) !== undefined,
  )
  const fillRows = [
    ...readOptions.map(o => colorRadio(model, o)),
    ...(reads ? [tagItem(model)] : []),
  ]
  const pairedRows = reads
    ? pairedEndColorOptions
        .filter(o => !o.whileActive || model.colorField === o.field)
        .map(o => colorRadio(model, o))
    : []
  return colorByMenuItem({
    blocks: [
      {
        rows: [
          ...fillRows,
          ...unlistedFieldItems(model, [...fillRows, ...pairedRows]),
          solidColorItem(paintsConstant(model), () => {
            model.pickSolidColor()
          }),
        ],
      },
      // the read fill again, so its radios tick one at a time with the rows
      // above
      { header: 'Paired end', rows: pairedRows },
      {
        header: 'Per-base coloring',
        rows: baseLayerItems(model, layerOptions, reads),
      },
    ],
  })
}
