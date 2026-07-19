import { useState } from 'react'

import BaseResult from '@jbrowse/core/TextSearch/BaseResults'
import {
  AssemblySelector,
  ErrorBanner,
  RefNameAutocomplete,
  useAssemblySelection,
  useRecentLocations,
} from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import CloseIcon from '@mui/icons-material/Close'
import {
  Button,
  Chip,
  CircularProgress,
  Container,
  Grid,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import { fetchResults, navigateToSelectedOption } from '../../searchUtils.ts'

import type { LinearGenomeViewModel } from '../index.ts'

const useStyles = makeStyles()(theme => ({
  importFormContainer: {
    padding: theme.spacing(4),
  },
  button: {
    margin: theme.spacing(2),
  },
  recent: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing(2),
  },
}))

const LinearGenomeViewImportForm = observer(
  function LinearGenomeViewImportForm({
    model,
  }: {
    model: LinearGenomeViewModel
  }) {
    const { classes } = useStyles()
    const session = getSession(model)
    const { textSearchManager } = session
    const { error: viewError } = model
    const {
      selectedAssemblyName: selectedAsm,
      setSelectedAssemblyName,
      assembly,
      assemblyError,
      regions,
    } = useAssemblySelection(session, 'lgv')
    const { recentLocations, addRecentLocation, clearRecentLocations } =
      useRecentLocations(selectedAsm)

    // the location the form will open; the input starts on the first refname
    // and is replaced by whatever the user types or picks
    const [selectedOption, setSelectedOption] = useState<BaseResult>()
    const [inputText, setInputText] = useState<string>()

    const value = inputText ?? regions?.[0]?.refName ?? ''
    const displayError = assemblyError ?? viewError

    async function navigate(loc: string, option?: BaseResult) {
      model.setError(undefined)
      if (loc && selectedAsm) {
        try {
          await navigateToSelectedOption({
            option: option ?? new BaseResult({ label: loc }),
            model,
            assemblyName: selectedAsm,
          })
          addRecentLocation(loc)
        } catch (e) {
          console.error(e)
          session.notify(`${e}`, 'warning')
        }
      }
    }

    return (
      <Container className={classes.importFormContainer}>
        {displayError ? <ErrorBanner error={displayError} /> : null}
        <form
          onSubmit={async event => {
            event.preventDefault()
            await navigate(value, selectedOption)
          }}
        >
          <Grid
            container
            spacing={1}
            sx={{ justifyContent: 'center', alignItems: 'center' }}
          >
            <AssemblySelector
              onChange={val => {
                setSelectedAssemblyName(val)
                setInputText(undefined)
                setSelectedOption(undefined)
              }}
              session={session}
              selected={selectedAsm}
            />
            {selectedAsm ? (
              assemblyError ? (
                <CloseIcon color="error" />
              ) : regions ? (
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
              ) : (
                <CircularProgress size={20} disableShrink />
              )
            ) : null}
            <Button
              type="submit"
              disabled={!value}
              className={classes.button}
              variant="contained"
              color="primary"
            >
              Open
            </Button>
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
          </Grid>
        </form>
        {recentLocations.length ? (
          <div className={classes.recent}>
            <Typography variant="caption" color="textSecondary">
              Recent
            </Typography>
            {recentLocations.map(loc => (
              <Chip
                key={loc}
                label={loc}
                size="small"
                onClick={() => navigate(loc)}
              />
            ))}
            <Button size="small" onClick={clearRecentLocations}>
              Clear
            </Button>
          </div>
        ) : null}
      </Container>
    )
  },
)

export default LinearGenomeViewImportForm
