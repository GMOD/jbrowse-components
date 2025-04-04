import { useEffect, useState } from 'react'

import { AssemblySelector, ErrorMessage } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import CloseIcon from '@mui/icons-material/Close'
import {
  Button,
  CircularProgress,
  Container,
  FormControl,
  Grid as Grid,
} from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

import ImportFormRefNameAutocomplete from './ImportFormRefNameAutocomplete'
import { handleSelectedRegion, navToOption } from '../../searchUtils'

import type { LinearGenomeViewModel } from '..'
import type BaseResult from '@jbrowse/core/TextSearch/BaseResults'

const useStyles = makeStyles()(theme => ({
  importFormContainer: {
    padding: theme.spacing(2),
  },
  button: {
    margin: theme.spacing(2),
  },
  container: {
    padding: theme.spacing(4),
  },
}))

type LGV = LinearGenomeViewModel

const LinearGenomeViewImportForm = observer(function ({
  model,
}: {
  model: LGV
}) {
  const { classes } = useStyles()
  const session = getSession(model)
  const { assemblyNames, assemblyManager } = session
  const { error } = model
  const [selectedAsm, setSelectedAsm] = useState(assemblyNames[0]!)
  const [option, setOption] = useState<BaseResult>()
  const assembly = assemblyManager.get(selectedAsm)
  const assemblyError = assemblyNames.length
    ? assembly?.error
    : 'No configured assemblies'
  const displayError = assemblyError || error
  const [value, setValue] = useState('')
  const regions = assembly?.regions
  const assemblyLoaded = !!regions
  const r0 = regions ? regions[0]?.refName || '' : ''

  // useEffect resets to an "initial state" of displaying first region from
  // assembly after assembly change. needs to react to selectedAsm as well as
  // r0 because changing assembly will run setValue('') and then r0 may not
  // change if assembly names are the same across assemblies, but it still
  // needs to be reset
  /* biome-ignore lint/correctness/useExhaustiveDependencies: */
  useEffect(() => {
    setValue(r0)
  }, [r0, selectedAsm])

  // implementation notes:
  // having this wrapped in a form allows intuitive use of enter key to submit
  return (
    <div className={classes.container}>
      {displayError ? <ErrorMessage error={displayError} /> : null}
      <Container className={classes.importFormContainer}>
        <form
          onSubmit={async event => {
            event.preventDefault()
            model.setError(undefined)
            if (value) {
              // has it's own error handling
              try {
                if (
                  option?.getDisplayString() === value &&
                  option.hasLocation()
                ) {
                  await navToOption({
                    option,
                    model,
                    assemblyName: selectedAsm,
                  })
                } else if (option?.results?.length) {
                  model.setSearchResults(
                    option.results,
                    option.getLabel(),
                    selectedAsm,
                  )
                } else if (assembly) {
                  await handleSelectedRegion({ input: value, assembly, model })
                }
              } catch (e) {
                console.error(e)
                session.notify(`${e}`, 'warning')
              }
            }
          }}
        >
          <Grid
            container
            spacing={1}
            justifyContent="center"
            alignItems="center"
          >
            <FormControl>
              <AssemblySelector
                onChange={val => {
                  setSelectedAsm(val)
                }}
                localStorageKey="lgv"
                session={session}
                selected={selectedAsm}
              />
            </FormControl>
            {selectedAsm ? (
              assemblyError ? (
                <CloseIcon style={{ color: 'red' }} />
              ) : assemblyLoaded ? (
                <FormControl>
                  <ImportFormRefNameAutocomplete
                    value={value}
                    setValue={setValue}
                    selectedAsm={selectedAsm}
                    setOption={setOption}
                    model={model}
                  />
                </FormControl>
              ) : (
                <CircularProgress size={20} disableShrink />
              )
            ) : null}
            <FormControl>
              <Button
                type="submit"
                disabled={!value}
                className={classes.button}
                variant="contained"
                color="primary"
              >
                Open
              </Button>
            </FormControl>
            <FormControl>
              <Button
                disabled={!value}
                className={classes.button}
                onClick={() => {
                  model.setError(undefined)
                  model.showAllRegionsInAssembly(selectedAsm)
                }}
                variant="contained"
                color="secondary"
              >
                Show all regions in assembly
              </Button>
            </FormControl>
          </Grid>
        </form>
      </Container>
    </div>
  )
})

export default LinearGenomeViewImportForm
