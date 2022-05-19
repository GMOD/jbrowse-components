import React, { useState } from 'react'
import { observer } from 'mobx-react'
import { IconButton } from '@material-ui/core'
import UnfoldLessIcon from '@material-ui/icons/UnfoldLess'
import UnfoldMoreIcon from '@material-ui/icons/UnfoldMore'
import MenuIcon from '@material-ui/icons/Menu'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view/src/LinearGenomeView'
import Menu from '@jbrowse/core/ui/Menu'

import { MultilevelLinearComparativeViewModel } from '../model'
import LabelField from './LabelField'
import Controls from './Controls'

type LGV = LinearGenomeViewModel
type LCV = MultilevelLinearComparativeViewModel

const ExtraButtons = observer(({ view }: { view: LGV }) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement>()

  return (
    <>
      <IconButton
        onClick={event => {
          setAnchorEl(event.currentTarget)
        }}
        title="Open view menu"
      >
        <MenuIcon color="secondary" />
      </IconButton>
      <IconButton
        onClick={() => {
          view.toggleVisible()
        }}
        title="Toggle show/hide view"
      >
        {view.isVisible ? (
          <UnfoldLessIcon color="secondary" />
        ) : (
          <>
            <UnfoldMoreIcon color="secondary" />
          </>
        )}
      </IconButton>

      <LabelField model={view} />
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onMenuItemClick={(_, callback) => {
          callback()
          setAnchorEl(undefined)
        }}
        onClose={() => {
          setAnchorEl(undefined)
        }}
        menuItems={view.menuItems()}
      />
    </>
  )
})

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
        model={model}
        view={view}
        polygonPoints={polygonPoints}
        ExtraButtons={<ExtraButtons view={view} />}
      />
    )
  },
)

export default Subheader
