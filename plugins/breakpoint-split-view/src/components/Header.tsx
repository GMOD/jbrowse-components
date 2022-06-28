import React from 'react'
import { observer } from 'mobx-react'
import { IconButton } from '@mui/material'
import { makeStyles } from 'tss-react/mui'

// icons
import LocationSearching from '@mui/icons-material/LocationSearching'
import LocationDisabled from '@mui/icons-material/LocationDisabled'
import LeakAdd from '@mui/icons-material/LeakAdd'
import LeakRemove from '@mui/icons-material/LeakRemove'
import LinkIcon from '@mui/icons-material/Link'
import LinkOffIcon from '@mui/icons-material/LinkOff'

import { BreakpointViewModel } from '../model'

const useStyles = makeStyles()(theme => ({
  headerBar: {
    gridArea: '1/1/auto/span 2',
    display: 'flex',
  },
  spacer: {
    flexGrow: 1,
  },
}))

const InteractWithSquiggles = observer(
  ({ model }: { model: BreakpointViewModel }) => {
    return (
      <IconButton
        onClick={() => model.toggleInteract()}
        title="Toggle interacting with the overlay"
      >
        {model.interactToggled ? <LocationSearching /> : <LocationDisabled />}
      </IconButton>
    )
  },
)

const LinkViews = observer(({ model }: { model: BreakpointViewModel }) => {
  return (
    <IconButton
      onClick={() => model.toggleLinkViews()}
      title="Toggle linked scrolls and behavior across views"
    >
      {model.linkViews ? (
        <LinkIcon color="secondary" />
      ) : (
        <LinkOffIcon color="secondary" />
      )}
    </IconButton>
  )
})

const Sync = observer(({ model }: { model: BreakpointViewModel }) => {
  return (
    <IconButton
      onClick={model.toggleIntraviewLinks}
      title="Toggle rendering intraview links"
    >
      {model.showIntraviewLinks ? (
        <LeakAdd color="secondary" />
      ) : (
        <LeakRemove color="secondary" />
      )}
    </IconButton>
  )
})

const Header = observer(({ model }: { model: BreakpointViewModel }) => {
  const { classes } = useStyles()

  return (
    <div className={classes.headerBar}>
      <LinkViews model={model} />
      <InteractWithSquiggles model={model} />
      <Sync model={model} />

      <div className={classes.spacer} />
    </div>
  )
})

export default Header
