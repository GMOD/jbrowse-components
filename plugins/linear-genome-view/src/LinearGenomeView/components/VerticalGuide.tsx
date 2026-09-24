import { stringify } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import { VerticalGuideLine } from '../../shared/coordLabels.tsx'
import { stickyChromeTops } from '../stickyChrome.ts'

import type { LinearGenomeViewModel } from '../index.ts'

const VerticalGuide = observer(function VerticalGuide({
  model,
  coordX,
}: {
  model: LinearGenomeViewModel
  coordX: number
}) {
  const { width, stickyViewHeaders, headerHeight } = model
  const { scalebar } = stickyChromeTops({ stickyViewHeaders, headerHeight })
  return (
    <VerticalGuideLine coordX={coordX} viewWidth={width} stickyTop={scalebar}>
      {stringify(model.pxToBp(coordX))}
    </VerticalGuideLine>
  )
})

export default VerticalGuide
