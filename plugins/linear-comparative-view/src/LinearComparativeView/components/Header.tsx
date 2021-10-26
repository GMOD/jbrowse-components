import React from 'react'
import { IconButton, makeStyles } from '@material-ui/core'
import { withSize } from 'react-sizeme'
import { observer } from 'mobx-react'

// icons
import LeakAddIcon from '@material-ui/icons/LeakAdd'
import LeakRemoveIcon from '@material-ui/icons/LeakRemove'
import LinkIcon from '@material-ui/icons/Link'
import LinkOffIcon from '@material-ui/icons/LinkOff'
import LocationSearchingIcon from '@material-ui/icons/LocationSearching'
import LocationDisabledIcon from '@material-ui/icons/LocationDisabled'

import { LinearComparativeViewModel } from '../model'

const useStyles = makeStyles(theme => ({
  headerBar: {
    gridArea: '1/1/auto/span 2',
    display: 'flex',
  },
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
  ({ model }: { model: LinearComparativeViewModel }) => {
    return (
      <IconButton
        onClick={model.toggleInteract}
        title="Toggle interacting with the overlay"
      >
        {model.interactToggled ? (
          <LocationSearchingIcon />
        ) : (
          <LocationDisabledIcon />
        )}
      </IconButton>
    )
  },
)

const LinkViews = observer(
  ({ model }: { model: LinearComparativeViewModel }) => {
    return (
      <IconButton
        onClick={model.toggleLinkViews}
        title="Toggle linked scrolls and behavior across views"
      >
        {model.linkViews ? (
          <LinkIcon color="secondary" />
        ) : (
          <LinkOffIcon color="secondary" />
        )}
      </IconButton>
    )
  },
)

const Sync = observer(({ model }: { model: LinearComparativeViewModel }) => {
  return (
    <IconButton
      onClick={model.toggleIntraviewLinks}
      title="Toggle rendering intraview links"
    >
      {model.showIntraviewLinks ? (
        <LeakAddIcon color="secondary" />
      ) : (
        <LeakRemoveIcon color="secondary" />
      )}
    </IconButton>
  )
})

const Header = observer(
  ({
    model,
    size,
  }: {
    model: LinearComparativeViewModel
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
