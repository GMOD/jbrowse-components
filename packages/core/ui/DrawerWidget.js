import Typography from '@material-ui/core/Typography'
import AppBar from '@material-ui/core/AppBar'
import IconButton from '@material-ui/core/IconButton'
import Button from '@material-ui/core/Button'
import Toolbar from '@material-ui/core/Toolbar'
import MobileStepper from '@material-ui/core/MobileStepper'
import ArrowBackIosIcon from '@material-ui/icons/ArrowBackIos'
import ArrowForwardIosIcon from '@material-ui/icons/ArrowForwardIos'
import { makeStyles } from '@material-ui/core/styles'
import { fade } from '@material-ui/core/styles/colorManipulator'
import CloseIcon from '@material-ui/icons/Close'
import { observer, PropTypes } from 'mobx-react'
import React, { useRef, useEffect } from 'react'
import Drawer from './Drawer'

const useStyles = makeStyles(theme => ({
  defaultDrawer: {},
  components: {
    display: 'block',
  },
  drawerCloseButton: {
    float: 'right',
    '&:hover': {
      backgroundColor: fade(
        theme.palette.secondary.contrastText,
        theme.palette.action.hoverOpacity,
      ),
      '@media (hover: none)': {
        backgroundColor: 'transparent',
      },
    },
  },
  drawerToolbar: {
    paddingLeft: theme.spacing(2),
  },
  drawerToolbarCloseButton: {
    flexGrow: 1,
  },
  drawerLoading: {
    margin: theme.spacing(2),
  },
}))
const DrawerWidget = observer(props => {
  const { session } = props
  const { visibleWidget, pluginManager } = session
  const {
    ReactComponent,
    HeadingComponent,
    heading,
  } = pluginManager.getWidgetType(visibleWidget.type)
  const classes = useStyles()
  const [activeWidget, setActiveWidget] = React.useState(
    session.activeWidgets.size - 1,
  )

  const handleNext = () => {
    if (activeWidget < session.activeWidgets.size - 1) {
      setActiveWidget(prevActiveWidget => prevActiveWidget + 1)
      const widgetToShow = Array.from(session.activeWidgets.values())[
        activeWidget
      ]
      session.showWidget(widgetToShow)
    }
  }

  const handleBack = () => {
    if (activeWidget > 0) {
      setActiveWidget(prevActiveWidget => prevActiveWidget - 1)
      const widgetToShow = Array.from(session.activeWidgets.values())[
        activeWidget
      ]
      session.showWidget(widgetToShow)
    }
  }

  console.log('active', activeWidget)
  console.log('list', session.activeWidgets)

  // console.log(ReactComponent)
  // TODO: use widget id to get the wideget then show the widget
  // TODO: use navigation either stepper or butttons
  // TODO: back and forth buttons
  // TODO: fix spacing between navigation and header
  return (
    <Drawer session={session} open={Boolean(session.activeWidgets.size)}>
      <div className={classes.defaultDrawer}>
        <AppBar position="static" color="secondary">
          <Toolbar disableGutters className={classes.drawerToolbar}>
            {session.activeWidgets.size > 1 && (
              <MobileStepper
                variant="text"
                steps={session.activeWidgets.size}
                activeStep={activeWidget}
                nextButton={
                  <Button onClick={handleNext}>
                    <ArrowForwardIosIcon aria-label="Next" />
                  </Button>
                }
                backButton={
                  <Button onClick={handleBack}>
                    <ArrowBackIosIcon aria-label="Back" />
                  </Button>
                }
              />
            )}
            <Typography variant="h6" color="inherit">
              {HeadingComponent ? (
                <HeadingComponent model={visibleWidget} />
              ) : (
                heading || undefined
              )}
            </Typography>
            <div className={classes.drawerToolbarCloseButton} />
            <IconButton
              className={classes.drawerCloseButton}
              data-testid="drawer-close"
              color="inherit"
              aria-label="Close"
              onClick={() => {
                session.hideWidget(visibleWidget)
              }}
            >
              <CloseIcon />
            </IconButton>
          </Toolbar>
        </AppBar>
        <ReactComponent model={visibleWidget} session={session} />
      </div>
    </Drawer>
  )
})

DrawerWidget.propTypes = {
  session: PropTypes.observableObject.isRequired,
}

export default DrawerWidget
