import {
  DEFAULT_FIGURE_TEXT_PT,
  parsePhysicalWidth,
  physicalWidthInches,
} from '@jbrowse/core/svg/figureSize'
import {
  BaseExportSvgDialog,
  LabeledCheckbox,
  useExportSvgPreference,
} from '@jbrowse/core/ui'
import { InputAdornment, MenuItem, Select, TextField } from '@mui/material'
import { observer } from 'mobx-react'

import { MIN_PAGE_PLOT_PX } from '../svgcomponents/pageLayout.ts'

import type { pageLayout } from '../svgcomponents/pageLayout.ts'
import type {
  ExportSvgOptions,
  TrackLabelMode,
  ViewTrackLabelMode,
} from '../types.ts'
import type { FigureUnit } from '@jbrowse/core/svg/figureSize'
import type { BaseExportSvgOptions } from '@jbrowse/core/ui'

const MIN_TEXT_PT = 4
const MAX_TEXT_PT = 72

const TRACK_LABEL_MODES = [
  { mode: 'offset', label: 'Offset' },
  { mode: 'overlapping', label: 'Overlapping' },
  { mode: 'left', label: 'Left' },
  { mode: 'hidden', label: 'Hidden' },
] as const satisfies readonly { mode: TrackLabelMode; label: string }[]

const SIZE_MODES = [
  { mode: 'screen', label: 'Same as screen' },
  { mode: 'page', label: 'Page width' },
] as const

type SizeMode = (typeof SIZE_MODES)[number]['mode']

const PAGE_UNITS = ['mm', 'in'] as const satisfies readonly FigureUnit[]

type PageUnit = (typeof PAGE_UNITS)[number]

/**
 * What the view answers about an export's layout before it runs. A view that
 * passes one gets the Size field.
 */
export interface ExportFigureLayout {
  pageLayout: (opts: ExportSvgOptions) => ReturnType<typeof pageLayout>
}

function convertWidth(text: string, from: PageUnit, to: PageUnit) {
  const value = Number(text)
  return value > 0
    ? String(
        +(
          physicalWidthInches({ value, unit: from }) /
          physicalWidthInches({ value: 1, unit: to })
        ).toFixed(to === 'mm' ? 0 : 1),
      )
    : text
}

const ExportSvgDialog = observer(function ExportSvgDialog({
  model,
  handleClose,
  figureLayout,
  exportR,
}: {
  model: {
    effectiveTrackLabels?: ViewTrackLabelMode
    exportSvg(
      opts: BaseExportSvgOptions & {
        trackLabels: TrackLabelMode
        showGridlines: boolean
        pageWidth?: string
        textSize?: number
      },
    ): Promise<unknown>
  }
  handleClose: () => void
  figureLayout?: ExportFigureLayout
  exportR?: (filename: string) => Promise<unknown>
}) {
  // The view's own setting is already an export mode, so a user who has not
  // picked one here gets the figure their screen shows. The key is `-mode`
  // because the modes were once spelled `overlay`/`none`, and a stored one of
  // those would select nothing in the dropdown.
  const [trackLabels, setTrackLabels] = useExportSvgPreference<TrackLabelMode>(
    'tracklabels-mode',
    model.effectiveTrackLabels ?? 'offset',
  )
  const [showGridlines, setShowGridlines] = useExportSvgPreference(
    'gridlines',
    false,
  )
  const [sizeMode, setSizeMode] = useExportSvgPreference<SizeMode>(
    'size',
    'screen',
  )
  const [pageWidthText, setPageWidthText] = useExportSvgPreference(
    'page-width',
    '183',
  )
  const [pageUnit, setPageUnit] = useExportSvgPreference<PageUnit>(
    'page-unit',
    'mm',
  )
  const [textSizeText, setTextSizeText] = useExportSvgPreference(
    'text-size',
    String(DEFAULT_FIGURE_TEXT_PT),
  )
  const forPage = !!figureLayout && sizeMode === 'page'
  const pageWidth = forPage
    ? parsePhysicalWidth(`${pageWidthText}${pageUnit}`)
    : undefined
  const pageWidthOpt = pageWidth
    ? `${pageWidth.value}${pageWidth.unit}`
    : undefined
  const textSize = Number(textSizeText)
  const textSizeValid = textSize >= MIN_TEXT_PT && textSize <= MAX_TEXT_PT
  const page =
    figureLayout && pageWidthOpt && textSizeValid
      ? figureLayout.pageLayout({
          trackLabels,
          pageWidth: pageWidthOpt,
          textSize,
        })
      : undefined
  const tooNarrow = !!page && page.plotPx < MIN_PAGE_PLOT_PX
  const widthValid = !!pageWidth && !tooNarrow
  return (
    <BaseExportSvgDialog
      model={model}
      handleClose={handleClose}
      exportSvg={opts =>
        model.exportSvg({
          ...opts,
          trackLabels,
          showGridlines,
          pageWidth: pageWidthOpt,
          textSize: pageWidthOpt ? textSize : undefined,
        })
      }
      exportR={exportR}
      submitDisabled={forPage && !(widthValid && textSizeValid)}
      checkboxes={
        <LabeledCheckbox
          checked={showGridlines}
          onChange={val => {
            setShowGridlines(val)
          }}
          label="Show gridlines"
        />
      }
    >
      <TextField
        select
        label="Track label positioning"
        variant="outlined"
        style={{ minWidth: 200 }}
        value={trackLabels}
        onChange={event => {
          const picked = TRACK_LABEL_MODES.find(
            m => m.mode === event.target.value,
          )
          if (picked) {
            setTrackLabels(picked.mode)
          }
        }}
      >
        {TRACK_LABEL_MODES.map(({ mode, label }) => (
          <MenuItem key={mode} value={mode}>
            {label}
          </MenuItem>
        ))}
      </TextField>
      {figureLayout ? (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'flex-start',
            gap: 12,
          }}
        >
          <TextField
            select
            label="Size"
            variant="outlined"
            style={{ minWidth: 200 }}
            value={sizeMode}
            onChange={event => {
              const picked = SIZE_MODES.find(m => m.mode === event.target.value)
              if (picked) {
                setSizeMode(picked.mode)
              }
            }}
          >
            {SIZE_MODES.map(({ mode, label }) => (
              <MenuItem key={mode} value={mode}>
                {label}
              </MenuItem>
            ))}
          </TextField>
          {forPage ? (
            <>
              <TextField
                label="Width"
                variant="outlined"
                style={{ width: 170 }}
                value={pageWidthText}
                error={!widthValid}
                helperText={
                  tooNarrow ? `Too narrow for ${textSize} pt` : undefined
                }
                onChange={event => {
                  setPageWidthText(event.target.value)
                }}
                slotProps={{
                  htmlInput: { inputMode: 'decimal' },
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <Select
                          variant="standard"
                          disableUnderline
                          value={pageUnit}
                          inputProps={{ 'aria-label': 'Width unit' }}
                          onChange={event => {
                            const unit = PAGE_UNITS.find(
                              u => u === event.target.value,
                            )
                            if (unit) {
                              setPageWidthText(
                                convertWidth(pageWidthText, pageUnit, unit),
                              )
                              setPageUnit(unit)
                            }
                          }}
                        >
                          {PAGE_UNITS.map(unit => (
                            <MenuItem key={unit} value={unit}>
                              {unit}
                            </MenuItem>
                          ))}
                        </Select>
                      </InputAdornment>
                    ),
                  },
                }}
              />
              <TextField
                label="Text size"
                variant="outlined"
                style={{ width: 130 }}
                value={textSizeText}
                error={!textSizeValid}
                helperText={
                  textSizeValid
                    ? undefined
                    : `${MIN_TEXT_PT} to ${MAX_TEXT_PT} pt`
                }
                onChange={event => {
                  setTextSizeText(event.target.value)
                }}
                slotProps={{
                  htmlInput: { inputMode: 'decimal' },
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">pt</InputAdornment>
                    ),
                  },
                }}
              />
            </>
          ) : null}
        </div>
      ) : null}
    </BaseExportSvgDialog>
  )
})

export default ExportSvgDialog
