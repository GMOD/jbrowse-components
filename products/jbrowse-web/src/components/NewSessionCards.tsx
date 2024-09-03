import React, { useState } from 'react'
import { Card, CardMedia, Container, Typography } from '@mui/material'
import { makeStyles } from 'tss-react/mui'

import { emptyIcon, linearGenomeViewIcon, svInspectorIcon } from './img'

const useStyles = makeStyles()({
  card: {
    width: 200,
    height: 150,
    cursor: 'pointer',
  },
  name: {
    marginTop: 4, // theme.spacing(),
    textAlign: 'center',
    maxWidth: 200,
  },
  media: {
    height: 150,
  },
})

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
  image?: string
}) {
  const { classes } = useStyles()
  const [hovered, setHovered] = useState(false)
  return (
    <Container>
      <Card
        className={classes.card}
        onMouseOver={() => {
          setHovered(true)
        }}
        onMouseOut={() => {
          setHovered(false)
        }}
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
  setSession: (arg: unknown) => void
}

export function NewEmptySession({ rootModel }: { rootModel: RootModel }) {
  return (
    <NewSessionCard
      name="Empty"
      image={emptyIcon}
      onClick={() => {
        rootModel.setSession(emptySessionSnapshot)
      }}
    />
  )
}

export function NewLinearGenomeViewSession({
  rootModel,
}: {
  rootModel: RootModel
}) {
  return (
    <NewSessionCard
      name="Linear Genome View"
      image={linearGenomeViewIcon}
      onClick={() => {
        rootModel.setSession({
          ...emptySessionSnapshot,
          name: `New session ${new Date().toLocaleString()}`,
          views: [{ type: 'LinearGenomeView' }],
        })
      }}
    />
  )
}

export function NewSVInspectorSession({ rootModel }: { rootModel: RootModel }) {
  return (
    <NewSessionCard
      name="Structural Variant Inspector"
      image={svInspectorIcon}
      onClick={() => {
        rootModel.setSession({
          ...emptySessionSnapshot,
          name: `New session ${new Date().toLocaleString()}`,
          views: [{ type: 'SvInspectorView' }],
        })
      }}
    />
  )
}
