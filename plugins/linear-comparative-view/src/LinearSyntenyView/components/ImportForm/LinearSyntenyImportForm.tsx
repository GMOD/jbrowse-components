import React, { useState } from 'react'
import {
  Button,
  Container,
  FormControl,
  Grid,
  IconButton,
  Paper,
} from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { observer } from 'mobx-react'
import { AnyConfigurationModel } from '@jbrowse/core/configuration'
import { SnapshotIn } from 'mobx-state-tree'
import { getSession, isSessionWithAddTracks } from '@jbrowse/core/util'
import { ErrorMessage, AssemblySelector } from '@jbrowse/core/ui'
// icons
import ArrowForward from '@mui/icons-material/ArrowForward'
import ArrowBack from '@mui/icons-material/ArrowBack'
// locals
import { LinearSyntenyViewModel } from '../../model'
import TrackSelector from './LinearSyntenyImportFormTrackSelectorUtil'

const useStyles = makeStyles()(theme => ({
  importFormContainer: {
    padding: theme.spacing(4),
    margin: '0 auto',
  },
  assemblySelector: {
    width: '75%',
    margin: '0 auto',
  },
}))

type Conf = SnapshotIn<AnyConfigurationModel>

const LinearSyntenyViewImportForm = observer(function ({
  model,
}: {
  model: LinearSyntenyViewModel
}) {
  const { classes } = useStyles()
  const session = getSession(model)
  const { assemblyNames } = session
  const [currIdx, setCurrIdx] = useState(0)
  const [assemblies, setAssemblies] = useState([
    assemblyNames[0] || '',
    assemblyNames[0] || '',
  ])
  const [error, setError] = useState<unknown>()
  const [sessionTrackData, setSessionTrackData] = useState<
    (Conf | undefined)[]
  >([])
  const [showTrackId, setShowTrackId] = useState<(string | undefined)[]>([])

  // this is a combination of any displayed error message we have
  const displayError = error
  return (
    <Container className={classes.importFormContainer}>
      {displayError ? <ErrorMessage error={displayError} /> : null}
      <Grid
        container
        spacing={1}
        justifyContent="center"
        alignItems="center"
        className={classes.assemblySelector}
      >
        <Grid item>
          <Paper style={{ padding: 12 }}>
            <p style={{ textAlign: 'center' }}>
              Select assemblies for linear synteny view
            </p>
            <>
              {assemblies.map((assembly, idx) => (
                <div key={`${assembly}-${idx}`}>
                  <span>Row {idx + 1}: </span>
                  <AssemblySelector
                    selected={assembly}
                    onChange={newValue => {
                      setAssemblies(
                        assemblies.map((value, index) =>
                          index === idx ? newValue : value,
                        ),
                      )
                    }}
                    session={session}
                  />
                </div>
              ))}
              <Button
                variant="contained"
                color="secondary"
                onClick={() => {
                  setAssemblies([...assemblies, assemblyNames[0] || ''])
                }}
              >
                Add row
              </Button>
              <div>
                <FormControl>
                  <Button
                    onClick={async () => {
                      try {
                        if (!isSessionWithAddTracks(session)) {
                          return
                        }
                        setError(undefined)

                        const { assemblyManager } = session
                        model.setViews(
                          await Promise.all(
                            assemblies.map(async sel => {
                              const asm =
                                await assemblyManager.waitForAssembly(sel)
                              if (!asm) {
                                throw new Error(
                                  `Assembly ${sel} failed to load`,
                                )
                              }
                              return {
                                type: 'LinearGenomeView' as const,
                                bpPerPx: 1,
                                offsetPx: 0,
                                hideHeader: true,
                                displayedRegions: asm.regions,
                              }
                            }),
                          ),
                        )
                        model.views.forEach(view => {
                          view.setWidth(model.width)
                        })
                        model.views.forEach(view => {
                          view.showAllRegions()
                        })
                        sessionTrackData.map((f, idx) => {
                          if (f) {
                            session.addTrackConf(f)
                            model.toggleTrack(f.trackId, idx)
                          }
                        })
                        showTrackId.map((f, idx) => {
                          if (f) {
                            model.showTrack(f, idx)
                          }
                        })
                      } catch (e) {
                        console.error(e)
                        setError(e)
                      }
                    }}
                    variant="contained"
                    color="primary"
                  >
                    Launch
                  </Button>
                </FormControl>
              </div>
            </>
          </Paper>
          <IconButton
            disabled={currIdx <= 0}
            onClick={() => {
              setCurrIdx(currIdx - 1)
            }}
          >
            <ArrowBack />
          </IconButton>
          <IconButton
            disabled={currIdx >= assemblies.length - 2}
            onClick={() => {
              setCurrIdx(currIdx + 1)
            }}
          >
            <ArrowForward />
          </IconButton>
          <TrackSelector
            idx={currIdx + 1}
            setShowTrackId={arg => {
              const clone = [...showTrackId]
              clone[currIdx] = arg
              setShowTrackId(clone)
            }}
            assembly1={assemblies[currIdx]!}
            assembly2={assemblies[currIdx + 1]!}
            setSessionTrackData={arg => {
              const clone = [...sessionTrackData]
              clone[currIdx] = arg
              setSessionTrackData(clone)
            }}
            sessionTrackData={sessionTrackData[currIdx]}
            model={model}
          />
        </Grid>
      </Grid>
    </Container>
  )
})

export default LinearSyntenyViewImportForm
