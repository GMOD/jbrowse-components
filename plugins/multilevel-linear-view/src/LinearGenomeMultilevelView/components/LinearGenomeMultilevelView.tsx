import React from 'react'
import { observer } from 'mobx-react'

// TODO: UPDATE LGV PLUGIN TO EXPORT THIS
// import { LinearGenomeView } from '@jbrowse/plugin-linear-genome-view'
import LinearGenomeView from '@jbrowse/plugin-linear-genome-view/src/LinearGenomeView/components/LinearGenomeView'

import { LinearGenomeMultilevelViewModel } from '../model'

type LGMV = LinearGenomeMultilevelViewModel

const LinearGenomeMultilevelView = observer(({ model }: { model: LGMV }) => {
  return <LinearGenomeView model={model} />
})

export default LinearGenomeMultilevelView
