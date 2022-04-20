import React from 'react'
import { observer } from 'mobx-react'
import { MultilevelLinearComparativeViewModel } from '../model'
import OverviewScaleBar from '@jbrowse/plugin-linear-genome-view/src/LinearGenomeView/components/OverviewScaleBar'
import Controls from './Controls'

type LCV = MultilevelLinearComparativeViewModel

const Header = observer(
  ({ model, ExtraButtons }: { model: LCV; ExtraButtons?: React.ReactNode }) => {
    return (
      <div>
        {model.views[0].initialized ? (
          <OverviewScaleBar model={model.views[0]}>
            <Controls
              view={model.views[0]}
              model={model}
              ExtraButtons={ExtraButtons}
            />
          </OverviewScaleBar>
        ) : null}
      </div>
    )
  },
)

export default Header
