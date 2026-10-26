import { makeSizeSubMenu } from '@jbrowse/core/ui'
import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import { toggleItem, withHint } from '@jbrowse/core/ui/menuItems'
import {
  SETTINGS_SURFACE_LABELS,
  identityFadeMenuItem,
  lodMenuItems,
  minIdentityMenuItem,
  minLengthMenuItem,
  opacityMenuItem,
} from '@jbrowse/synteny-core'
import TuneIcon from '@mui/icons-material/Tune'
import { observer } from 'mobx-react'

import { DEFAULT_LINE_WIDTH } from '../consts.ts'

import type { DotplotViewModel } from '../model.ts'
import type { MenuItem } from '@jbrowse/core/ui'

/**
 * Every setting that decides what the plot looks like and how much detail feeds
 * it, in the shape the synteny view's settings menu uses: the checkboxes, then
 * the submenus (choices before values). Lock aspect ratio frames
 * the plot rather than draws it, so it stays in the ⋮ menu.
 */
const DotplotSettingsMenu = observer(function DotplotSettingsMenu({
  model,
}: {
  model: DotplotViewModel
}) {
  return (
    <CascadingMenuButton
      tooltip={SETTINGS_SURFACE_LABELS.DotplotView}
      menuItems={() =>
        [
          identityFadeMenuItem(model),
          toggleItem(
            'CIGAR indels',
            model.drawCigar,
            flag => {
              model.setDrawCigar(flag)
            },
            {
              helpText: 'Off draws each alignment as one straight segment.',
            },
          ),
          toggleItem(
            // a plot with no room for a ruler on either axis has no gridlines to
            // draw, and the box stays ticked through it
            withHint(
              'Gridlines',
              model.gridlinesEmpty ? 'none at this zoom' : undefined,
            ),
            model.axisGrid,
            flag => {
              model.setAxisGrid(flag)
            },
            {
              helpText:
                "Carry each axis' ruler ticks across the plot. An axis with no room to number itself draws none.",
            },
          ),
          toggleItem(
            'Tick labels',
            model.axisLabels,
            flag => {
              model.setAxisLabels(flag)
            },
            {
              helpText:
                'Number the ruler ticks along each axis. Off keeps the tick marks and chromosome names.',
            },
          ),
          ...(model.hasLegendKey
            ? [
                toggleItem('Show legend', model.showLegend, flag => {
                  model.setLegendShow(flag)
                }),
              ]
            : []),
          ...lodMenuItems(model),
          opacityMenuItem(model),
          makeSizeSubMenu({
            label: 'line width',
            title: 'Line width',
            help: 'Thickness of each alignment in pixels. Wider makes a sparse plot legible, narrower keeps a dense one from filling in.',
            min: 0.5,
            max: 10,
            step: 0.5,
            getValue: () => model.lineWidth,
            isDefault: model.lineWidth === DEFAULT_LINE_WIDTH,
            onChange: v => {
              model.setLineWidth(v)
            },
            onReset: () => {
              model.setLineWidth(DEFAULT_LINE_WIDTH)
            },
          }),
          minLengthMenuItem(model),
          minIdentityMenuItem(model),
        ] satisfies MenuItem[]
      }
    >
      <TuneIcon />
    </CascadingMenuButton>
  )
})

export default DotplotSettingsMenu
