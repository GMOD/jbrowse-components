import { makeSizeSubMenu } from '@jbrowse/core/ui'
import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import {
  showLegendCheckboxItem,
  toggleItem,
  withHint,
} from '@jbrowse/core/ui/menuItems'
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
 * the submenus (choices before values). Lock aspect ratio is the one row
 * that frames the plot rather than draws it: it is a mode, and the ⋮ menu
 * holds one-shot actions.
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
          toggleItem('CIGAR indels', model.drawCigar, flag => {
            model.setDrawCigar(flag)
          }),
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
          ),
          toggleItem('Tick labels', model.axisLabels, flag => {
            model.setAxisLabels(flag)
          }),
          toggleItem(
            'Lock aspect ratio (same bp/px)',
            model.ratio === 1,
            // no squareView() call: the aspect-lock autorun observes this flag
            // and squares the axes the moment it goes on
            flag => {
              model.setRatio(flag ? 1 : undefined)
            },
          ),
          ...(model.hasLegendKey
            ? [
                showLegendCheckboxItem(model.showLegend, () => {
                  model.setLegendShow(!model.showLegend)
                }),
              ]
            : []),
          ...lodMenuItems(model),
          opacityMenuItem(model),
          makeSizeSubMenu({
            label: 'line width',
            title: 'Line width',
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
