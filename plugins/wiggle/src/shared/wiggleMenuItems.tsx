import { makePromotableSizeMenu } from '@jbrowse/core/ui'
import { makeRadioSubMenu, radioItems } from '@jbrowse/core/ui/menuItems'
import {
  makeResolutionSubMenuItem,
  makeScatterPointSizeMenuItem,
  makeScoreSubMenu,
} from '@jbrowse/wiggle-core'
import LineWeightIcon from '@mui/icons-material/LineWeight'
import ScatterPlotIcon from '@mui/icons-material/ScatterPlot'
import ShowChartIcon from '@mui/icons-material/ShowChart'

import {
  RESOLUTION_MAX,
  RESOLUTION_MIN,
  RESOLUTION_STEP,
} from './WiggleScoreConfigMixin.ts'
import { isLineMode, isScatterMode } from './wiggleComponentUtils.ts'

import type {
  ConfigModelForFields,
  ResolvableDisplay,
} from '@jbrowse/core/configuration'
import type { MenuItem } from '@jbrowse/core/ui'
import type { ScoreScaleModel } from '@jbrowse/wiggle-core'
import type { ElementType } from 'react'

export function makeRenderingTypeSubMenu(
  self: { renderingType: string; setRenderingType: (t: string) => void },
  renderings: readonly (readonly [string, string])[],
): MenuItem {
  return makeRadioSubMenu({
    label: 'Plot type',
    icon: ShowChartIcon,
    value: self.renderingType,
    onChange: t => {
      self.setRenderingType(t)
    },
    options: renderings,
  })
}

// Multi-wiggle variant: the plot-type cross-product is large, so nest it one
// level by layout (Multi-row / Overlapping) instead of listing every
// combination flat. Each layout group is its own radio submenu sharing the one
// renderingType value.
export function makeGroupedRenderingTypeSubMenu(
  self: { renderingType: string; setRenderingType: (t: string) => void },
  groups: readonly (readonly [
    string,
    readonly (readonly [string, string])[],
  ])[],
): MenuItem {
  return {
    label: 'Plot type',
    icon: ShowChartIcon,
    subMenu: groups.map(([groupLabel, options]) =>
      makeRadioSubMenu({
        label: groupLabel,
        value: self.renderingType,
        onChange: t => {
          self.setRenderingType(t)
        },
        options,
      }),
    ),
  }
}

// A top-level size submenu holding one inline slider row (value + reset + a
// promotable "default for all tracks of this type" pin), present only in the
// rendering types the size applies to: point size in the scatter variants
// ('scatter'/'multirowscatter'/'multiscatter'), line width in the line ones.
// Both are top-level rather than nested under Score because they describe the
// mark, not the axis.
// The row is a thunk so a rendering type that doesn't take the size never
// walks its config slot's promotable cascade to build one it won't show.
function sizeSubMenu(
  applies: boolean,
  label: string,
  icon: ElementType,
  row: () => MenuItem,
): MenuItem[] {
  return applies ? [{ label, icon, subMenu: [row()] }] : []
}

export function makePointSizeSubMenu(
  self: Parameters<typeof makeScatterPointSizeMenuItem>[0],
  { label, applies }: { label: string; applies: boolean },
): MenuItem[] {
  return sizeSubMenu(applies, label, ScatterPlotIcon, () =>
    makeScatterPointSizeMenuItem(self, { label }),
  )
}

export function makePointSizeMenuItems(
  self: { renderingType: string } & Parameters<typeof makePointSizeSubMenu>[0],
): MenuItem[] {
  return makePointSizeSubMenu(self, {
    label: 'Scatter point size',
    // the rendering-type table both backends branch on, not a substring test:
    // whether a plot draws points is the same question the encoder asks
    applies: isScatterMode(self.renderingType),
  })
}

export function makeLineWidthMenuItems(
  self: {
    renderingType: string
    lineWidth: number
    setLineWidth: (n?: number) => void
  } & ResolvableDisplay<
    ConfigModelForFields<{
      lineWidth: { type: 'maybeNumber'; promotedBase: number }
    }>
  >,
): MenuItem[] {
  return sizeSubMenu(
    isLineMode(self.renderingType),
    'Line width',
    LineWeightIcon,
    () =>
      makePromotableSizeMenu({
        label: 'Line width',
        title: 'Line width',
        // integer px with a floor of 1: the default range/step (0.5-12 by 0.5)
        // crowds 1px into a few px at the far-left edge between 0.5 and 1.5, so a
        // mouse drag can't reliably land on it. 1px as the leftmost stop makes it
        // selectable by dragging fully left.
        min: 1,
        max: 10,
        step: 1,
        display: self,
        slot: 'lineWidth',
        getValue: () => self.lineWidth,
        onChange: n => {
          self.setLineWidth(n)
        },
        onReset: () => {
          self.setLineWidth(undefined)
        },
      }),
  )
}

function formatResolution(n: number) {
  return n >= 1 ? `${n}×` : `1/${Math.round(1 / n)}×`
}

interface WithResolution {
  hasResolution: boolean
  resolution: number
  // the resolved mode, so the radio checks what the plot draws rather than a
  // raw slot value density ignores
  effectiveSummaryScoreMode: string
  isDensityMode: boolean
  setResolution: (n: number) => void
  setSummaryScoreMode: (v: string) => void
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
        }),
      ]
    : []
}

const SUMMARY_SCORE_MODES = [
  { value: 'min', label: 'Minimum' },
  { value: 'max', label: 'Maximum' },
  { value: 'avg', label: 'Average' },
  { value: 'whiskers', label: 'Whiskers' },
]

function makeSummaryScoreModeSubMenu(self: WithResolution): MenuItem[] {
  return self.hasResolution
    ? [
        {
          label: 'Summary score mode',
          subMenu: radioItems(
            // density maps score to color rather than height, so it has no
            // whiskers presentation at all — offering it would check a mode
            // that neither the plot nor the score domain uses. The radio
            // instead follows `effectiveSummaryScoreMode`, which is the
            // average a whiskers-configured density track really draws.
            self.isDensityMode
              ? SUMMARY_SCORE_MODES.filter(m => m.value !== 'whiskers')
              : SUMMARY_SCORE_MODES,
            self.effectiveSummaryScoreMode,
            v => {
              self.setSummaryScoreMode(v)
            },
          ),
        },
      ]
    : []
}

// The one Score submenu both wiggle displays build: summary score mode leads
// it, then the shared scale-type / autoscale / min-max rows.
export function makeWiggleScoreSubMenu(
  self: WithResolution & ScoreScaleModel,
): MenuItem {
  return makeScoreSubMenu(self, {
    leadingItems: makeSummaryScoreModeSubMenu(self),
  })
}
