import React, { useState } from 'react'
import { Button, Container, IconButton } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { observer } from 'mobx-react'
import {
  AnyConfigurationModel,
  readConfObject,
} from '@jbrowse/core/configuration'
import { SnapshotIn } from 'mobx-state-tree'
import {
  AbstractSessionModel,
  getSession,
  isSessionWithAddTracks,
  notEmpty,
} from '@jbrowse/core/util'
import { ErrorMessage, AssemblySelector } from '@jbrowse/core/ui'
// icons
import CloseIcon from '@mui/icons-material/Close'
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos'
// locals
import { LinearSyntenyViewModel } from '../../model'
import TrackSelector from './TrackSelectorUtil'
import Spacer from './Spacer'

const useStyles = makeStyles()(theme => ({
  importFormContainer: {
    padding: theme.spacing(4),
  },
  button: {
    margin: theme.spacing(2),
  },
}))

type Conf = SnapshotIn<AnyConfigurationModel>

function getFirstApplicableTrackIfAvailable({
  session,
  assembly1,
  assembly2,
}: {
  session: AbstractSessionModel
  assembly1: string
  assembly2: string
}) {
  const { tracks = [], sessionTracks = [] } = session
  const allTracks = [...tracks, ...sessionTracks] as AnyConfigurationModel[]
  const filteredTrack = allTracks.find(track => {
    const assemblyNames = readConfObject(track, 'assemblyNames')
    return (
      assemblyNames.includes(assembly1) &&
      assemblyNames.includes(assembly2) &&
      track.type.includes('Synteny')
    )
  })
  return filteredTrack?.trackId
}

const LinearSyntenyViewImportForm = observer(function ({
  model,
}: {
  model: LinearSyntenyViewModel
}) {
  const { classes } = useStyles()
  const session = getSession(model)
  const defaultAssemblyName = session.assemblyNames[0] || ''
  const [currIdx, setCurrIdx] = useState(0)
  const [assemblyNames, setAssemblyNames] = useState([
    defaultAssemblyName,
    defaultAssemblyName,
  ])
  const [error, setError] = useState<unknown>()
  const [sessionTrackData, setSessionTrackData] = useState<
    (Conf | undefined)[]
  >([])
  const [showTrackId, setShowTrackId] = useState<(string | undefined)[]>([
    getFirstApplicableTrackIfAvailable({
      assembly1: defaultAssemblyName,
      assembly2: defaultAssemblyName,
      session,
    }),
  ])

  // this is a combination of any displayed error message we have
  return (
    <Container className={classes.importFormContainer}>
      {error ? <ErrorMessage error={error} /> : null}
      <div style={{ display: 'flex' }}>
        <Spacer />
        <div>
          <div style={{ marginBottom: 10 }}>
            Select assemblies for linear synteny view
          </div>
          {assemblyNames.map((assemblyName, idx) => (
            <div
              key={`${assemblyName}-${idx}`}
              style={{ position: 'relative' }}
            >
              <span>Row {idx + 1}: </span>

              <IconButton
                disabled={assemblyNames.length <= 2}
                onClick={() => {
                  setAssemblyNames(
                    assemblyNames
                      .map((asm, idx2) => (idx2 === idx ? undefined : asm))
                      .filter(notEmpty),
                  )
                }}
              >
                <CloseIcon />
              </IconButton>
              <AssemblySelector
                helperText=""
                selected={assemblyName}
                onChange={newAssembly => {
                  setAssemblyNames(
                    assemblyNames.map((asm, idx2) =>
                      idx2 === idx ? newAssembly : asm,
                    ),
                  )
                }}
                session={session}
              />
              {idx !== assemblyNames.length - 1 ? (
                <IconButton
                  onClick={() => {
                    setCurrIdx(idx)
                  }}
                  style={{
                    position: 'absolute',
                    top: 30,
                  }}
                >
                  <ArrowForwardIosIcon />
                </IconButton>
              ) : null}
            </div>
          ))}
          <div>
            <Button
              className={classes.button}
              variant="contained"
              color="secondary"
              onClick={() => {
                setAssemblyNames([...assemblyNames, defaultAssemblyName])
              }}
            >
              Add row
            </Button>
            <Button
              className={classes.button}
              onClick={() => {
                // eslint-disable-next-line @typescript-eslint/no-floating-promises
                ;(async () => {
                  try {
                    if (!isSessionWithAddTracks(session)) {
                      return
                    }
                    setError(undefined)
                    await doSubmit({
                      sessionTrackData,
                      showTrackId,
                      assemblyNames,
                      model,
                    })
                  } catch (e) {
                    console.error(e)
                    setError(e)
                  }
                })()
              }}
              variant="contained"
              color="primary"
            >
              Launch
            </Button>
          </div>
        </div>

        <Spacer />
        <div>
          <div>
            Synteny dataset to display between row {currIdx + 1} and{' '}
            {currIdx + 2}
          </div>
          <TrackSelector
            setShowTrackId={arg => {
              const clone = [...showTrackId]
              clone[currIdx] = arg
              setShowTrackId(clone)
            }}
            assembly1={assemblyNames[currIdx]!}
            assembly2={assemblyNames[currIdx + 1]!}
            setSessionTrackData={arg => {
              const clone = [...sessionTrackData]
              clone[currIdx] = arg
              setSessionTrackData(clone)
            }}
            sessionTrackData={sessionTrackData[currIdx]}
            model={model}
          />
        </div>
      </div>
      <Spacer />
    </Container>
  )
})

async function doSubmit({
  assemblyNames,
  model,
  showTrackId,
  sessionTrackData,
}: {
  assemblyNames: string[]
  model: LinearSyntenyViewModel
  sessionTrackData: Conf[]
  showTrackId: (string | undefined)[]
}) {
  const session = getSession(model)
  const { assemblyManager } = session

  model.setViews(
    await Promise.all(
      assemblyNames.map(async assemblyName => {
        const asm = await assemblyManager.waitForAssembly(assemblyName)
        if (!asm) {
          throw new Error(`Assembly "${assemblyName}" failed to load`)
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
  for (const view of model.views) {
    view.setWidth(model.width)
    view.showAllRegions()
  }
  if (!isSessionWithAddTracks(session)) {
    session.notify("Can't add tracks", 'warning')
  } else {
    sessionTrackData.map((f, idx) => {
      if (f) {
        session.addTrackConf(f)
        model.toggleTrack(f.trackId, idx)
      }
    })
  }
  showTrackId.map((f, idx) => {
    if (f) {
      model.showTrack(f, idx)
    }
  })
}

export default LinearSyntenyViewImportForm
