import { makeCurrentValueSessionDefaultControl } from '@jbrowse/core/configuration'
import {
  makeRadioSubMenu,
  makeScatterPointSizeMenuItem,
  makeSizeMenu,
} from '@jbrowse/wiggle-core'
import AddIcon from '@mui/icons-material/Add'
import LineWeightIcon from '@mui/icons-material/LineWeight'
import RemoveIcon from '@mui/icons-material/Remove'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import ScatterPlotIcon from '@mui/icons-material/ScatterPlot'
import ShowChartIcon from '@mui/icons-material/ShowChart'
import VisibilityIcon from '@mui/icons-material/Visibility'
import { IconButton, Tooltip, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import type { PromotableDisplay } from '@jbrowse/core/configuration'
import type { MenuItem } from '@jbrowse/core/ui'

const SCATTER_POINT_SIZE_DEFAULT = 2
const LINE_WIDTH_DEFAULT = 1

// Shared "Show" submenu: single and multi wiggle both group their visibility
// toggles and rendering-specific size sliders (point size / line width) here,
// and both drop the whole submenu when nothing applies (e.g. density mode with
// no cross hatches or size slider). Kept as one helper so the two displays can't
// drift on the label/icon or the empty-omit behavior.
export function makeShowSubMenu(items: MenuItem[]): MenuItem[] {
  return items.length
    ? [{ label: 'Show', icon: VisibilityIcon, subMenu: items }]
    : []
}

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

// Top-level "Scatter point size" submenu, present only in scatter variants
// ('scatter'/'multirowscatter'/'multiscatter') where point size applies. The
// shared makeSizeMenu renders it as a single inline slider row with a promotable
// "default for all tracks of this type" pin.
export function makePointSizeMenuItems(
  self: {
    renderingType: string
    scatterPointSize: number
    setScatterPointSize: (n?: number) => void
  } & PromotableDisplay,
): MenuItem[] {
  if (!self.renderingType.includes('scatter')) {
    return []
  }
  return [
    {
      label: 'Scatter point size',
      icon: ScatterPlotIcon,
      subMenu: [
        makeScatterPointSizeMenuItem(self, {
          label: 'Scatter point size',
          defaultValue: SCATTER_POINT_SIZE_DEFAULT,
        }),
      ],
    },
  ]
}

// Top-level "Line width" submenu, present only in line variants
// ('line'/'multirowline'/'multiline') where stroke thickness applies. The shared
// makeSizeMenu renders it as a single inline slider row with a promotable
// "default for all tracks of this type" pin.
export function makeLineWidthMenuItems(
  self: {
    renderingType: string
    lineWidth: number
    setLineWidth: (n?: number) => void
  } & PromotableDisplay,
): MenuItem[] {
  if (!self.renderingType.includes('line')) {
    return []
  }
  return [
    {
      label: 'Line width',
      icon: LineWeightIcon,
      subMenu: [
        makeSizeMenu({
          label: 'Line width',
          title: 'Line width',
          // integer px with a floor of 1: the default range/step (0.5-12 by
          // 0.5) crowds 1px into a few px at the far-left edge between 0.5 and
          // 1.5, so a mouse drag can't reliably land on it. 1px as the leftmost
          // stop makes it selectable by dragging fully left.
          min: 1,
          max: 10,
          step: 1,
          getValue: () => self.lineWidth,
          isDefault: self.lineWidth === LINE_WIDTH_DEFAULT,
          onChange: n => {
            self.setLineWidth(n)
          },
          onReset: () => {
            self.setLineWidth(undefined)
          },
          sessionDefault: makeCurrentValueSessionDefaultControl(self, [
            'lineWidth',
          ]),
        }),
      ],
    },
  ]
}

// Resolution is a multiplier on the number of bins fetched (higher = finer),
// stepped multiplicatively by 2 with a default of 1. Rendered inline so the
// user can step finer/coarser repeatedly without reopening the menu each click.
// Bounds mirror setResolution's clamp so the buttons disable at the edges
// instead of silently no-op'ing.
const RESOLUTION_STEP = 2
const RESOLUTION_MIN = 1 / 16
const RESOLUTION_MAX = 1024

function formatResolution(n: number) {
  return n >= 1 ? `${n}×` : `1/${Math.round(1 / n)}×`
}

const ResolutionStepper = observer(function ResolutionStepper({
  getValue,
  onFiner,
  onCoarser,
  onReset,
}: {
  getValue: () => number
  onFiner: () => void
  onCoarser: () => void
  onReset: () => void
}) {
  const value = getValue()
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, width: 220 }}>
      <Tooltip title="Coarser resolution">
        <span>
          <IconButton
            size="small"
            sx={{ p: 0.25 }}
            disabled={value <= RESOLUTION_MIN}
            onClick={() => {
              onCoarser()
            }}
          >
            <RemoveIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
      <Typography
        variant="caption"
        color="textSecondary"
        style={{ flex: 1, textAlign: 'center' }}
      >
        Resolution: {formatResolution(value)}
      </Typography>
      <Tooltip title="Finer resolution">
        <span>
          <IconButton
            size="small"
            sx={{ p: 0.25 }}
            disabled={value >= RESOLUTION_MAX}
            onClick={() => {
              onFiner()
            }}
          >
            <AddIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title="Reset to default resolution">
        <span>
          <IconButton
            size="small"
            sx={{ p: 0.25 }}
            disabled={value === 1}
            onClick={() => {
              onReset()
            }}
          >
            <RestartAltIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
    </div>
  )
})

interface WithResolution {
  hasResolution: boolean
  resolution: number
  summaryScoreMode: string
  isDensityMode: boolean
  setResolution: (n: number) => void
  setSummaryScoreMode: (v: string) => void
}

// Resolution lives at the top level of the track menu (not nested under Score)
// for discoverability.
export function makeResolutionSubMenu(self: WithResolution): MenuItem[] {
  if (!self.hasResolution) {
    return []
  }
  return [
    {
      label: 'Resolution',
      subMenu: [
        {
          label: 'Resolution stepper',
          type: 'custom',
          render: () => (
            <ResolutionStepper
              getValue={() => self.resolution}
              onFiner={() => {
                self.setResolution(self.resolution * RESOLUTION_STEP)
              }}
              onCoarser={() => {
                self.setResolution(self.resolution / RESOLUTION_STEP)
              }}
              onReset={() => {
                self.setResolution(1)
              }}
            />
          ),
        },
      ],
    },
  ]
}

export function makeSummaryScoreModeSubMenu(self: WithResolution): MenuItem[] {
  if (!self.hasResolution) {
    return []
  }
  return [
    {
      label: 'Summary score mode',
      subMenu: (
        [
          ['min', 'Minimum'],
          ['max', 'Maximum'],
          ['avg', 'Average'],
          ['whiskers', 'Whiskers'],
        ] as const
      ).map(([value, label]) => ({
        label,
        type: 'radio' as const,
        checked: self.summaryScoreMode === value,
        // whiskers is ignored in density mode (score maps to color, not height)
        disabled: value === 'whiskers' && self.isDensityMode,
        disabledHelpText: 'Not available in density mode',
        onClick: () => {
          self.setSummaryScoreMode(value)
        },
      })),
    },
  ]
}
