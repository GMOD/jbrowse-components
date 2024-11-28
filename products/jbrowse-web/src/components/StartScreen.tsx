import React, { lazy, useEffect, useState } from 'react'

import { ErrorMessage, LogoFull } from '@jbrowse/core/ui'
import { localStorageGetItem, notEmpty } from '@jbrowse/core/util'
import SettingsIcon from '@mui/icons-material/Settings'
import WarningIcon from '@mui/icons-material/Warning'
import {
  Container,
  Grid,
  IconButton,
  List,
  ListItemIcon,
  ListSubheader,
  Menu,
  MenuItem,
  Typography,
} from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { observer } from 'mobx-react'

import {
  NewEmptySession,
  NewLinearGenomeViewSession,
  NewSVInspectorSession,
} from './NewSessionCards'
import RecentSessionCard from './RecentSessionCard'

import type { WebRootModel } from '../rootModel/rootModel'

// lazies
const DeleteSessionDialog = lazy(() => import('./DeleteSessionDialog'))
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
    margin: 8, // theme.spacing(2),
  },
  settings: {
    float: 'right',
  },
  list: {
    overflow: 'auto',
    maxHeight: 200,
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

  const [sessionNames, setSessionNames] = useState<string[]>([])
  const [sessionToDelete, setSessionToDelete] = useState<string>()
  const [sessionToLoad, setSessionToLoad] = useState<string>()
  const [error, setError] = useState<unknown>()
  const [updateSessionsList, setUpdateSessionsList] = useState(true)
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null)
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
      {sessionToDelete ? (
        <React.Suspense fallback={null}>
          <DeleteSessionDialog
            rootModel={rootModel}
            sessionToDelete={sessionToDelete}
            onClose={update => {
              setSessionToDelete(undefined)
              setUpdateSessionsList(update)
            }}
          />
        </React.Suspense>
      ) : null}
      <IconButton
        className={classes.settings}
        onClick={event => {
          event.stopPropagation()
          setMenuAnchorEl(event.currentTarget)
        }}
      >
        <SettingsIcon />
      </IconButton>
      <Container maxWidth="md">
        <LogoFull />
        <div className={classes.newSession}>
          <Typography variant="h5" className={classes.header}>
            Start a new session
          </Typography>
          <Grid container spacing={4}>
            <Grid item>
              <NewEmptySession rootModel={rootModel} />
            </Grid>
            <Grid item>
              <NewLinearGenomeViewSession rootModel={rootModel} />
            </Grid>
            <Grid item>
              <NewSVInspectorSession rootModel={rootModel} />
            </Grid>
          </Grid>
        </div>
        <div>
          <Typography variant="h5" className={classes.header}>
            Recent sessions
          </Typography>
          <List className={classes.list}>
            {sessionNames.map(name => (
              <RecentSessionCard
                key={name}
                sessionName={name}
                onClick={() => {
                  setSessionToLoad(name)
                }}
                onDelete={() => {
                  setSessionToDelete(name)
                }}
              />
            ))}
          </List>

          {error ? <ErrorMessage error={error} /> : null}
        </div>
      </Container>

      <Menu
        anchorEl={menuAnchorEl}
        keepMounted
        open={Boolean(menuAnchorEl)}
        onClose={() => {
          setMenuAnchorEl(null)
        }}
      >
        <ListSubheader>Advanced Settings</ListSubheader>
        <MenuItem
          onClick={() => {
            setReset(true)
            setMenuAnchorEl(null)
          }}
        >
          <ListItemIcon>
            <WarningIcon />
          </ListItemIcon>
          <Typography variant="inherit">Reset</Typography>
        </MenuItem>
      </Menu>
    </>
  )
})

export default StartScreen
