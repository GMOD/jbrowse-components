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
  SAME_AS_READS_LABEL,
} from '../../shared/arcColorOptions.ts'
import { radioColorFieldOptions } from '../../shared/colorFieldOptions.ts'
import { colorSchemeOf } from '../../shared/colorSchemes.ts'
import { fieldTag } from '../../shared/facetLabels.ts'
import { bisulfiteItem } from './bisulfiteMenu.ts'
import { modificationsMenu } from './modificationsMenu.ts'

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
  colorField: string
  colorEncoding: AlignmentsColorEncoding
  writtenColor: ColorSlots
  parkedColor?: ColorSlots
  parkColor: (name: string, written: ColorSlots, next: unknown) => void
  colorByField: (field: string) => void
  pickDefaultColor: () => void
  pickSolidColor: () => void
  applyPlot: (draft: Plot) => void
  baseLayer: BaseLayer | undefined
  basesFilter: BasesFilter
  setBases: (patch: BasesPatch) => void
}

// The MM/ML submenu's own surface plus the two readiness flags that decide
// whether it is built at all — read here, in `modificationsItems`, and nowhere
// below.
export interface ModificationsModel extends ModificationsMenuModel {
  modificationsReady: boolean
  regionTooLarge: boolean
}

// A model that may or may not carry the modification fields.
type AnyColorByModel = ColorByModel & Partial<ModificationsModel>

// The modification fields always travel together, so one probe narrows the whole
// group. Only a type guard for callers whose model genuinely lacks them —
// whether a section is *offered* is the caller's explicit opt-in below, never
// inferred from the model's shape. LGVSyntenyDisplay composes the alignments
// state model, so it carries every field a probe could test; sniffing gave it
// the paired-end and bisulfite sections even though a PAF block has no pairs and
// no reads to bisulfite-convert.
function modModel(model: AnyColorByModel): ModificationsModel | undefined {
  return model.modificationsReady === undefined
    ? undefined
    : (model as ModificationsModel)
}

interface ColorByMenuOptions {
  includeTagOption?: boolean
  // Insert size / pair orientation / first-of-pair — meaningful only where reads
  // come in pairs.
  includePairedEnd?: boolean
  // The MM/ML modification submenu plus reference-based bisulfite.
  includeModifications?: boolean
  colorOptions?: ColorFieldOption[]
}

// Derived from the shared COLOR_SCHEMES registry (single source of menu
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
function paintsConstant(model: AnyColorByModel) {
  return model.colorField === '' && model.writtenColor.value !== undefined
}

// A plain radio naming a field: the read fill's, or a per-base layer's. The
// plain fill's '' is unset, a constant included.
function colorRadio(
  model: AnyColorByModel,
  { label, field }: ColorFieldOption,
): MenuItem {
  const layer = baseLayerOfField(field)
  return layer
    ? radioItem(label, model.baseLayer?.field === layer, () => {
        model.setBases({ show: true, field: layer })
      })
    : field === ''
      ? radioItem(
          label,
          model.colorField === '' && !paintsConstant(model),
          () => {
            model.pickDefaultColor()
          },
        )
      : radioItem(label, model.colorField === field, () => {
          model.colorByField(field)
        })
}

// The per-base layer draws over whatever fills the reads, so its radios are a
// group of their own, in a submenu so Color by... ticks one row.
function perBaseItem(
  model: AnyColorByModel,
  options: ColorFieldOption[],
  mods: ModificationsModel | undefined,
): MenuItem {
  return {
    label: 'Per-base coloring',
    type: 'subMenu',
    subMenu: [
      radioItem('None', model.baseLayer === undefined, () => {
        model.setBases({ show: false })
      }),
      ...options.map(o => colorRadio(model, o)),
      ...(mods ? modificationsItems(mods) : []),
    ],
  }
}

function tagColorScaleOf({
  colorField,
  colorEncoding,
}: AnyColorByModel): TagColorScale {
  return colorSchemeOf(colorField) === 'tag' &&
    typeof colorEncoding === 'object' &&
    colorEncoding.scale === 'linear'
    ? 'linear'
    : 'ordinal'
}

// Names the tag in the label once one is picked ("Tag (HP)...") — the radio is
// the only scheme whose choice has a parameter, and it was previously invisible
// without reopening the dialog.
function tagItem(model: AnyColorByModel): MenuItem {
  const { colorField } = model
  const isTag = colorSchemeOf(colorField) === 'tag'
  const tag = fieldTag(colorField)
  return radioItem(
    isTag ? `Tag (${tag ?? colorField})...` : 'Tag...',
    isTag,
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
      // the only row here whose click opens a dialog rather than writing a
      // value, so it dismisses the menu instead of the builder's default of
      // staying open
      keepMenuOpen: false,
    },
  )
}

// Plain scheme radios in a submenu — nothing here reads a modification field, so
// it takes the bare model. Threading the `modModel` probe through it instead
// silently dropped the whole section for a caller that opted in but carries no
// modification state.
function pairedEndItem(model: AnyColorByModel): MenuItem {
  return {
    label: 'Paired end',
    subMenu: pairedEndColorOptions.map(o => colorRadio(model, o)),
  }
}

// The MM/ML "Modifications" submenu shows while types are still loading (unless
// the region is too large to ever detect them) or once any type has loaded; a
// ready display with zero detected types falls through to bisulfite only.
// Bisulfite is reference-based, so it applies to any alignments display
// regardless of MM/ML tags.
//
// It also shows whenever it is the ACTIVE scheme, whatever detection returned.
// Detection is per-fetch volatile state, so a track colored by modifications —
// from a saved session or a config — that lands on a
// region whose reads carry no MM/ML calls otherwise dropped the only row that
// could read as checked, leaving every radio in Color by... blank and no way
// back to the modification settings without first navigating elsewhere.
function modificationsItems(model: ModificationsModel): MenuItem[] {
  const detecting = !model.modificationsReady && !model.regionTooLarge
  const active = model.baseLayer?.field === 'modifications'
  const detected =
    model.modificationsReady && model.detectedModificationTypes.length > 0
  return [
    ...(active || detected ? [modificationsMenu(model)] : []),
    ...(detecting
      ? [{ label: 'Loading modifications...', disabled: true, onClick() {} }]
      : []),
    bisulfiteItem(model),
  ]
}

/** The arcs, read cloud and connectors' own color field, for "Advanced". */
export function getReadConnectionsColorItem(arcColor: {
  own: ArcColorField | undefined
  setField: (field?: ArcColorField) => void
}): MenuItem {
  return {
    label: 'Read connections color',
    type: 'subMenu',
    subMenu: radioItems(
      [
        { value: '' as const, label: SAME_AS_READS_LABEL },
        ...ARC_COLOR_OPTIONS,
      ],
      arcColor.own ?? '',
      field => {
        arcColor.setField(field || undefined)
      },
    ),
  }
}

export function getColorByMenuItem(
  model: AnyColorByModel,
  options: ColorByMenuOptions = {},
) {
  const {
    colorOptions = basicColorOptions,
    includeTagOption,
    includePairedEnd,
    includeModifications,
  } = options
  const mods = includeModifications ? modModel(model) : undefined
  const readOptions = colorOptions.filter(
    o => baseLayerOfField(o.field) === undefined,
  )
  const layerOptions = colorOptions.filter(
    o => baseLayerOfField(o.field) !== undefined,
  )
  return colorByMenuItem({
    blocks: [
      {
        rows: [
          ...readOptions.map(o => colorRadio(model, o)),
          ...(includeTagOption ? [tagItem(model)] : []),
          ...(includePairedEnd ? [pairedEndItem(model)] : []),
          solidColorItem(paintsConstant(model), () => {
            model.pickSolidColor()
          }),
          ...(layerOptions.length > 0 || mods
            ? [perBaseItem(model, layerOptions, mods)]
            : []),
        ],
      },
    ],
  })
}
