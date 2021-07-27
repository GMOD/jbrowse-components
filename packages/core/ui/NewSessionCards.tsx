import React, { useState } from 'react'
import {
  Card,
  CardMedia,
  Container,
  Typography,
  makeStyles,
} from '@material-ui/core'

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

const emptySessionSnapshot = {
  name: `New session ${new Date().toLocaleString()}`,
  connections: {},
}

function NewSessionCard({
  name,
  onClick = () => {},
  image,
}: {
  name: string
  onClick: () => void
  image: string
}) {
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
      </Card>
      <Typography
        variant="subtitle2"
        className={classes.name}
        style={{ cursor: 'pointer' }}
        onClick={onClick}
      >
        {name}
      </Typography>
    </Container>
  )
}

interface RootModel {
  setSession: Function
}

export function NewEmptySession({ root }: { root: RootModel }) {
  return (
    <NewSessionCard
      name="Empty"
      onClick={() => {
        root.setSession(emptySessionSnapshot)
      }}
      image={emptyIcon}
    />
  )
}

export function NewLinearGenomeViewSession({ root }: { root: RootModel }) {
  return (
    <NewSessionCard
      name="Linear Genome View"
      onClick={() => {
        root.setSession({
          ...emptySessionSnapshot,
          name: `New session ${new Date().toLocaleString()}`,
          views: [{ type: 'LinearGenomeView' }],
        })
      }}
      image={linearGenomeViewIcon}
    />
  )
}

export function NewSVInspectorSession({ root }: { root: RootModel }) {
  return (
    <NewSessionCard
      name="Structural Variant Inspector"
      onClick={() => {
        root.setSession({
          ...emptySessionSnapshot,
          name: `New session ${new Date().toLocaleString()}`,
          views: [{ type: 'SvInspectorView' }],
        })
      }}
      image={svInspectorIcon}
    />
  )
}
