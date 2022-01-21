import React from 'react'
import { withSize } from 'react-sizeme'
import { observer } from 'mobx-react'
import { IconButton, makeStyles } from '@material-ui/core'

// icons
import LocationSearching from '@material-ui/icons/LocationSearching'
import LocationDisabled from '@material-ui/icons/LocationDisabled'
import LeakAdd from '@material-ui/icons/LeakAdd'
import LeakRemove from '@material-ui/icons/LeakRemove'
import LinkIcon from '@material-ui/icons/Link'
import LinkOffIcon from '@material-ui/icons/LinkOff'

import { BreakpointViewModel } from '../model'

const useStyles = makeStyles(theme => ({
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
    const classes = useStyles()
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
  const classes = useStyles()
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
  const classes = useStyles()

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
