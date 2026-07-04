import { makePointSizeMenu, makeRadioSubMenu } from '@jbrowse/wiggle-core'
import AddIcon from '@mui/icons-material/Add'
import RemoveIcon from '@mui/icons-material/Remove'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import ScatterPlotIcon from '@mui/icons-material/ScatterPlot'
import ShowChartIcon from '@mui/icons-material/ShowChart'
import VisibilityIcon from '@mui/icons-material/Visibility'
import { IconButton, Tooltip, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import type { MenuItem } from '@jbrowse/core/ui'

const SCATTER_POINT_SIZE_DEFAULT = 2

// Shared "Show" submenu: single and multi wiggle both group their visibility
// toggles here, and both drop the whole submenu when no toggle applies (e.g.
// density mode removes cross hatches). Kept as one helper so the two displays
// can't drift on the label/icon or the empty-omit behavior.
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

// Top-level track-menu item (not nested under Plot type, for discoverability),
// present only in scatter variants ('scatter'/'multirowscatter'/'multiscatter')
// where point size applies. Uses the shared inline-slider submenu.
export function makePointSizeMenuItems(self: {
  renderingType: string
  scatterPointSize: number
  setScatterPointSize: (n?: number) => void
}): MenuItem[] {
  if (!self.renderingType.includes('scatter')) {
    return []
  }
  return [
    makePointSizeMenu({
      label: 'Scatter point size',
      icon: ScatterPlotIcon,
      getValue: () => self.scatterPointSize,
      isDefault: self.scatterPointSize === SCATTER_POINT_SIZE_DEFAULT,
      onChange: n => {
        self.setScatterPointSize(n)
      },
      onReset: () => {
        self.setScatterPointSize(undefined)
      },
    }),
  ]
}

// Resolution is a multiplier on the number of bins fetched (higher = finer),
// stepped multiplicatively by 5 with a default of 1. Rendered inline so the
// user can step finer/coarser repeatedly without reopening the menu each click.
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
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, width: 200 }}>
      <Tooltip title="Coarser resolution">
        <IconButton size="small" onClick={() => { onCoarser() }}>
          <RemoveIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Typography
        variant="caption"
        color="textSecondary"
        style={{ flex: 1, textAlign: 'center' }}
      >
        {formatResolution(value)}
      </Typography>
      <Tooltip title="Finer resolution">
        <IconButton size="small" onClick={() => { onFiner() }}>
          <AddIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Reset to default resolution">
        <span>
          <IconButton
            size="small"
            disabled={value === 1}
            onClick={() => { onReset() }}
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

export function makeResolutionAndSummarySubMenus(
  self: WithResolution,
): MenuItem[] {
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
                self.setResolution(self.resolution * 5)
              }}
              onCoarser={() => {
                self.setResolution(self.resolution / 5)
              }}
              onReset={() => {
                self.setResolution(1)
              }}
            />
          ),
        },
      ],
    },
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
