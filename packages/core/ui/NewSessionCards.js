import Card from '@material-ui/core/Card'
import CardMedia from '@material-ui/core/CardMedia'
import Container from '@material-ui/core/Container'
import { makeStyles } from '@material-ui/core/styles'
import Typography from '@material-ui/core/Typography'
import { PropTypes as MobxPropTypes } from 'mobx-react'
import PropTypes from 'prop-types'
import React, { useState } from 'react'
import emptyIcon from './emptyIcon.png'
import linearGenomeViewIcon from './linearGenomeViewIcon.png'
import svInspectorIcon from './svInspectorIcon.png'

const useStyles = makeStyles(theme => ({
  card: {
    width: 200,
    height: 150,
    cursor: 'pointer',
  },
  name: {
    marginTop: theme.spacing(),
    textAlign: 'center',
    maxWidth: 200,
  },
  media: {
    height: 150,
  },
}))

function NewSessionCard({ name, onClick, image }) {
  const classes = useStyles()
  const [hovered, setHovered] = useState(false)
  return (
    <Container>
      <Card
        className={classes.card}
        onMouseOver={() => setHovered(true)}
        onMouseOut={() => setHovered(false)}
        onClick={onClick}
        raised={Boolean(hovered)}
      >
        <CardMedia className={classes.media} image={image} />
        {/* <CardContent
          style={{ textAlign: 'center', margin: 'auto', padding: 0 }}
        >
          {children}
        </CardContent> */}
      </Card>
      <Typography variant="subtitle2" className={classes.name}>
        {name}
      </Typography>
    </Container>
  )
}

NewSessionCard.propTypes = {
  name: PropTypes.string.isRequired,
  onClick: PropTypes.func,
  image: PropTypes.string.isRequired,
  style: PropTypes.shape({}),
}

NewSessionCard.defaultProps = {
  onClick: () => {},
  style: {},
}

const emptySessionSnapshot = {
  name: `New Session ${new Date(Date.now()).toISOString()}`,
  menuBars: [
    {
      type: 'MainMenuBar',
      menus: [
        {
          name: 'File',
          menuItems: [
            {
              name: 'Back to Welcome Screen',
              icon: 'arrow_back',
              callback:
                'function(session) {session.activateSession(undefined)}',
            },
            {
              name: 'New linear genome view',
              icon: 'line_style',
              callback:
                "function(session) { session.addView('LinearGenomeView', {})}",
            },
            {
              name: 'New circular view',
              icon: 'data_usage',
              callback:
                "function(session) { session.addView('CircularView', {})}",
            },
            {
              name: 'New SV inspector',
              icon: 'table_chart',
              callback:
                "function(session) { session.addView('SvInspectorView', {})}",
            },
            {
              name: 'Open tabular data',
              icon: 'view_comfy',
              callback:
                "function(session) { session.addView('SpreadsheetView', {})}",
            },
            {
              name: 'Open new track',
              icon: 'note_add',
              callback: `function(session) {
const drawerWidget = session.addDrawerWidget(
      'AddTrackDrawerWidget',
      'addTrackDrawerWidget',
    )
    session.showDrawerWidget(drawerWidget)`,
            },
            {
              name: 'Open new connection',
              icon: 'input',
              callback: `function(session) {
const drawerWidget = session.addDrawerWidget(
      'AddConnectionDrawerWidget',
      'addConnectionDrawerWidget',
    )
    session.showDrawerWidget(drawerWidget)`,
            },
          ],
        },
        {
          name: 'Help',
          menuItems: [
            {
              name: 'About',
              icon: 'info',
              callback: 'openAbout',
            },
            {
              name: 'Help',
              icon: 'help',
              callback: 'openHelp',
            },
          ],
        },
      ],
    },
  ],
  connections: {},
}

export function NewEmptySession({ root }) {
  function onClick() {
    root.activateSession(emptySessionSnapshot)
  }
  return <NewSessionCard name="Empty" onClick={onClick} image={emptyIcon} />
}

NewEmptySession.propTypes = {
  root: MobxPropTypes.objectOrObservableObject.isRequired,
}

export function NewLinearGenomeViewSession({ root }) {
  const launchLGVSession = () => {
    const snapshot = {
      ...emptySessionSnapshot,
      name: `New Linear Genome View Session ${new Date(
        Date.now(),
      ).toISOString()}`,
      views: [{ type: 'LinearGenomeView' }],
    }
    root.activateSession(snapshot)
  }

  return (
    <NewSessionCard
      name="Linear Genome View"
      onClick={launchLGVSession}
      image={linearGenomeViewIcon}
    />
  )
}

NewLinearGenomeViewSession.propTypes = {
  root: MobxPropTypes.objectOrObservableObject.isRequired,
}

export function NewSVInspectorSession({ root }) {
  const launchSVSession = () => {
    const snapshot = {
      ...emptySessionSnapshot,
      name: `New SV Inspector Session ${new Date(Date.now()).toISOString()}`,
      views: [
        {
          type: 'SvInspectorView',
        },
      ],
    }
    root.activateSession(snapshot)
  }
  return (
    <NewSessionCard
      name="Structural Variant Inspector"
      onClick={launchSVSession}
      style={{ padding: 0 }}
      image={svInspectorIcon}
    />
  )
}

NewSVInspectorSession.propTypes = {
  root: MobxPropTypes.objectOrObservableObject.isRequired,
}
