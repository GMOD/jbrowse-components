import { readConfObject } from '@jbrowse/core/configuration'
import { radioItem, radioItems, toggleItem } from '@jbrowse/core/ui/menuItems'
import { rowFieldValue } from '@jbrowse/tree-sidebar'
import {
  makeMarkSizeSubMenu,
  makeResolutionSubMenuItem,
} from '@jbrowse/wiggle-core/chrome'
import { isSummaryField } from '@jbrowse/wiggle-core/summaryFields'
import LineWeightIcon from '@mui/icons-material/LineWeight'
import ShowChartIcon from '@mui/icons-material/ShowChart'

import {
  RESOLUTION_MAX,
  RESOLUTION_MIN,
  RESOLUTION_STEP,
} from './resolution.ts'
import { isLineMode, isScatterMode } from './wiggleComponentUtils.ts'
import { groupsSources } from './wiggleRowGroups.ts'

import type {
  LineInterpolation,
  WiggleMark,
  WiggleMarkObject,
  WiggleRendering,
} from '../renderingTypes.ts'
import type { WiggleConfigModel } from './wiggleConfigSchemaFields.ts'
import type { MenuItem } from '@jbrowse/core/ui'
import type { RadioOption } from '@jbrowse/core/ui/menuItems'
import type { Extent } from '@jbrowse/wiggle-core'
import type { SummaryField } from '@jbrowse/wiggle-core/summaryFields'

// The layouts a Plot type leaf picks, as the `rows.field` each writes: a row
// per source, a row per value of the grouping field where there is one (the
// field in force, else the one last drawn, else a subadapter `group` the
// sources carry), one shared box. Offering the grouping field beside the other two means a click
// on `Multi-row` is a choice the reader sees, never a silent loss of it.
function plotLayouts(
  rowsField: string,
  lastGroupingField: string,
  rows: readonly object[],
) {
  const grouping = groupsSources(rowsField)
    ? rowsField
    : lastGroupingField !== ''
      ? lastGroupingField
      : rows.some(row => rowFieldValue(row, 'group') !== '')
        ? 'group'
        : undefined
  return [
    ['source', 'Multi-row'],
    ...(grouping ? [[grouping, `Rows by ${grouping}`] as const] : []),
    ['', 'Overlapping'],
  ] as const
}

// The plot and the layout, picked in one click: a group per layout, the same
// five plots inside each. Flat five plots plus a "One row per source" checkbox
// is the same two facts in two controls, which taxes the first choice —
// "multi-row bar plot" is one thought — to untax later ones.
//
// Ten leaves, where the pre-ADR-143 menu had nine: it omitted overlapping
// density, which the merged display draws (one density plot, no left axis —
// `prefersOffset`). A menu change is the wrong place to retire a rendering.
export function makeRenderingTypeSubMenu(
  self: {
    renderingType: WiggleRendering
    setMark: (mark: WiggleMark, interpolate?: LineInterpolation) => void
    isRowLayout: boolean
    rowsField: string
    lastGroupingField: string
    setPlot: (plot: { mark: WiggleMarkObject; rowsField: string }) => void
    discoveredRows: readonly object[]
  },
  plots: readonly (readonly [WiggleRendering, WiggleMarkObject, string])[],
): MenuItem {
  // One source has no layout axis to drill through, so it meets the five plots
  // flat. It also cannot go on rows usefully — a lone row raises the tree and
  // row-label items over a dendrogram that can never draw, since clustering
  // refuses a single row. Grouped while on rows, so a track whose sources
  // dropped to one can still get back to one box.
  if (!self.isRowLayout && self.discoveredRows.length <= 1) {
    return {
      label: 'Plot type',
      icon: ShowChartIcon,
      subMenu: plots.map(([rendering, mark, label]) =>
        radioItem(label, self.renderingType === rendering, () => {
          self.setMark(mark.type, mark.interpolate)
        }),
      ),
    }
  }
  return {
    label: 'Plot type',
    icon: ShowChartIcon,
    subMenu: plotLayouts(
      self.rowsField,
      self.lastGroupingField,
      self.discoveredRows,
    ).map(([rowsField, layoutLabel]) => ({
      label: layoutLabel,
      subMenu: plots.map(([rendering, mark, label]) =>
        radioItem(
          label,
          self.rowsField === rowsField && self.renderingType === rendering,
          () => {
            self.setPlot({ mark, rowsField })
          },
        ),
      ),
    })),
  }
}

export function makeMarkSizeMenuItems(self: {
  renderingType: WiggleRendering
  size: number
  lineWidth: number
  setPointSize: (n?: number) => void
  setStrokeWidth: (n?: number) => void
  configuration: WiggleConfigModel
}): MenuItem[] {
  const unset = (channel: 'size' | 'strokeWidth') =>
    readConfObject(self.configuration, ['encoding', channel, 'value']) ===
    undefined
  return isLineMode(self.renderingType)
    ? makeMarkSizeSubMenu({
        label: 'Line width',
        title: 'Line width',
        icon: LineWeightIcon,
        applies: true,
        value: () => self.lineWidth,
        isDefault: unset('strokeWidth'),
        set: n => {
          self.setStrokeWidth(n)
        },
        min: 1,
        max: 10,
        step: 1,
      })
    : makeMarkSizeSubMenu({
        label: 'Point size',
        applies: isScatterMode(self.renderingType),
        value: () => self.size,
        isDefault: unset('size'),
        set: n => {
          self.setPointSize(n)
        },
      })
}

function formatResolution(n: number) {
  return n >= 1 ? `${n}×` : `1/${Math.round(1 / n)}×`
}

interface WithResolution {
  hasResolution: boolean
  resolution: number
  yField: string
  extent: Extent
  isDensityMode: boolean
  setResolution: (n: number) => void
  setY: (field: string) => void
  setExtent: (v: Extent) => void
}

// Resolution is a multiplier on the number of bins fetched (higher = finer),
// stepped multiplicatively by 2 with a default of 1. It lives at the top level
// of the track menu (not nested under Score) for discoverability, and renders
// inline so the user can step finer/coarser repeatedly without reopening the
// menu each click. Bounds are setResolution's own clamp, so the buttons disable
// at the edges instead of silently no-op'ing.
export function makeResolutionSubMenu(self: WithResolution): MenuItem[] {
  return self.hasResolution
    ? [
        makeResolutionSubMenuItem({
          getState: () => ({
            label: formatResolution(self.resolution),
            finerDisabled: self.resolution >= RESOLUTION_MAX,
            coarserDisabled: self.resolution <= RESOLUTION_MIN,
            resetDisabled: self.resolution === 1,
          }),
          onFiner: () => {
            self.setResolution(self.resolution * RESOLUTION_STEP)
          },
          onCoarser: () => {
            self.setResolution(self.resolution / RESOLUTION_STEP)
          },
          onReset: () => {
            self.setResolution(1)
          },
          trailingItems: isSummaryField(self.yField)
            ? [makeSummaryItem(self)]
            : [],
        }),
      ]
    : []
}

const SUMMARY_OPTIONS: RadioOption<SummaryField>[] = [
  { value: 'minScore', label: 'Minimum' },
  { value: 'maxScore', label: 'Maximum' },
  { value: 'score', label: 'Mean' },
]

// In the Resolution submenu: both say how the fetched bins are read, and both
// exist only where the adapter serves bins. The radio writes `y`, so it shows
// only while `y` names a stored summary, and a click never replaces a field
// the config chose. Density maps score to color and draws no min and max, so
// it offers no extent.
function makeSummaryItem(self: WithResolution): MenuItem {
  return {
    label: 'Bin summary',
    subMenu: [
      ...radioItems(SUMMARY_OPTIONS, self.yField, v => {
        self.setY(v)
      }),
      ...(self.isDensityMode
        ? []
        : [
            toggleItem('Show min and max', self.extent === 'min-max', on => {
              self.setExtent(on ? 'min-max' : 'none')
            }),
          ]),
    ],
  }
}
