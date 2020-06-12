import { withSize } from 'react-sizeme'
import LocationSearching from '@material-ui/icons/LocationSearching'
import LocationDisabled from '@material-ui/icons/LocationDisabled'
import LeakAdd from '@material-ui/icons/LeakAdd'
import LeakRemove from '@material-ui/icons/LeakRemove'
import LinkIcon from '@material-ui/icons/Link'
import LinkOffIcon from '@material-ui/icons/LinkOff'
import { BreakpointViewModel } from '../model'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default ({ jbrequire }: { jbrequire: any }) => {
  const { observer, PropTypes } = jbrequire('mobx-react')
  const React = jbrequire('react')
  const IconButton = jbrequire('@material-ui/core/IconButton')
  const { makeStyles } = jbrequire('@material-ui/core/styles')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const useStyles = makeStyles((theme: any) => ({
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
    ({ model }: { model: BreakpointViewModel }) => {
      const classes = useStyles()
      return (
        <IconButton
          onClick={() => model.toggleInteract()}
          className={classes.iconButton}
          title="Toggle interacting with the overlay"
        >
          {model.interactToggled ? (
            <LocationSearching fontSize="small" />
          ) : (
            <LocationDisabled fontSize="small" />
          )}
        </IconButton>
      )
    },
  )
  InteractWithSquiggles.propTypes = {
    model: PropTypes.objectOrObservableObject.isRequired,
  }
  const LinkViews = observer(({ model }: { model: BreakpointViewModel }) => {
    const classes = useStyles()
    return (
      <IconButton
        onClick={() => model.toggleLinkViews()}
        className={classes.iconButton}
        title="Toggle linked scrolls and behavior across views"
      >
        {model.linkViews ? (
          <LinkIcon color="secondary" fontSize="small" />
        ) : (
          <LinkOffIcon color="secondary" fontSize="small" />
        )}
      </IconButton>
    )
  })
  LinkViews.propTypes = {
    model: PropTypes.objectOrObservableObject.isRequired,
  }
  const Sync = observer(({ model }: { model: BreakpointViewModel }) => {
    const classes = useStyles()
    return (
      <IconButton
        onClick={model.toggleIntraviewLinks}
        className={classes.iconButton}
        title="Toggle rendering intraview links"
      >
        {model.showIntraviewLinks ? (
          <LeakAdd color="secondary" fontSize="small" />
        ) : (
          <LeakRemove color="secondary" fontSize="small" />
        )}
      </IconButton>
    )
  })
  Sync.propTypes = {
    model: PropTypes.objectOrObservableObject.isRequired,
  }
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

  Header.propTypes = {
    model: PropTypes.objectOrObservableObject.isRequired,
  }

  return withSize({ monitorHeight: true })(Header)
}
