import { useState } from 'react'

import {
  Checkbox,
  CircularProgress,
  FormControlLabel,
  MenuItem,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'

import ErrorBanner from './ErrorBanner.tsx'
import SubmitDialog from './SubmitDialog.tsx'
import { useExportSvgPreference } from './useExportSvgPreference.ts'
import { getSession } from '../util/index.ts'

import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { ThemeOptions } from '@mui/material'

export interface BaseExportSvgOptions {
  rasterizeLayers: boolean
  format: 'svg' | 'png'
  filename: string
  themeName: string
}

function LoadingMessage({ format }: { format: string }) {
  return (
    <div>
      <CircularProgress size={20} style={{ marginRight: 20 }} />
      <Typography sx={{ display: 'inline' }}>
        Creating {format.toUpperCase()}
      </Typography>
    </div>
  )
}

export default function BaseExportSvgDialog({
  model,
  handleClose,
  exportSvg,
  children,
}: {
  model: IAnyStateTreeNode
  handleClose: () => void
  exportSvg: (opts: BaseExportSvgOptions) => Promise<void>
  children?: React.ReactNode
}) {
  const session = getSession(model)
  const offscreenCanvas = typeof OffscreenCanvas !== 'undefined'
  const [rasterizeLayers, setRasterizeLayers] = useState(offscreenCanvas)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<unknown>()
  const [format, setFormat] = useExportSvgPreference<'svg' | 'png'>(
    'format',
    'svg',
  )
  const [filename, setFilename] = useExportSvgPreference('file', 'jbrowse.svg')
  const [themeName, setThemeName] = useExportSvgPreference(
    'theme',
    session.themeName || 'default',
  )

  return (
    <SubmitDialog
      open
      title="Export image"
      submitDisabled={loading}
      onCancel={handleClose}
      onSubmit={async () => {
        setLoading(true)
        setError(undefined)
        try {
          await exportSvg({ rasterizeLayers, format, filename, themeName })
          handleClose()
        } catch (e) {
          console.error(e)
          setError(e)
        } finally {
          setLoading(false)
        }
      }}
    >
      {error ? (
        <ErrorBanner error={error} />
      ) : loading ? (
        <LoadingMessage format={format} />
      ) : null}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <TextField
          label="Filename"
          value={filename}
          onChange={event => {
            setFilename(event.target.value)
          }}
        />
        <ToggleButtonGroup
          value={format}
          exclusive
          onChange={(_event, value: 'svg' | 'png' | null) => {
            if (value) {
              setFormat(value)
              if (filename.endsWith('.svg') && value === 'png') {
                setFilename(filename.replace(/\.svg$/, '.png'))
              } else if (filename.endsWith('.png') && value === 'svg') {
                setFilename(filename.replace(/\.png$/, '.svg'))
              }
            }
          }}
          size="small"
        >
          <ToggleButton value="svg">SVG</ToggleButton>
          <ToggleButton value="png">PNG</ToggleButton>
        </ToggleButtonGroup>
      </div>
      {children}
      {session.allThemes ? (
        <div>
          <TextField
            select
            label="Theme"
            variant="outlined"
            value={themeName}
            onChange={event => {
              setThemeName(event.target.value)
            }}
          >
            {Object.entries(session.allThemes()).map(([key, val]) => (
              <MenuItem key={key} value={key}>
                {(val as ThemeOptions & { name?: string }).name ||
                  '(Unknown name)'}
              </MenuItem>
            ))}
          </TextField>
        </div>
      ) : null}
      {offscreenCanvas ? (
        <FormControlLabel
          control={
            <Checkbox
              checked={rasterizeLayers}
              onChange={() => {
                setRasterizeLayers(val => !val)
              }}
            />
          }
          label="Rasterize canvas based tracks? File may be much larger if this is turned off"
        />
      ) : (
        <Typography>
          Note: rasterizing layers not yet supported in this browser, so SVG
          size may be large
        </Typography>
      )}
    </SubmitDialog>
  )
}
