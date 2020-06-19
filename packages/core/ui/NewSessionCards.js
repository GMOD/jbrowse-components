import Card from '@material-ui/core/Card'
import CardMedia from '@material-ui/core/CardMedia'
import Container from '@material-ui/core/Container'
import { makeStyles } from '@material-ui/core/styles'
import Typography from '@material-ui/core/Typography'
import { PropTypes as MobxPropTypes } from 'mobx-react'
import PropTypes from 'prop-types'
import React, { useState } from 'react'

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
  connections: {},
}

export function NewEmptySession({ root }) {
  function onClick() {
    root.activateSession(emptySessionSnapshot)
  }
  return <NewSessionCard name="Empty" onClick={onClick} />
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

  return <></>
}

NewLinearGenomeViewSession.propTypes = {
  root: MobxPropTypes.objectOrObservableObject.isRequired,
}

export function NewSVInspectorSession({ root }) {
  return <></>
}

NewSVInspectorSession.propTypes = {
  root: MobxPropTypes.objectOrObservableObject.isRequired,
}
