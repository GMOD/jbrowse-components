import React from 'react'
import { observer } from 'mobx-react'

import { LinearGenomeMultilevelViewModel } from '../../LinearGenomeMultilevelView/model'
import { MultilevelLinearViewModel } from '../model'
import Controls from './Controls'

type LCV = MultilevelLinearViewModel
type LGV = LinearGenomeMultilevelViewModel

const Subheader = observer(
  ({
    model,
    view,
    polygonPoints,
  }: {
    model: LCV
    view: LGV
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    polygonPoints: any
  }) => {
    return (
      <Controls
        data-testid="subheader"
        model={model}
        view={view}
        polygonPoints={polygonPoints}
      />
    )
  },
)

export default Subheader
