/* eslint-disable @typescript-eslint/no-explicit-any */
// import Button from '@material-ui/core/Button'
// import CircularProgress from '@material-ui/core/CircularProgress'
import Container from '@material-ui/core/Container'
// import Dialog from '@material-ui/core/Dialog'
// import DialogActions from '@material-ui/core/DialogActions'
// import DialogContent from '@material-ui/core/DialogContent'
// import DialogContentText from '@material-ui/core/DialogContentText'
// import DialogTitle from '@material-ui/core/DialogTitle'
import Grid from '@material-ui/core/Grid'
import WarningIcon from '@material-ui/icons/Warning'
import SettingsIcon from '@material-ui/icons/Settings'
import IconButton from '@material-ui/core/IconButton'
import ListItemIcon from '@material-ui/core/ListItemIcon'
import ListSubheader from '@material-ui/core/ListSubheader'
import Menu from '@material-ui/core/Menu'
import MenuItem from '@material-ui/core/MenuItem'
import { makeStyles } from '@material-ui/core/styles'
import Typography from '@material-ui/core/Typography'
import { PropTypes as MobxPropTypes } from 'mobx-react'
import PropTypes from 'prop-types'
import React, { useEffect, useState } from 'react'
import { LogoFull, FactoryResetDialog } from '@jbrowse/core/ui'
import { inDevelopment } from '@jbrowse/core/util'
import {
  ProceedEmptySession,
  AddLinearGenomeViewToSession,
  AddSVInspectorToSession,
} from '@jbrowse/core/ui/NewSessionCards'

const useStyles = makeStyles(theme => ({
  newSession: {
    backgroundColor: theme.palette.grey['300'],
    padding: theme.spacing(2),
    marginTop: theme.spacing(6),
  },
  header: {
    margin: theme.spacing(2),
  },
  settings: {
    float: 'right',
  },
}))

// const DeleteSessionDialog = ({
//   sessionToDelete,
//   onClose,
// }: {
//   sessionToDelete?: string
//   onClose: (arg0: boolean) => void
// }) => {
//   //   const ipcRenderer = window.electronBetterIpc.ipcRenderer || blankIpc
//   const [deleteSession, setDeleteSession] = useState(false)
//   useEffect(() => {
//     ;(async () => {
//       try {
//         if (deleteSession) {
//           setDeleteSession(false)
//           // what method do we call to delete a session
//           // pass in a session , sessionToDelete to delete
//           console.log(sessionToDelete)
//           onClose(true)
//         }
//       } catch (e) {
//         setDeleteSession(() => {
//           throw e
//         })
//       }
//     })()
//   }, [deleteSession, onClose, sessionToDelete])

//   return (
//     <Dialog open={!!sessionToDelete} onClose={() => onClose(false)}>
//       <DialogTitle id="alert-dialog-title">
//         {`Delete session "${sessionToDelete}"?`}
//       </DialogTitle>
//       <DialogContent>
//         <DialogContentText id="alert-dialog-description">
//           This action cannot be undone
//         </DialogContentText>
//       </DialogContent>
//       <DialogActions>
//         <Button onClick={() => onClose(false)} color="primary">
//           Cancel
//         </Button>
//         <Button
//           onClick={() => {
//             setDeleteSession(true)
//           }}
//           color="primary"
//           variant="contained"
//           autoFocus
//         >
//           Delete
//         </Button>
//       </DialogActions>
//     </Dialog>
//   )
// }

export default function StartScreen({
  root,
  pluginManager,
  bypass,
  onFactoryReset,
}: {
  root: any
  pluginManager: any
  bypass: boolean
  onFactoryReset: Function
}) {
  const classes = useStyles()

  const [sessions, setSessions] = useState<Record<string, any> | undefined>()
  // const [sessionToDelete, setSessionToDelete] = useState<string | undefined>()
  const [sessionToLoad] = useState<string | undefined>()
  const [updateSessionsList, setUpdateSessionsList] = useState(true)
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null)
  const [reset, setReset] = useState(false)

  // const sessionNames = sessions !== undefined ? Object.keys(sessions) : []
  console.log(Array.from(root.savedSessionsVolatile.values()))
  // root.setSavedSessionNames(sessionNames)
  const sortedSessions = sessions
    ? Object.entries(sessions)
        .filter(([, sessionData]: [unknown, any]) => sessionData.stats)
        .sort((a: any, b: any) => b[1].stats.mtimeMs - a[1].stats.mtimeMs)
    : []
  console.log('root', root)
  console.log('session', root.session.toJSON())
  console.log('pm', pluginManager)

  useEffect(() => {
    ;(async () => {
      try {
        const load =
          bypass && inDevelopment && sortedSessions.length
            ? sortedSessions[0][0]
            : sessionToLoad
        if (load) {
          //   root.activateSession(
          //     JSON.parse(await ipcRenderer.invoke('loadSession', load)),
          //   )
          console.log(`Hey I loaded: ${load}`)
        }
        console.log(`Hey I did not load`)
      } catch (e) {
        setSessions(() => {
          throw e
        })
      }
    })()
  }, [bypass, root, sessionToLoad, sortedSessions])

  useEffect(() => {
    ;(async () => {
      try {
        if (updateSessionsList) {
          setUpdateSessionsList(false)
        }
      } catch (e) {
        setSessions(() => {
          throw e
        })
      }
    })()
  }, [updateSessionsList])

  //   if (!sessions)
  //     return (
  //       <CircularProgress
  //         style={{
  //           position: 'fixed',
  //           top: '50%',
  //           left: '50%',
  //           marginTop: -25,
  //           marginLeft: -25,
  //         }}
  //         size={50}
  //       />
  //     )

  return (
    <>
      <FactoryResetDialog
        open={reset}
        onFactoryReset={onFactoryReset}
        onClose={() => {
          setReset(false)
        }}
      />
      {/* <DeleteSessionDialog
        sessionToDelete={sessionToDelete}
        onClose={update => {
          setSessionToDelete(undefined)
          setUpdateSessionsList(update)
        }}
      /> */}
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
              <ProceedEmptySession root={root} />
            </Grid>
            <Grid item>
              <AddLinearGenomeViewToSession root={root} />
            </Grid>
            <Grid item>
              <AddSVInspectorToSession root={root} />
            </Grid>
          </Grid>
        </div>
        <Typography variant="h5" className={classes.header}>
          Recent sessions
        </Typography>
        <Grid container spacing={4}>
          {/* {sortedSessions
            ? sortedSessions.map(([sessionName]: [string, any]) => (
                <Grid item key={sessionName}>
                  <RecentSessionCard
                    sessionName={sessionName}
                    sessionStats={sessionData.stats}
                    sessionScreenshot={sessionData.screenshot}
                    onClick={() => {
                      setSessionToLoad(sessionName)
                    }}
                    }}
                  />
                </Grid>
              ))
            : null} */}
        </Grid>
      </Container>

      <Menu
        id="simple-menu"
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
          <Typography variant="inherit">Factory Reset</Typography>
        </MenuItem>
      </Menu>
    </>
  )
}

StartScreen.propTypes = {
  root: MobxPropTypes.objectOrObservableObject.isRequired,
  bypass: PropTypes.bool.isRequired,
}
