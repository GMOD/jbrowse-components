import React from 'react'
import { withSize } from 'react-sizeme'
import { observer } from 'mobx-react'
import IconButton from '@material-ui/core/IconButton'
import { makeStyles } from '@material-ui/core/styles'

// icons
import LocationSearching from '@material-ui/icons/LocationSearching'
import LocationDisabled from '@material-ui/icons/LocationDisabled'
import LeakAdd from '@material-ui/icons/LeakAdd'
import LeakRemove from '@material-ui/icons/LeakRemove'
import LinkIcon from '@material-ui/icons/Link'
import LinkOffIcon from '@material-ui/icons/LinkOff'

import { BreakpointViewModel } from '../model'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const useStyles = makeStyles((theme: any) => ({
  headerBar: {
    gridArea: '1/1/auto/span 2',
    display: 'flex',
  },
  iconButton: {},
  spacer: {
    flexGrow: 1,
  },
  emphasis: {
    background: theme.palette.secondary.main,
    padding: theme.spacing(1),
  },
  hovered: {
    background: theme.palette.secondary.light,
  },
  displayName: {
    background: theme.palette.secondary.main,
    paddingTop: 3,
    paddingLeft: theme.spacing(1),
    paddingRight: theme.spacing(1),
  },
  inputBase: {
    color: theme.palette.secondary.contrastText,
  },
  inputRoot: {
    '&:hover': {
      backgroundColor: theme.palette.secondary.light,
    },
  },
  inputFocused: {
    borderColor: theme.palette.primary.main,
    backgroundColor: theme.palette.secondary.light,
  },
}))

const InteractWithSquiggles = observer(
  ({ model }: { model: BreakpointViewModel }) => {
    const classes = useStyles()
    return (
      <IconButton
        onClick={() => model.toggleInteract()}
        className={classes.iconButton}
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
      className={classes.iconButton}
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
  const classes = useStyles()
  return (
    <IconButton
      onClick={model.toggleIntraviewLinks}
      className={classes.iconButton}
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

const Header = observer(
  ({
    model,
    size,
  }: {
    model: BreakpointViewModel
    size: { height: number }
  }) => {
    const classes = useStyles()

    model.setHeaderHeight(size.height)
    return (
      <div className={classes.headerBar}>
        <LinkViews model={model} />
        <InteractWithSquiggles model={model} />
        <Sync model={model} />

        <div className={classes.spacer} />
      </div>
    )
  },
)

export default withSize({ monitorHeight: true })(Header)
