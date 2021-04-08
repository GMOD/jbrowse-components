import React, { useState } from 'react'
import {
  Card,
  CardMedia,
  Container,
  Typography,
  makeStyles,
} from '@material-ui/core'

// @ts-ignore
import emptyIcon from './emptyIcon.png'
// @ts-ignore
import linearGenomeViewIcon from './linearGenomeViewIcon.png'
// @ts-ignore
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
      <Typography variant="subtitle2" className={classes.name}>
        {name}
      </Typography>
    </Container>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function NewEmptySession({ root }: { root: any }) {
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function NewLinearGenomeViewSession({ root }: { root: any }) {
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function NewSVInspectorSession({ root }: { root: any }) {
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
