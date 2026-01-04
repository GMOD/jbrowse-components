import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Tooltip, YSCALEBAR_LABEL_OFFSET } from '@jbrowse/plugin-wiggle'
import { observer } from 'mobx-react'

import TooltipContents from './TooltipContents'

import type { ClickMapItem } from '../../SNPCoverageRenderer/types'
import type { Feature } from '@jbrowse/core/util'

interface ParsedItemData {
  item: ClickMapItem
  refName?: string
}

function parseItemData(data: string): ParsedItemData {
  return JSON.parse(data) as ParsedItemData
}

const useStyles = makeStyles()(theme => ({
  hoverVertical: {
    background: theme.palette.text.primary,
    border: 'none',
    width: 1,
    height: '100%',
    top: YSCALEBAR_LABEL_OFFSET,
    cursor: 'default',
    position: 'absolute',
    pointerEvents: 'none',
  },
}))

type Coord = [number, number]

const SNPCoverageTooltip = observer(function SNPCoverageTooltip(props: {
  model: {
    featureUnderMouse?: Feature
    mouseoverExtraInformation?: string
    visibleModifications: Map<
      string,
      { color: string; base: string; strand: string }
    >
    simplexModifications?: Set<string>
  }
  height: number
  offsetMouseCoord: Coord
  clientMouseCoord: Coord
  clientRect?: DOMRect
}) {
  const { model, height, clientMouseCoord, offsetMouseCoord } = props
  const { featureUnderMouse: feat, mouseoverExtraInformation } = model
  const { classes } = useStyles()

  // Show interbase indicator tooltip when hovering over one
  if (mouseoverExtraInformation && !feat) {
    const x = clientMouseCoord[0] + 5
    const y = clientMouseCoord[1]
    const { item, refName } = parseItemData(mouseoverExtraInformation)
    return (
      <>
        <BaseTooltip clientPoint={{ x, y }}>
          <TooltipContents item={item} refName={refName} model={model} />
        </BaseTooltip>
        <div
          className={classes.hoverVertical}
          style={{
            left: offsetMouseCoord[0],
            height: height - YSCALEBAR_LABEL_OFFSET * 2,
          }}
        />
      </>
    )
  }

  return feat?.get('type') === 'skip' ? null : (
    <Tooltip TooltipContents={TooltipContents} {...props} />
  )
})

export default SNPCoverageTooltip
