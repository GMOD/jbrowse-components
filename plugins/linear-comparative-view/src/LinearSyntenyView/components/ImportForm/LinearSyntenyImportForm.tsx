import { useState } from 'react'

import { ErrorBanner } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Container } from '@mui/material'
import { observer } from 'mobx-react'

import ImportSyntenyTrackSelector from './ImportSyntenyTrackSelectorArea.tsx'
import LeftPanel from './LeftPanel.tsx'
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
    const [selectedRow, setSelectedRow] = useState(0)
    const [selectedAssemblyNames, setSelectedAssemblyNames] = useState([
      defaultAssemblyName,
      defaultAssemblyName,
    ])
    const [error, setError] = useState<unknown>()

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

    return (
      <Container className={classes.importFormContainer}>
        {error ? <ErrorBanner error={error} /> : null}
        <div className={classes.flex}>
          <div className={classes.leftPanel}>
            <LeftPanel
              model={model}
              selectedAssemblyNames={selectedAssemblyNames}
              setSelectedAssemblyNames={setSelectedAssemblyNames}
              selectedRow={selectedRow}
              setSelectedRow={setSelectedRow}
              defaultAssemblyName={defaultAssemblyName}
              onLaunch={() => {
                void handleLaunch()
              }}
            />
          </div>
          <div className={classes.rightPanel}>
            <div>
              Synteny dataset to display between row {selectedRow + 1} and{' '}
              {selectedRow + 2}
            </div>
            <ImportSyntenyTrackSelector
              key={selectedRow}
              model={model}
              selectedRow={selectedRow}
              assembly1={selectedAssemblyNames[selectedRow]!}
              assembly2={selectedAssemblyNames[selectedRow + 1]!}
            />
          </div>
        </div>
      </Container>
    )
  },
)

export default LinearSyntenyViewImportForm
