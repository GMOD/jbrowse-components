import { useState } from 'react'

import {
  CircularProgress,
  MenuItem,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import { getSession } from '../util/index.ts'
import ErrorBanner from './ErrorBanner.tsx'
import LabeledCheckbox from './LabeledCheckbox.tsx'
import SubmitDialog from './SubmitDialog.tsx'
import { useExportSvgPreference } from './useExportSvgPreference.ts'

import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

export interface BaseExportSvgOptions {
  rasterizeLayers: boolean
  format: 'svg' | 'png'
  filename: string
  themeName: string
  fontFamily: string
}

// Generic CSS families only, so exported text resolves in any SVG renderer
// (browser, Inkscape, Illustrator) without embedding a named font like Roboto.
// The 'default' sentinel is the selected default; it maps to no font-family so
// the renderer decides (see the exportSvg call below).
const DEFAULT_FONT = 'default'
const fontFamilyOptions = [
  { value: DEFAULT_FONT, label: 'Default' },
  { value: 'sans-serif', label: 'Sans-serif' },
  { value: 'serif', label: 'Serif' },
  { value: 'monospace', label: 'Monospace' },
  { value: 'system-ui, sans-serif', label: 'System UI' },
]

export default observer(function BaseExportSvgDialog({
  model,
  handleClose,
  exportSvg,
  children,
  checkboxes,
}: {
  model: IAnyStateTreeNode
  handleClose: () => void
  exportSvg: (opts: BaseExportSvgOptions) => Promise<void>
  children?: React.ReactNode
  checkboxes?: React.ReactNode
}) {
  const session = getSession(model)
  const offscreenCanvas = typeof OffscreenCanvas !== 'undefined'
  // persisted like every other option here, but still gated on the capability:
  // the checkbox isn't rendered without OffscreenCanvas, so a stored `true` must
  // not survive into a browser that can't rasterize
  const [rasterizePreference, setRasterizePreference] = useExportSvgPreference(
    'rasterize',
    true,
  )
  const rasterizeLayers = offscreenCanvas && rasterizePreference
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<unknown>()
  const [format, setFormat] = useExportSvgPreference<'svg' | 'png'>(
    'format',
    'svg',
  )
  const [filename, setFilename] = useExportSvgPreference('file', 'jbrowse.svg')
  const [themePreference, setThemeName] = useExportSvgPreference(
    'theme',
    session.themeName || 'default',
  )
  // A stored name outlives the theme it names: an admin drops an `extraThemes`
  // entry, or another JBrowse on this origin writes `svg-theme`, which has no
  // instance scope. Unguarded it draws a blank Select and makes
  // `getActiveThemeOptions` answer undefined, so the export comes out stock.
  // `session.themeName` guards the name it stores the same way.
  const allThemes = session.allThemes?.()
  const themeName = allThemes?.[themePreference]
    ? themePreference
    : session.themeName || 'default'
  const [fontFamily, setFontFamily] = useExportSvgPreference(
    'fontfamily',
    DEFAULT_FONT,
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
          await exportSvg({
            rasterizeLayers,
            format,
            filename,
            themeName,
            fontFamily: fontFamily === DEFAULT_FONT ? '' : fontFamily,
          })
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
        <div>
          <CircularProgress size={20} style={{ marginRight: 20 }} />
          <Typography sx={{ display: 'inline' }}>
            Creating {format.toUpperCase()}
          </Typography>
        </div>
      ) : null}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
        {allThemes ? (
          <TextField
            select
            label="Theme"
            variant="outlined"
            style={{ minWidth: 200 }}
            value={themeName}
            onChange={event => {
              setThemeName(event.target.value)
            }}
          >
            {Object.entries(allThemes).map(([key, val]) => (
              <MenuItem key={key} value={key}>
                {val.name || '(Unknown name)'}
              </MenuItem>
            ))}
          </TextField>
        ) : null}
        <TextField
          select
          label="Font"
          variant="outlined"
          style={{ minWidth: 200 }}
          value={fontFamily}
          onChange={event => {
            setFontFamily(event.target.value)
          }}
        >
          {fontFamilyOptions.map(({ value, label }) => (
            <MenuItem key={value} value={value}>
              {label}
            </MenuItem>
          ))}
        </TextField>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {checkboxes}
          {offscreenCanvas ? (
            <LabeledCheckbox
              checked={rasterizeLayers}
              onChange={val => {
                setRasterizePreference(val)
              }}
              label="Rasterize canvas based tracks? File may be much larger if this is turned off"
            />
          ) : (
            <Typography>
              Note: rasterizing layers not yet supported in this browser, so SVG
              size may be large
            </Typography>
          )}
        </div>
      </div>
    </SubmitDialog>
  )
})
