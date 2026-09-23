import { getSlotDefinition } from '@jbrowse/core/configuration'
import { makeSizeMenu } from '@jbrowse/core/ui'
import { makeRadioSubMenu, radioItems } from '@jbrowse/core/ui/menuItems'
import { makeScoreSubMenu } from '@jbrowse/wiggle-core'
import {
  makePointSizeSubMenu,
  makeResolutionSubMenuItem,
  scatterPointSizeAccess,
} from '@jbrowse/wiggle-core/chrome'
import LineWeightIcon from '@mui/icons-material/LineWeight'
import ShowChartIcon from '@mui/icons-material/ShowChart'

import {
  RESOLUTION_MAX,
  RESOLUTION_MIN,
  RESOLUTION_STEP,
} from './WiggleCommonMixin.ts'
import { isLineMode, isScatterMode } from './wiggleComponentUtils.ts'

import type { ConfigModelForFields } from '@jbrowse/core/configuration'
import type { MenuItem } from '@jbrowse/core/ui'
import type { AutoscaleModel, ScoreScaleModel } from '@jbrowse/wiggle-core'

const LAYOUTS = [
  ['rows', 'Multi-row'],
  ['overlay', 'Overlapping'],
] as const

// `<layout>:<renderingType>`, and MENU-LOCAL. The model still holds the two
// axes apart — five `renderingType` names that say what a source is drawn as,
// `rows` that says where it sits — and nothing outside this file reads a key
// (plugins/wiggle/CLAUDE.md, ADR-143). Reviving the nine names as config values
// is what put the layout back inside a plot name, where `isOverlayMode` had to
// recover it by string-set membership.
const leafKey = (layout: string, rendering: string) => `${layout}:${rendering}`

// The plot and the layout, picked in one click: a group per layout, the same
// five plots inside each. Flat five plots plus a "One row per source" checkbox
// is the same two facts in two controls, which taxes the first choice —
// "multi-row XY plot" is one thought — to untax later ones.
//
// Ten leaves, where the pre-ADR-143 menu had nine: it omitted overlapping
// density, which the merged display draws (one density plot, no left axis —
// `prefersOffset`). A menu change is the wrong place to retire a rendering.
export function makeRenderingTypeSubMenu(
  self: {
    renderingType: string
    setRenderingType: (t: string) => void
    isRowLayout: boolean
    setRowLayout: (on: boolean) => void
    discoveredRows: readonly unknown[]
  },
  renderings: readonly (readonly [string, string])[],
): MenuItem {
  // One source has no layout axis to drill through, so it meets the five plots
  // flat. It also cannot go on rows usefully — a lone row raises the tree and
  // row-label items over a dendrogram that can never draw, since clustering
  // refuses a single row. Grouped while on rows, so a track whose sources
  // dropped to one can still get back to one box.
  if (!self.isRowLayout && self.discoveredRows.length <= 1) {
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
  const current = leafKey(
    self.isRowLayout ? 'rows' : 'overlay',
    self.renderingType,
  )
  return {
    label: 'Plot type',
    icon: ShowChartIcon,
    subMenu: LAYOUTS.map(([layout, layoutLabel]) =>
      makeRadioSubMenu({
        label: layoutLabel,
        value: current,
        onChange: key => {
          const cut = key.indexOf(':')
          self.setRenderingType(key.slice(cut + 1))
          self.setRowLayout(key.slice(0, cut) === 'rows')
        },
        options: renderings.map(
          ([value, label]) => [leafKey(layout, value), label] as const,
        ),
      }),
    ),
  }
}

export function makePointSizeMenuItems(
  self: { renderingType: string } & Parameters<
    typeof scatterPointSizeAccess
  >[0],
): MenuItem[] {
  return makePointSizeSubMenu({
    label: 'Scatter point size',
    applies: isScatterMode(self.renderingType),
    ...scatterPointSizeAccess(self),
  })
}

export function makeLineWidthMenuItems(self: {
  renderingType: string
  lineWidth: number
  setLineWidth: (n?: number) => void
  configuration: ConfigModelForFields<{
    lineWidth: { type: 'number'; defaultValue: number }
  }>
}): MenuItem[] {
  return isLineMode(self.renderingType)
    ? [
        {
          label: 'Line width',
          icon: LineWeightIcon,
          subMenu: [
            makeSizeMenu({
              label: 'Line width',
              title: 'Line width',
              // whole px from 1, so a drag fully left lands on 1px rather than
              // crowding it into the default 0.5-step range's first stops
              min: 1,
              max: 10,
              step: 1,
              getValue: () => self.lineWidth,
              isDefault:
                self.lineWidth ===
                getSlotDefinition(self.configuration, 'lineWidth').defaultValue,
              onChange: n => {
                self.setLineWidth(n)
              },
              onReset: () => {
                self.setLineWidth(undefined)
              },
            }),
          ],
        },
      ]
    : []
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
  self: WithResolution &
    ScoreScaleModel &
    AutoscaleModel & { domain: [number, number] | undefined },
): MenuItem {
  return makeScoreSubMenu(self, {
    domain: self.domain,
    leadingItems: makeSummaryScoreModeSubMenu(self),
  })
}
