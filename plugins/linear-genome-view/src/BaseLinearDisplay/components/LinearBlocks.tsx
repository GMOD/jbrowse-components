import { useEffect, useRef } from 'react'

import { getContainingView } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { autorun } from 'mobx'
import { observer } from 'mobx-react'

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
  },
})

const LinearBlocks = observer(function ({
  model,
}: {
  model: BaseLinearDisplayModel
}) {
  const { classes } = useStyles()
  const ref = useRef<HTMLDivElement>(null)
  const viewModel = getContainingView(model) as LinearGenomeViewModel

  useEffect(() => {
    return autorun(
      function linearBlocksTransformAutorun() {
        try {
          const { blockDefinitions } = model
          const { offsetPx } = viewModel
          const div = ref.current
          if (div) {
            div.style.transform = `translateX(${blockDefinitions.offsetPx - offsetPx}px)`
          }
        } catch (e) {
          // may error during cleanup
        }
      },
      { name: 'LinearBlocksTransform' },
    )
  }, [model, viewModel])

  return (
    <div ref={ref} className={classes.linearBlocks}>
      <RenderedBlocks model={model} />
    </div>
  )
})

export default LinearBlocks
