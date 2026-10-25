import { lazy } from 'react'

import { withSubHeader } from '@jbrowse/core/ui/menuItems'
import { getDialogHost } from '@jbrowse/core/util'
import SwapVertIcon from '@mui/icons-material/SwapVert'

import { TAG_FIELD_PREFIX, fieldTag } from '../../shared/facetLabels.ts'
import {
  FACET_DIMENSIONS,
  isReadDimension,
  pickFacetOptions,
} from '../../shared/groupFeatures.ts'
import { groupByRadioMenuItem } from './groupByMenu.ts'

import type {
  ColumnSortField,
  LayoutOrder,
  SortColumn,
  SortSetting,
} from '../../shared/types.ts'
import type { AlignmentsUnit } from '../constants.ts'
import type { GroupByDialogModel } from '../dialogs/GroupByDialog.tsx'
import type { RadioMenuItem } from '@jbrowse/core/ui'

const TagDialog = lazy(() => import('../dialogs/TagDialog.tsx'))
const GroupByDialog = lazy(() => import('../dialogs/GroupByDialog.tsx'))

interface SortMenuModel {
  sortColumn?: SortColumn
  layoutOrder: LayoutOrder
  setSort: (sort: SortSetting) => void
  sortAtCenterLine: (field: ColumnSortField) => void
}

// One `sort` slot, so a single radio group. "Start position" is the unsorted
// default, so it doubles as the reset — no separate "Clear".
//
// Strand / base pair / tag anchor on the center-line column, which
// `sortAtCenterLine` reveals when applied; a sort that never lands (no valid
// center line, a cancelled tag dialog) leaves the slot alone. Interbase types
// from the context menu's "sort at position" keep "Base" checked.
//
// Callers pick the applicable modes and the label noun (like colorFieldOptions):
// alignments takes every mode with 'read'; LGVSyntenyDisplay drops base /
// tag — a PAF block has neither per-base sequence nor SAM tags — and uses
// 'feature'. The noun lands mid-label, so it is held lower-case ("Longest
// reads first", "Spliced reads first", "Split reads first").

export type SortMode =
  | LayoutOrder
  | 'strand'
  | 'base'
  | 'mapq'
  | 'pairOrientation'
  | 'tag'

const ALL_SORT_MODES: SortMode[] = [
  'position',
  'length',
  'spliced',
  'split',
  'svSignal',
  'strand',
  'base',
  'mapq',
  'pairOrientation',
  'tag',
]

// The modes that order the reads by what they hold at the center line, under
// their own sub-header; the rest order the whole pileup.
const CENTER_LINE_MODES = new Set<SortMode>([
  'strand',
  'base',
  'mapq',
  'pairOrientation',
  'tag',
])

function getSortMode(model: SortMenuModel): SortMode {
  const field = model.sortColumn?.field
  return field === undefined
    ? model.layoutOrder
    : fieldTag(field) !== undefined
      ? 'tag'
      : field === 'strand' || field === 'mapq' || field === 'pairOrientation'
        ? field
        : 'base'
}

export function getSortMenuItem(
  model: SortMenuModel,
  opts?: {
    noun?: string
    modes?: SortMode[]
    // Why an ordering can't take effect, or absent when it can — the gate is
    // derived from it rather than passed alongside, so the menu cannot grey out
    // without naming the switch that brings it back. LGVSyntenyDisplay passes
    // only the collapse's reason, which its default of collapsed sections
    // reaches.
    disabledHelpText?: string
  },
) {
  const noun = opts?.noun ?? 'read'
  const modes = opts?.modes ?? ALL_SORT_MODES
  // A stored ordering this menu doesn't offer — a base-pair or tag sort saved
  // against a display that later curated them away (LGVSyntenyDisplay) — falls
  // back to the unsorted default rather than leaving every radio blank, the same
  // rule `checkedType` applies to the group-by radios.
  const stored = getSortMode(model)
  const mode = modes.includes(stored) ? stored : 'position'
  // Name the tag once one is picked ("Tag (HP)..."), like the color menu's tag
  // radio: tag is the only mode whose choice has a parameter, and it was
  // otherwise invisible without reopening the dialog.
  const sortTag = fieldTag(model.sortColumn?.field)
  // Rows that only write an ordering keep the menu open by their radio type;
  // `tag` opens a dialog, so it passes false — the one asymmetry in the group,
  // and the only thing spelled out per row.
  const radio = (
    m: SortMode,
    label: string,
    onClick: () => void,
    keepMenuOpen?: boolean,
  ): RadioMenuItem => ({
    label,
    type: 'radio',
    checked: mode === m,
    keepMenuOpen,
    onClick,
  })
  const items: Record<SortMode, RadioMenuItem> = {
    position: radio('position', 'Start position', () => {
      model.setSort('position')
    }),
    length: radio('length', `Longest ${noun}s first`, () => {
      model.setSort('length')
    }),
    spliced: radio('spliced', `Spliced ${noun}s first`, () => {
      model.setSort('spliced')
    }),
    split: radio('split', `Split ${noun}s first`, () => {
      model.setSort('split')
    }),
    svSignal: radio('svSignal', 'SV evidence first', () => {
      model.setSort('svSignal')
    }),
    strand: radio('strand', 'Strand', () => {
      model.sortAtCenterLine('strand')
    }),
    base: radio('base', 'Base', () => {
      model.sortAtCenterLine('base')
    }),
    mapq: radio('mapq', 'Mapping quality', () => {
      model.sortAtCenterLine('mapq')
    }),
    pairOrientation: radio('pairOrientation', 'Pair orientation', () => {
      model.sortAtCenterLine('pairOrientation')
    }),
    tag: radio(
      'tag',
      sortTag ? `Tag (${sortTag})...` : 'Tag...',
      () => {
        queueSortByTagDialog(model, sortTag, tag => {
          model.sortAtCenterLine(`${TAG_FIELD_PREFIX}${tag}`)
        })
      },
      false,
    ),
  }
  return {
    label: 'Sort by...',
    type: 'subMenu' as const,
    icon: SwapVertIcon,
    disabled: opts?.disabledHelpText !== undefined,
    disabledHelpText: opts?.disabledHelpText,
    subMenu: [
      ...modes.filter(m => !CENTER_LINE_MODES.has(m)).map(m => items[m]),
      ...withSubHeader(
        'At the center line',
        modes.filter(m => CENTER_LINE_MODES.has(m)).map(m => items[m]),
      ),
    ],
  }
}

// Dimensions this display offers: the non-hidden ones, in registry order. A tag
// is added below as a dialog-opener rather than a direct select. Chain mode's
// narrowing is not here — `groupByRadioMenuItem` applies it to whatever it is
// handed, so this display and LGVSyntenyDisplay can't answer it differently.
// Built once, like the synteny menu's own list: the registry is a module
// constant, so a menu open cannot produce a different answer.
const GROUP_OPTIONS = pickFacetOptions(
  ...Object.values(FACET_DIMENSIONS).flatMap(d => (d.hidden ? [] : [d.field])),
)

// The dialog's surface plus what the radios themselves need. The same node is
// passed on to GroupByDialog, so it has to be a superset.
export interface GroupByMenuModel extends GroupByDialogModel {
  unit: AlignmentsUnit
}

// The sort-by-tag dialog both sort surfaces open: the track menu sorts at the
// center line, the read's right-click menu at the clicked column.
export function queueSortByTagDialog(
  host: Parameters<typeof getDialogHost>[0],
  initialTag: string | undefined,
  sort: (tag: string) => void,
) {
  getDialogHost(host).queueDialog(handleClose => [
    TagDialog,
    {
      title: 'Sort by tag',
      prompt: 'Pick or enter a tag to sort by',
      initialTag,
      onSubmit: sort,
      handleClose,
    },
  ])
}

// Every offered dimension selects directly; a tag needs its name (+ optional
// color-by-tag), so it goes last as a dialog-opener — mirroring the sort menu's
// "Tag...". Its radio is the tag prefix, which no field can equal. A hidden
// dimension belongs to another display's menu (mateAssembly is
// LGVSyntenyDisplay's), so a stored one ticks None here.
export function getGroupByMenuItem(model: GroupByMenuModel) {
  const field = model.facet?.field
  const tag = fieldTag(field)
  const hidden =
    field !== undefined &&
    isReadDimension(field) &&
    FACET_DIMENSIONS[field].hidden
  return groupByRadioMenuItem({
    current: tag !== undefined ? TAG_FIELD_PREFIX : hidden ? undefined : field,
    options: GROUP_OPTIONS,
    unit: model.unit,
    onSelect: field => {
      model.facetByField(field)
    },
    onNone: () => {
      model.facetByField('')
    },
    extra: [
      {
        type: TAG_FIELD_PREFIX,
        label: tag ? `Tag (${tag})...` : 'Tag...',
        onClick: () => {
          getDialogHost(model).queueDialog(handleClose => [
            GroupByDialog,
            { model, handleClose },
          ])
        },
      },
    ],
  })
}
