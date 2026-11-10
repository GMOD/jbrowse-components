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
import ExternalLink from './ExternalLink.tsx'
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

type ExportFormat = BaseExportSvgOptions['format'] | 'r'

const EXTENSIONS = { svg: '.svg', png: '.png', r: '.R' } as const

function withExtension(filename: string, format: ExportFormat) {
  return filename.replace(/\.(svg|png|r)$/i, EXTENSIONS[format])
}

function shellQuote(filename: string) {
  return /\s/.test(filename) ? `"${filename}"` : filename
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
  exportR,
  children,
  checkboxes,
}: {
  model: IAnyStateTreeNode
  handleClose: () => void
  exportSvg: (opts: BaseExportSvgOptions) => Promise<unknown>
  exportR?: (filename: string) => Promise<unknown>
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
  // The stored format is shared by every view's dialog, and only some views
  // offer R, so a view without it reads a stored `r` as SVG.
  const [formatPreference, setFormat] = useExportSvgPreference<ExportFormat>(
    'format',
    'svg',
  )
  const format = formatPreference === 'r' && !exportR ? 'svg' : formatPreference
  const [filenamePreference, setFilename] = useExportSvgPreference(
    'file',
    'jbrowse.svg',
  )
  const filename =
    format === formatPreference
      ? filenamePreference
      : withExtension(filenamePreference, format)
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
          if (format === 'r') {
            await exportR?.(filename)
          } else {
            await exportSvg({
              rasterizeLayers,
              format,
              filename,
              themeName,
              fontFamily: fontFamily === DEFAULT_FONT ? '' : fontFamily,
            })
          }
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
            Creating {format === 'r' ? 'R script' : format.toUpperCase()}
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
            onChange={(_event, value: ExportFormat | null) => {
              if (value) {
                setFormat(value)
                setFilename(withExtension(filename, value))
              }
            }}
            size="small"
          >
            <ToggleButton value="svg">SVG</ToggleButton>
            <ToggleButton value="png">PNG</ToggleButton>
            {exportR ? <ToggleButton value="r">R</ToggleButton> : null}
          </ToggleButtonGroup>
        </div>
        {format === 'r' ? (
          <div>
            <Typography variant="body2">
              Saves an R script that redraws the open tracks with ggjbrowse,
              reading the same data files. To draw the figure:
            </Typography>
            <Typography variant="body2" component="ul" sx={{ my: 1 }}>
              <li>
                open <code>{filename}</code> in RStudio and click <b>Source</b>,
                or
              </li>
              <li>
                run <code>Rscript {shellQuote(filename)}</code> in a terminal
              </li>
            </Typography>
            <Typography variant="body2">
              Either way it also saves <code>figure.png</code> in the working
              directory. Without ggjbrowse installed, the script stops and
              prints the line that installs it.{' '}
              <ExternalLink href="https://jbrowse.org/jb2/docs/user_guides/r_export/">
                More on the R export
              </ExternalLink>
            </Typography>
          </div>
        ) : (
          <>
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
                  Note: rasterizing layers not yet supported in this browser, so
                  SVG size may be large
                </Typography>
              )}
            </div>
          </>
        )}
      </div>
    </SubmitDialog>
  )
})
