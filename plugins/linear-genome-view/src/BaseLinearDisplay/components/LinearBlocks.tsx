import { getContainingView } from '@jbrowse/core/util'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

import RenderedBlocks from './RenderedBlocks'

import type { LinearGenomeViewModel } from '../../LinearGenomeView'
import type { BaseLinearDisplayModel } from '../model'

const useStyles = makeStyles()({
  linearBlocks: {
    whiteSpace: 'nowrap',
    textAlign: 'left',
    position: 'absolute',
    left: 0,
    minHeight: '100%',
    display: 'flex',
    willChange: 'transform',
  },
})

const LinearBlocks = observer(function ({
  model,
}: {
  model: BaseLinearDisplayModel
}) {
  const { classes } = useStyles()
  const { blockDefinitions } = model
  const viewModel = getContainingView(model) as LinearGenomeViewModel
  const offsetLeft = blockDefinitions.offsetPx - viewModel.offsetPx
  return (
    <div
      className={classes.linearBlocks}
      style={{
        transform: `translateX(${offsetLeft}px)`,
      }}
    >
      <RenderedBlocks model={model} />
    </div>
  )
})

export default LinearBlocks
