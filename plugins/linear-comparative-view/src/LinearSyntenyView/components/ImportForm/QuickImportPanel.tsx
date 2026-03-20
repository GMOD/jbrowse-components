import { useState } from 'react'

import { ErrorMessage, FileSelector } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  FormControlLabel,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import { doSubmit } from './doSubmit.tsx'
import { getName, stripGz } from './util.ts'

import type { LinearSyntenyViewModel } from '../../model.ts'
import type { FileLocation } from '@jbrowse/core/util/types'

interface DetectedConfig {
  assemblies: string[]
  pairs: [string, string][]
  format: string
}

function detectFormatFromName(name: string): string {
  const lower = name.toLowerCase()
  if (lower.endsWith('.pif.gz')) {
    return 'Multi-tier PIF'
  }
  if (lower.endsWith('.paf') || lower.endsWith('.paf.gz')) {
    return 'PAF'
  }
  if (lower.endsWith('.syri.out') || lower.endsWith('.syri.out.gz')) {
    return 'SyRI output'
  }
  if (lower.endsWith('.bedpe') || lower.endsWith('.bedpe.gz')) {
    return 'BEDPE'
  }
  if (lower.endsWith('.gfa') || lower.endsWith('.gfa.gz')) {
    return 'rGFA'
  }
  if (lower.endsWith('.maf') || lower.endsWith('.maf.gz')) {
    return 'MAF'
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
  const [detectedConfig, setDetectedConfig] = useState<DetectedConfig>()
  const session = getSession(model)

  const fileName = getName(fileLocation)
  const format = fileName ? detectFormatFromName(stripGz(fileName)) : ''
  const isPif = format === 'Multi-tier PIF'

  const handleLaunch = async () => {
    try {
      setError(undefined)

      if (!fileLocation) {
        throw new Error('Please select a synteny data file')
      }

      // Use detected assemblies or fall back to session assemblies
      const assemblyNames = detectedConfig?.assemblies?.length
        ? detectedConfig.assemblies
        : session.assemblyNames.slice(0, 2)

      if (assemblyNames.length < 2) {
        throw new Error(
          'Need at least 2 assemblies. Please add assemblies to your session first.',
        )
      }

      // Build adapter config based on format
      const adapterType = getAdapterType(format)
      const trackId = `quickimport-${Date.now()}-sessionTrack`

      if (adapterType === 'PairwiseIndexedPAFAdapter') {
        // For PIF files, set up one track per pair (or single track for 2 assemblies)
        const pairs = detectedConfig?.pairs ?? [
          [assemblyNames[0]!, assemblyNames[1]!] as [string, string],
        ]

        for (let i = 0; i < pairs.length; i++) {
          const [asm1, asm2] = pairs[i]!
          model.setImportFormSyntenyTrack(i, {
            type: 'userOpened',
            value: {
              trackId: `${trackId}-pair${i}`,
              name: `${fileName || 'synteny'} (${asm1} vs ${asm2})`,
              assemblyNames: [asm1, asm2],
              type: 'SyntenyTrack',
              adapter: {
                type: 'PairwiseIndexedPAFAdapter',
                pifGzLocation: fileLocation,
                index: {
                  location: indexFileLocation,
                },
                assemblyNames: [asm1, asm2],
              },
            },
          })
        }

        await doSubmit({
          selectedAssemblyNames: assemblyNames,
          model,
        })
      } else {
        // For PAF and other formats, use PAFAdapter
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
      {error ? <ErrorMessage error={error} /> : null}

      <Typography variant="body2" sx={{ mb: 2 }}>
        Select a synteny data file to auto-configure the view. Supported
        formats: .pif.gz, .paf, .syri.out, .bedpe, .gfa, .maf
      </Typography>

      <Box sx={{ mb: 2 }}>
        <FileSelector
          name="Synteny data file"
          description=""
          location={fileLocation}
          setLocation={loc => {
            setFileLocation(loc)
            setDetectedConfig(undefined)
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

      {format ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2">
            Detected format: <strong>{format}</strong>
          </Typography>
          {detectedConfig ? (
            <Box sx={{ mt: 1 }}>
              <Typography variant="body2">
                Assemblies:{' '}
                {detectedConfig.assemblies.map(a => (
                  <Chip key={a} label={a} size="small" sx={{ mr: 0.5 }} />
                ))}
              </Typography>
              <Typography variant="body2">
                Pairs:{' '}
                {detectedConfig.pairs.map(([a, b], i) => (
                  <Chip
                    key={i}
                    label={`${a} ↔ ${b}`}
                    size="small"
                    sx={{ mr: 0.5 }}
                  />
                ))}
              </Typography>
            </Box>
          ) : null}
        </Alert>
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
