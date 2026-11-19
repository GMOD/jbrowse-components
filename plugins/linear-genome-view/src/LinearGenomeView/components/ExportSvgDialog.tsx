import { useState } from 'react'

import {
  CSS_PX_PER_INCH,
  DEFAULT_FIGURE_TEXT_PT,
  parsePhysicalWidth,
  pxToPt,
} from '@jbrowse/core/svg/figureSize'
import {
  BaseExportSvgDialog,
  LabeledCheckbox,
  useExportSvgPreference,
} from '@jbrowse/core/ui'
import { AXIS_FONT_PX } from '@jbrowse/display-ui/yAxisConstants'
import { MenuItem, TextField } from '@mui/material'
import { observer } from 'mobx-react'

import { MIN_PAGE_PLOT_PX } from '../svgcomponents/pageLayout.ts'
import { TICK_LABEL_FONT_SIZE } from '../util.ts'

import type { pageLayout } from '../svgcomponents/pageLayout.ts'
import type {
  ExportSvgOptions,
  TrackLabelMode,
  ViewTrackLabelMode,
} from '../types.ts'
import type { BaseExportSvgOptions } from '@jbrowse/core/ui'

const MIN_WIDTH = 100
const MAX_WIDTH = 10000
const MIN_TEXT_PT = 4
const MAX_TEXT_PT = 72
const LABEL_FONT_PX = 13
const COLUMN_MM = 183
const COLUMN_PX = (COLUMN_MM / 25.4) * CSS_PX_PER_INCH

const TRACK_LABEL_MODES = [
  { mode: 'offset', label: 'Offset' },
  { mode: 'overlapping', label: 'Overlapping' },
  { mode: 'left', label: 'Left' },
  { mode: 'hidden', label: 'Hidden' },
] as const satisfies readonly { mode: TrackLabelMode; label: string }[]

/**
 * What the view answers about an export's layout before it runs, for the
 * dialog's size line. A view that passes none gets a plain width field.
 */
export interface ExportFigureLayout {
  chromePx: (opts: ExportSvgOptions) => number
  pageLayout: (opts: ExportSvgOptions) => ReturnType<typeof pageLayout>
}

function pt(px: number) {
  return +pxToPt(px).toFixed(1)
}

function pxWidthHelp(documentPx: number | undefined) {
  const column = documentPx
    ? ` In a ${COLUMN_MM} mm column its labels print at ${pt((LABEL_FONT_PX * COLUMN_PX) / documentPx)} pt; type ${COLUMN_MM}mm to size the figure for a page.`
    : ''
  return `Lays the tracks out as a window this wide would; text keeps its size.${column}`
}

function pageWidthHelp({
  page,
  textPt,
  screenWidth,
}: {
  page: NonNullable<ReturnType<typeof pageLayout>>
  textPt: number
  screenWidth: number
}) {
  const scaled = (px: number) => +((textPt * px) / LABEL_FONT_PX).toFixed(1)
  return page.plotPx < MIN_PAGE_PLOT_PX
    ? `Too narrow at ${textPt} pt: the tracks would be ${Math.max(page.plotPx, 0)} px wide. Widen the figure or lower the text size.`
    : `${page.pageWidth.value} x ${page.pageHeight} ${page.pageWidth.unit}. Labels ${textPt} pt, ruler ${scaled(TICK_LABEL_FONT_SIZE)} pt, axes ${scaled(AXIS_FONT_PX)} pt. Tracks drawn ${page.plotPx} px wide, ${+(screenWidth / page.plotPx).toFixed(1)}x the screen's bp per px.`
}

const ExportSvgDialog = observer(function ExportSvgDialog({
  model,
  handleClose,
  chooseWidth,
  figureLayout,
  exportR,
}: {
  model: {
    width?: number
    effectiveTrackLabels?: ViewTrackLabelMode
    exportSvg(
      opts: BaseExportSvgOptions & {
        trackLabels: TrackLabelMode
        showGridlines: boolean
        viewWidth?: number
        pageWidth?: string
        textSize?: number
      },
    ): Promise<unknown>
  }
  handleClose: () => void
  chooseWidth?: boolean
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
  // not a stored preference: a remembered width would drift from the screen's
  const [widthText, setWidthText] = useState(() =>
    String(Math.round(model.width ?? 0)),
  )
  const [textSizeText, setTextSizeText] = useState(
    String(DEFAULT_FIGURE_TEXT_PT),
  )
  const screenWidth = model.width ?? 0
  const typedWidth = Number(widthText)
  const pageWidth = figureLayout ? parsePhysicalWidth(widthText) : undefined
  const pageWidthText = pageWidth ? widthText.trim() : undefined
  const textSize = Number(textSizeText)
  const textSizeValid = textSize >= MIN_TEXT_PT && textSize <= MAX_TEXT_PT
  const layoutOpts = { trackLabels, pageWidth: pageWidthText, textSize }
  const page =
    pageWidth && textSizeValid
      ? figureLayout?.pageLayout(layoutOpts)
      : undefined
  const pxWidthValid =
    Number.isInteger(typedWidth) &&
    typedWidth >= MIN_WIDTH &&
    typedWidth <= MAX_WIDTH
  const widthValid = pageWidth
    ? !page || page.plotPx >= MIN_PAGE_PLOT_PX
    : pxWidthValid
  const widthHelp = pageWidth
    ? page
      ? pageWidthHelp({ page, textPt: textSize, screenWidth })
      : ''
    : pxWidthValid
      ? pxWidthHelp(
          figureLayout
            ? typedWidth + figureLayout.chromePx(layoutOpts)
            : undefined,
        )
      : figureLayout
        ? `A whole number of px from ${MIN_WIDTH} to ${MAX_WIDTH}, or a page width such as ${COLUMN_MM}mm or 7in`
        : `A whole number from ${MIN_WIDTH} to ${MAX_WIDTH}`
  return (
    <BaseExportSvgDialog
      model={model}
      handleClose={handleClose}
      exportSvg={opts =>
        model.exportSvg({
          ...opts,
          trackLabels,
          showGridlines,
          viewWidth:
            chooseWidth && !pageWidth && pxWidthValid ? typedWidth : undefined,
          pageWidth: chooseWidth ? pageWidthText : undefined,
          textSize: chooseWidth && pageWidth ? textSize : undefined,
        })
      }
      exportR={exportR}
      submitDisabled={
        chooseWidth && !(widthValid && (!pageWidth || textSizeValid))
      }
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
      {chooseWidth ? (
        <TextField
          label={figureLayout ? 'Width' : 'Width (px)'}
          variant="outlined"
          value={widthText}
          error={!widthValid}
          helperText={widthHelp}
          onChange={event => {
            setWidthText(event.target.value)
          }}
        />
      ) : null}
      {chooseWidth && pageWidth ? (
        <TextField
          label="Text size (pt)"
          variant="outlined"
          type="number"
          style={{ minWidth: 200 }}
          value={textSizeText}
          error={!textSizeValid}
          helperText={
            textSizeValid
              ? 'The size the track labels print at'
              : `From ${MIN_TEXT_PT} to ${MAX_TEXT_PT}`
          }
          slotProps={{
            htmlInput: { min: MIN_TEXT_PT, max: MAX_TEXT_PT, step: 0.5 },
          }}
          onChange={event => {
            setTextSizeText(event.target.value)
          }}
        />
      ) : null}
    </BaseExportSvgDialog>
  )
})

export default ExportSvgDialog
