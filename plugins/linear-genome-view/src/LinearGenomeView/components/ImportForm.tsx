import { useState } from 'react'

import BaseResult from '@jbrowse/core/TextSearch/BaseResults'
import {
  AssemblySelector,
  ErrorBanner,
  RefNameAutocomplete,
  useAssemblySelection,
} from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import CloseIcon from '@mui/icons-material/Close'
import {
  Button,
  CircularProgress,
  Container,
  FormControl,
  Grid,
} from '@mui/material'
import { observer } from 'mobx-react'

import { fetchResults, navigateToSelectedOption } from '../../searchUtils.ts'

import type { LinearGenomeViewModel } from '../index.ts'

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

const LinearGenomeViewImportForm = observer(
  function LinearGenomeViewImportForm({ model }: { model: LGV }) {
    const { classes } = useStyles()
    const session = getSession(model)
    const { textSearchManager } = session
    const { initialized, error: viewError } = model
    const {
      selectedAssemblyName: selectedAsm,
      setSelectedAssemblyName,
      assembly,
      assemblyError,
      regions,
    } = useAssemblySelection(session, 'lgv')

    // the location the form will open; the input starts on the first refname
    // and is replaced by whatever the user types or picks
    const [selectedOption, setSelectedOption] = useState<BaseResult>()
    const [inputText, setInputText] = useState<string>()

    const value = inputText ?? regions?.[0]?.refName ?? ''
    const displayError = assemblyError || viewError

    return (
      <div className={classes.container}>
        {displayError ? <ErrorBanner error={displayError} /> : null}
        {initialized ? (
          <Container className={classes.importFormContainer}>
            <form
              onSubmit={async event => {
                event.preventDefault()
                model.setError(undefined)
                if (value && selectedAsm) {
                  try {
                    await navigateToSelectedOption({
                      option:
                        selectedOption ?? new BaseResult({ label: value }),
                      model,
                      assemblyName: selectedAsm,
                    })
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
                sx={{ justifyContent: 'center', alignItems: 'center' }}
              >
                <FormControl>
                  <AssemblySelector
                    onChange={val => {
                      setSelectedAssemblyName(val)
                      setInputText(undefined)
                      setSelectedOption(undefined)
                    }}
                    session={session}
                    selected={selectedAsm}
                  />
                </FormControl>
                {selectedAsm ? (
                  assemblyError ? (
                    <CloseIcon color="error" />
                  ) : regions ? (
                    <FormControl>
                      <RefNameAutocomplete
                        fetchResults={queryString =>
                          fetchResults({
                            queryString,
                            assembly,
                            textSearchManager,
                            searchScope: model.searchScope(selectedAsm),
                          })
                        }
                        session={session}
                        assemblyName={selectedAsm}
                        value={value}
                        minWidth={270}
                        onChange={v => {
                          setInputText(v)
                          setSelectedOption(undefined)
                        }}
                        onSelect={opt => {
                          setSelectedOption(opt)
                          setInputText(opt.getDisplayString())
                        }}
                        helperText="Enter sequence name, feature name, or location"
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
                    disabled={!!assemblyError || !regions}
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
        ) : null}
      </div>
    )
  },
)

export default LinearGenomeViewImportForm
