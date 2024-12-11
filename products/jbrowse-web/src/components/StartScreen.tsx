import React, { lazy, useState } from 'react'

import { LogoFull } from '@jbrowse/core/ui'
import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import SettingsIcon from '@mui/icons-material/Settings'
import { Container, Typography } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

import {
  NewEmptySession,
  NewLinearGenomeViewSession,
  NewSVInspectorSession,
} from './NewSessionCards'

import type { WebRootModel } from '../rootModel/rootModel'

// lazies
const FactoryResetDialog = lazy(
  () => import('@jbrowse/core/ui/FactoryResetDialog'),
)

const useStyles = makeStyles()(theme => ({
  newSession: {
    backgroundColor: theme.palette.grey['300'],
    padding: 8,
    marginTop: 8,
  },
  header: {
    margin: 8,
  },
  flex: {
    display: 'flex',
    width: '100%',
  },
  settings: {
    float: 'right',
  },
}))

const StartScreen = observer(function ({
  rootModel,
  onFactoryReset,
}: {
  rootModel: WebRootModel
  onFactoryReset: () => void
}) {
  const { classes } = useStyles()
  const [reset, setReset] = useState(false)

  return (
    <>
      {reset ? (
        <React.Suspense fallback={null}>
          <FactoryResetDialog
            open={reset}
            onFactoryReset={onFactoryReset}
            onClose={() => {
              setReset(false)
            }}
          />
        </React.Suspense>
      ) : null}
      <CascadingMenuButton
        className={classes.settings}
        menuItems={[
          {
            label: 'Reset',
            onClick: () => {
              setReset(true)
            },
          },
        ]}
      >
        <SettingsIcon />
      </CascadingMenuButton>
      <Container maxWidth="md">
        <LogoFull />
        <div className={classes.newSession}>
          <Typography variant="h5" className={classes.header}>
            Start a new session
          </Typography>
          <div className={classes.flex}>
            <NewEmptySession rootModel={rootModel} />
            <NewLinearGenomeViewSession rootModel={rootModel} />
            <NewSVInspectorSession rootModel={rootModel} />
          </div>
        </div>
      </Container>
    </>
  )
})

export default StartScreen
