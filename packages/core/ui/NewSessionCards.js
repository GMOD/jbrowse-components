import Card from '@material-ui/core/Card'
import CardMedia from '@material-ui/core/CardMedia'
import Container from '@material-ui/core/Container'
import { makeStyles } from '@material-ui/core/styles'
import Typography from '@material-ui/core/Typography'
import { PropTypes as MobxPropTypes } from 'mobx-react'
import { getSnapshot } from 'mobx-state-tree'
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
  name: `New session ${new Date().toLocaleString()}`,
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

export function ProceedEmptySession({ root }) {
  function onClick() {
    console.log('I clicked')
    const lastAutosave = localStorage.getItem(`autosave-${root.configPath}`)
    if (lastAutosave) {
      localStorage.setItem(`previousAutosave-${root.configPath}`, lastAutosave)
    }
    root.setDefaultSession()
    // root.loadAutosaveSession()
  }
  return <NewSessionCard name="Empty" onClick={onClick} image={emptyIcon} />
}
ProceedEmptySession.propTypes = {
  root: MobxPropTypes.objectOrObservableObject.isRequired,
}

export function AddLinearGenomeViewToSession({ root }) {
  const launchLGV = () => {
    // console.log('add lgv', root)
    // root.session.addView('LinearGenomeView', {})
    // const snapshot = getSnapshot(root?.session)
    // console.log(snapshot)
    // root.addSavedSession({ name: snapshot.name })

    // // localStorage.setItem(snapshot.id, { session: root.session })
    // localStorage.setItem(
    //   `autosave-${root.configPath}`,
    //   JSON.stringify({
    //     session: {
    //       ...snapshot,
    //       name: `${snapshot.name}-autosaved`,
    //     },
    //   }),
    // )
    // sessionStorage.setItem('current', JSON.stringify({ session: root.session }))
    // root.setSession(snapshot)
    // console.log(root)
    console.log('add lgv', root)
    root.session.addView('LinearGenomeView', {})
    const snapshot = getSnapshot(root?.session)
    console.log(snapshot)

    // root.addSavedSession({ name: snapshot.name })

    localStorage.setItem(
      `autosave-${root.configPath}`,
      JSON.stringify({
        session: {
          ...snapshot,
          name: `${snapshot.name}-autosaved`,
        },
      }),
    )
    sessionStorage.setItem('current', JSON.stringify({ session: root.session }))
    console.log(localStorage.getItem(`autosave-${root.configPath}`))
    const newSessionSnapshot = localStorage.getItem(
      `autosave-${root.configPath}`,
    )
    console.log(JSON.parse(newSessionSnapshot).session)
    root.setSession(JSON.parse(newSessionSnapshot).session)
  }

  return (
    <NewSessionCard
      name="Linear Genome View"
      onClick={launchLGV}
      image={linearGenomeViewIcon}
    />
  )
}
AddLinearGenomeViewToSession.propTypes = {
  root: MobxPropTypes.objectOrObservableObject.isRequired,
}

export function NewLinearGenomeViewSession({ root }) {
  const launchLGVSession = () => {
    const snapshot = {
      ...emptySessionSnapshot,
      name: `New session ${new Date().toLocaleString()}`,
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
      name: `New session ${new Date().toLocaleString()}`,
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

export function AddSVInspectorToSession({ root }) {
  const launchSVSession = () => {
    console.log('add svi', root)
    root.session.addView('SvInspectorView', {})
    const snapshot = getSnapshot(root?.session)
    console.log(snapshot)
    root.addSavedSession({ name: snapshot.name })
    localStorage.setItem(snapshot.id, { session: snapshot })
    sessionStorage.setItem('current', JSON.stringify({ session: snapshot }))
    root.setSession(snapshot)
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

AddSVInspectorToSession.propTypes = {
  root: MobxPropTypes.objectOrObservableObject.isRequired,
}
