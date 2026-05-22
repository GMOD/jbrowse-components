import { useState } from 'react'

import { ErrorBanner, FileSelector } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { getFileName } from '@jbrowse/core/util/tracks'
import { Box, Button, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import { doSubmit } from './doSubmit.tsx'

import type { LinearSyntenyViewModel } from '../../model.ts'
import type { FileLocation } from '@jbrowse/core/util/types'

function detectFormatFromName(name: string): string {
  const lower = name.toLowerCase()
  if (lower.endsWith('.pif.gz')) {
    return 'Multi-tier PIF'
  }
  if (lower.endsWith('.paf') || lower.endsWith('.paf.gz')) {
    return 'PAF'
  }
  return 'Unknown'
}

function getAdapterType(format: string) {
  if (format === 'Multi-tier PIF') {
    return 'PairwiseIndexedPAFAdapter'
  }
  return 'PAFAdapter'
}

const QuickImportPanel = observer(function QuickImportPanel({
  model,
}: {
  model: LinearSyntenyViewModel
}) {
  const [fileLocation, setFileLocation] = useState<FileLocation>()
  const [indexFileLocation, setIndexFileLocation] = useState<FileLocation>()
  const [error, setError] = useState<unknown>()
  const session = getSession(model)

  const fileName = fileLocation ? getFileName(fileLocation) : ''
  const format = fileName ? detectFormatFromName(fileName) : ''
  const isPif = format === 'Multi-tier PIF'

  const handleLaunch = async () => {
    try {
      setError(undefined)

      if (!fileLocation) {
        throw new Error('Please select a synteny data file')
      }

      const assemblyNames = session.assemblyNames.slice(0, 2)

      if (assemblyNames.length < 2) {
        throw new Error(
          'Need at least 2 assemblies. Please add assemblies to your session first.',
        )
      }

      const adapterType = getAdapterType(format)
      const trackId = `quickimport-${Date.now()}-sessionTrack`

      if (adapterType === 'PairwiseIndexedPAFAdapter') {
        const [asm1, asm2] = [assemblyNames[0]!, assemblyNames[1]!]
        model.setImportFormSyntenyTrack(0, {
          type: 'userOpened',
          value: {
            trackId,
            name: `${fileName || 'synteny'} (${asm1} vs ${asm2})`,
            assemblyNames: [asm1, asm2],
            type: 'SyntenyTrack',
            adapter: {
              type: 'PairwiseIndexedPAFAdapter',
              pifGzLocation: fileLocation,
              index: { location: indexFileLocation },
              assemblyNames: [asm1, asm2],
            },
          },
        })
        await doSubmit({ selectedAssemblyNames: assemblyNames, model })
      } else {
        model.setImportFormSyntenyTrack(0, {
          type: 'userOpened',
          value: {
            trackId,
            name: fileName || 'synteny',
            assemblyNames: [assemblyNames[0]!, assemblyNames[1]!],
            type: 'SyntenyTrack',
            adapter: {
              type: 'PAFAdapter',
              pafLocation: fileLocation,
              queryAssembly: assemblyNames[0]!,
              targetAssembly: assemblyNames[1]!,
            },
          },
        })
        await doSubmit({
          selectedAssemblyNames: assemblyNames.slice(0, 2),
          model,
        })
      }
    } catch (e) {
      console.error(e)
      setError(e)
    }
  }

  return (
    <Box sx={{ p: 2 }}>
      {error ? <ErrorBanner error={error} /> : null}

      <Typography variant="body2" sx={{ mb: 2 }}>
        Select a synteny data file to auto-configure the view. Supported
        formats: .pif.gz, .paf
      </Typography>

      <Box sx={{ mb: 2 }}>
        <FileSelector
          name="Synteny data file"
          description=""
          location={fileLocation}
          setLocation={loc => {
            setFileLocation(loc)
          }}
        />
      </Box>

      {isPif ? (
        <Box sx={{ mb: 2 }}>
          <FileSelector
            name="Index file (.tbi or .csi)"
            description=""
            location={indexFileLocation}
            setLocation={setIndexFileLocation}
          />
        </Box>
      ) : null}

      {format && format !== 'Unknown' ? (
        <Typography variant="body2" sx={{ mb: 2 }}>
          Detected format: <strong>{format}</strong>
        </Typography>
      ) : null}

      <Button
        variant="contained"
        color="primary"
        disabled={!fileLocation}
        onClick={() => {
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          handleLaunch()
        }}
      >
        Launch
      </Button>
    </Box>
  )
})

export default QuickImportPanel
