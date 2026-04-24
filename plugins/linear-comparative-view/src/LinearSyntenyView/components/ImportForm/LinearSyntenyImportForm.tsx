import { useState } from 'react'

import { ErrorBanner } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import {
  Container,
  Tab,
  Tabs,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material'
import { observer } from 'mobx-react'

import ImportSyntenyTrackSelector from './ImportSyntenyTrackSelectorArea.tsx'
import PairwisePanel from './PairwisePanel.tsx'
import PangenomePanel from './PangenomePanel.tsx'
import QuickImportPanel from './QuickImportPanel.tsx'
import { doSubmit } from './doSubmit.tsx'

import type { LinearSyntenyViewModel } from '../../model.ts'

const useStyles = makeStyles()(theme => ({
  importFormContainer: {
    padding: theme.spacing(4),
  },
  flex: {
    display: 'flex',
    gap: 90,
  },
  rightPanel: {
    flexGrow: 11,
  },
  leftPanel: {
    flexGrow: 4,
    flexShrink: 0,
  },
}))

const LinearSyntenyViewImportForm = observer(
  function LinearSyntenyViewImportForm({
    model,
  }: {
    model: LinearSyntenyViewModel
  }) {
    const { classes } = useStyles()
    const session = getSession(model)
    const { assemblyNames } = session
    const defaultAssemblyName = assemblyNames[0] ?? ''
    const [selectedAssemblyNames, setSelectedAssemblyNames] = useState([
      defaultAssemblyName,
      defaultAssemblyName,
    ])
    const [error, setError] = useState<unknown>()
    const [importMode, setImportMode] = useState(0)
    const [viewMode, setViewMode] = useState<'pairwise' | 'pangenome'>(
      'pairwise',
    )

    const handleLaunch = async () => {
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
    }

    const isPairwise = viewMode === 'pairwise'

    return (
      <Container className={classes.importFormContainer}>
        {error ? <ErrorBanner error={error} /> : null}

        <ToggleButtonGroup
          value={viewMode}
          exclusive
          onChange={(_, v: 'pairwise' | 'pangenome') => {
            setViewMode(v)
          }}
          size="small"
          sx={{ mb: 2 }}
        >
          <ToggleButton value="pairwise">Pairwise synteny</ToggleButton>
          <ToggleButton value="pangenome">Pangenome / multi-way</ToggleButton>
        </ToggleButtonGroup>

        {isPairwise ? (
          <>
            <Tabs
              value={importMode}
              onChange={(_, val) => {
                setImportMode(val)
              }}
              sx={{ mb: 2 }}
            >
              <Tab label="Manual setup" />
              <Tab label="Quick import" />
            </Tabs>

            {importMode === 1 ? (
              <QuickImportPanel model={model} />
            ) : (
              <div className={classes.flex}>
                <div className={classes.leftPanel}>
                  <PairwisePanel
                    model={model}
                    selectedAssemblyNames={selectedAssemblyNames}
                    setSelectedAssemblyNames={setSelectedAssemblyNames}
                    onLaunch={() => {
                      void handleLaunch()
                    }}
                  />
                </div>
                <div className={classes.rightPanel}>
                  <div>Configure synteny data</div>
                  <ImportSyntenyTrackSelector
                    model={model}
                    selectedRow={0}
                    assembly1={selectedAssemblyNames[0]!}
                    assembly2={selectedAssemblyNames[1]!}
                  />
                </div>
              </div>
            )}
          </>
        ) : (
          <PangenomePanel model={model} />
        )}
      </Container>
    )
  },
)

export default LinearSyntenyViewImportForm
