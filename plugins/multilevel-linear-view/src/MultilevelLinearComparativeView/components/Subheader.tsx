import React from 'react'
import { observer } from 'mobx-react'

import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view/src/LinearGenomeView'
import Controls from './Controls'
import { MultilevelLinearComparativeViewModel } from '../model'

type LGV = LinearGenomeViewModel
type LCV = MultilevelLinearComparativeViewModel

const Subheader = observer(
  ({
    model,
    view,
    ExtraButtons,
  }: {
    model: LCV
    view: LGV
    ExtraButtons?: React.ReactNode
  }) => {
    return <Controls view={view} />
  },
)

export default Subheader
