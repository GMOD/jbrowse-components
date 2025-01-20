import { useState } from 'react'

import { AssemblySelector, ErrorMessage } from '@jbrowse/core/ui'
import { getSession, isSessionWithAddTracks } from '@jbrowse/core/util'
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos'
import CloseIcon from '@mui/icons-material/Close'
import { Button, Container, IconButton } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

import ImportSyntenyTrackSelector from './ImportSyntenyTrackSelectorArea'
import Spacer from './Spacer'

import type { LinearSyntenyViewModel } from '../../model'

const useStyles = makeStyles()(theme => ({
  importFormContainer: {
    padding: theme.spacing(4),
  },
  button: {
    margin: theme.spacing(2),
  },
  rel: {
    position: 'relative',
  },
  synbutton: {
    position: 'absolute',
    top: 30,
  },
  flex: {
    display: 'flex',
  },
  mb: {
    marginBottom: 10,
  },
  bg: {
    background: theme.palette.divider,
  },
  fixedWidth: {
    width: 700,
  },
}))

const LinearSyntenyViewImportForm = observer(function ({
  model,
}: {
  model: LinearSyntenyViewModel
}) {
  const { classes, cx } = useStyles()
  const session = getSession(model)
  const { assemblyNames } = session
  const defaultAssemblyName = assemblyNames[0] || ''
  const [selectedRow, setSelectedRow] = useState(0)
  const [selectedAssemblyNames, setSelectedAssemblyNames] = useState([
    defaultAssemblyName,
    defaultAssemblyName,
  ])
  const [error, setError] = useState<unknown>()
  const { userOpenedSyntenyTracksToShow, preConfiguredSyntenyTracksToShow } =
    model

  return (
    <Container className={classes.importFormContainer}>
      {error ? <ErrorMessage error={error} /> : null}
      <div className={classes.flex}>
        <Spacer />
        <div>
          <div className={classes.mb}>
            Select assemblies for linear synteny view
          </div>
          {selectedAssemblyNames.map((assemblyName, idx) => (
            <div key={`${assemblyName}-${idx}`} className={classes.rel}>
              <span>Row {idx + 1}: </span>

              <IconButton
                disabled={selectedAssemblyNames.length <= 2}
                onClick={() => {
                  preConfiguredSyntenyTracksToShow.splice(idx, 1)
                  userOpenedSyntenyTracksToShow.slice(idx, 1)
                  if (selectedRow >= selectedAssemblyNames.length - 2) {
                    setSelectedRow(0)
                  }
                }}
              >
                <CloseIcon />
              </IconButton>
              <AssemblySelector
                helperText=""
                selected={assemblyName}
                onChange={newAssembly => {
                  setSelectedAssemblyNames(
                    selectedAssemblyNames.map((asm, idx2) =>
                      idx2 === idx ? newAssembly : asm,
                    ),
                  )
                }}
                session={session}
              />
              {idx !== selectedAssemblyNames.length - 1 ? (
                <IconButton
                  className={cx(
                    classes.synbutton,
                    idx === selectedRow ? classes.bg : undefined,
                  )}
                  onClick={() => {
                    setSelectedRow(idx)
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
                setSelectedAssemblyNames([
                  ...selectedAssemblyNames,
                  defaultAssemblyName,
                ])
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
                    setError(undefined)
                    await doSubmit({
                      selectedAssemblyNames,
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
        <div className={classes.fixedWidth}>
          <div>
            Synteny dataset to display between row {selectedRow + 1} and{' '}
            {selectedRow + 2}
          </div>
          <ImportSyntenyTrackSelector
            model={model}
            selectedRow={selectedRow}
            assembly1={selectedAssemblyNames[selectedRow]!}
            assembly2={selectedAssemblyNames[selectedRow + 1]!}
          />
        </div>
      </div>
      <Spacer />
    </Container>
  )
})

async function doSubmit({
  selectedAssemblyNames,
  model,
}: {
  selectedAssemblyNames: string[]
  model: LinearSyntenyViewModel
}) {
  const session = getSession(model)
  const { assemblyManager } = session
  const { preConfiguredSyntenyTracksToShow, userOpenedSyntenyTracksToShow } =
    model

  model.setViews(
    await Promise.all(
      selectedAssemblyNames.map(async assemblyName => {
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
    userOpenedSyntenyTracksToShow.map((f, idx) => {
      if (f) {
        session.addTrackConf(f)
        model.toggleTrack(f.trackId, idx)
      }
    })
  }
  preConfiguredSyntenyTracksToShow.map((f, idx) => {
    if (f) {
      model.showTrack(f, idx)
    }
  })
}

export default LinearSyntenyViewImportForm
