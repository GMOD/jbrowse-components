import { useState } from 'react'

import { AssemblySelector, ErrorMessage } from '@jbrowse/core/ui'
import { getSession, isSessionWithAddTracks } from '@jbrowse/core/util'
import {
  Button,
  Container,
  FormControl,
  Grid,
  Paper,
  Typography,
} from '@mui/material'
import { toJS, transaction } from 'mobx'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

import TrackSelector from './TrackSelector'

import type { DotplotViewModel } from '../../model'

const useStyles = makeStyles()(theme => ({
  importFormContainer: {
    padding: theme.spacing(4),
    margin: '0 auto',
  },
}))

function doSubmit({
  model,
  assembly1,
  assembly2,
}: {
  assembly1: string
  assembly2: string
  model: DotplotViewModel
}) {
  const session = getSession(model)
  const { importFormSyntenyTrackSelections } = model

  model.setError(undefined)
  transaction(() => {
    if (isSessionWithAddTracks(session)) {
      toJS(importFormSyntenyTrackSelections).map((f, idx) => {
        if (f.type === 'userOpened') {
          session.addTrackConf(f.value)
          model.toggleTrack(f.value?.trackId)
        } else if (f.type === 'preConfigured') {
          model.showTrack(f.value, idx)
        }
      })
    }

    model.setAssemblyNames(assembly2, assembly1)

    // Only show all regions if views are properly initialized
    // Otherwise the autorun will handle it once initialization is complete
    // if (
    //   model.volatileWidth !== undefined &&
    //   model.assembliesInitialized &&
    //   model.hview.displayedRegions.length > 0 &&
    //   model.vview.displayedRegions.length > 0
    // ) {
    //   model.showAllRegions()
    // }
  })
}

const DotplotImportForm = observer(function ({
  model,
}: {
  model: DotplotViewModel
}) {
  const { classes } = useStyles()
  const session = getSession(model)
  const { assemblyNames } = session
  const [assembly2, setAssembly2] = useState(assemblyNames[0] || '')
  const [assembly1, setAssembly1] = useState(assemblyNames[0] || '')
  const [error, setError] = useState<unknown>()

  // this is a combination of any displayed error message we have
  const displayError = error || model.error
  return (
    <Container className={classes.importFormContainer}>
      {displayError ? <ErrorMessage error={displayError} /> : null}

      <Paper style={{ padding: 12 }}>
        <Typography style={{ textAlign: 'center' }}>
          Select assemblies for dotplot view
        </Typography>
        <Grid container spacing={1} justifyContent="center" alignItems="center">
          <AssemblySelector
            helperText="x-axis assembly"
            selected={assembly2}
            session={session}
            onChange={val => {
              setAssembly2(val)
            }}
          />
          <AssemblySelector
            helperText="y-axis assembly"
            selected={assembly1}
            session={session}
            onChange={val => {
              setAssembly1(val)
            }}
          />
          <FormControl>
            <Button
              onClick={() => {
                // eslint-disable-next-line @typescript-eslint/no-floating-promises
                ;(async () => {
                  try {
                    setError(undefined)
                    doSubmit({
                      assembly1,
                      assembly2,
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
          </FormControl>
        </Grid>
        <TrackSelector
          assembly2={assembly2}
          assembly1={assembly1}
          model={model}
        />
      </Paper>
    </Container>
  )
})

export default DotplotImportForm
