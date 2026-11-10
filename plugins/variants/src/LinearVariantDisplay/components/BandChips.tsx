import { alpha } from '@jbrowse/core/ui/palette'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import {
  GROUP_LABEL_FONT_SIZE,
  GROUP_LABEL_FONT_WEIGHT,
  GROUP_LABEL_HEIGHT,
  GROUP_LABEL_ICON_SIZE,
  GROUP_LABEL_INSET_X,
  GROUP_LABEL_PADDING_X,
  GROUP_LABEL_RADIUS,
  GROUP_LABEL_TINT,
} from '@jbrowse/display-kit/groupLabelStyle'
import CloseIcon from '@mui/icons-material/Close'
import { observer } from 'mobx-react'

import type { LinearVariantDisplayModel } from '../model.ts'

const useStyles = makeStyles()(theme => {
  const tint = alpha(theme.palette.text.primary, GROUP_LABEL_TINT)
  const pill = {
    display: 'flex',
    alignItems: 'center',
    height: GROUP_LABEL_HEIGHT,
    padding: `0 ${GROUP_LABEL_PADDING_X}px`,
    border: 'none',
    borderRadius: GROUP_LABEL_RADIUS,
    fontSize: GROUP_LABEL_FONT_SIZE,
    fontWeight: GROUP_LABEL_FONT_WEIGHT,
    color: theme.palette.text.primary,
    backgroundColor: theme.palette.background.paper,
    backgroundImage: `linear-gradient(${tint}, ${tint})`,
    whiteSpace: 'nowrap' as const,
    userSelect: 'none' as const,
    pointerEvents: 'auto' as const,
  }
  return {
    row: {
      position: 'absolute',
      left: GROUP_LABEL_INSET_X,
      display: 'flex',
      gap: 4,
      pointerEvents: 'none',
    },
    pill,
    button: {
      ...pill,
      cursor: 'pointer',
    },
    hide: {
      display: 'flex',
      alignItems: 'center',
      marginLeft: 2,
      marginRight: -4,
      padding: 0,
      border: 'none',
      background: 'transparent',
      color: 'inherit',
      cursor: 'pointer',
    },
    hideIcon: {
      fontSize: GROUP_LABEL_ICON_SIZE - 2,
    },
  }
})

const HideablePill = observer(function HideablePill({
  label,
  onHide,
}: {
  label: string
  onHide: () => void
}) {
  const { classes } = useStyles()
  return (
    <div className={classes.pill} data-testid={`band_chip_${label}`}>
      {label}
      <button
        type="button"
        className={classes.hide}
        title={`Hide ${label.toLowerCase()}`}
        onClick={() => {
          onHide()
        }}
      >
        <CloseIcon className={classes.hideIcon} />
      </button>
    </div>
  )
})

const ChipButton = observer(function ChipButton({
  testid,
  title,
  text,
  onClick,
}: {
  testid: string
  title: string
  text: string
  onClick: () => void
}) {
  const { classes } = useStyles()
  return (
    <button
      type="button"
      data-testid={testid}
      className={classes.button}
      title={title}
      onClick={() => {
        onClick()
      }}
    >
      {text}
    </button>
  )
})

/**
 * The records' chips: the band's hide and the count of records it hides past
 * its height, whose click raises the band to its stack.
 */
const RecordsChips = observer(function RecordsChips({
  model,
  hideable,
}: {
  model: LinearVariantDisplayModel
  hideable: boolean
}) {
  return (
    <>
      {hideable ? (
        <HideablePill
          label="Records"
          onHide={() => {
            model.setShowRecords(false)
          }}
        />
      ) : null}
      {model.recordsHiddenCount > 0 ? (
        <ChipButton
          testid="records_hidden_chip"
          title="Records that do not fit the band. Click to show every row."
          text={`+${model.recordsHiddenCount.toLocaleString('en-US')} hidden`}
          onClick={() => {
            model.showAllRecordRows()
          }}
        />
      ) : null}
    </>
  )
})

/**
 * Each shown part's chip heads it, so the records and the genotype rows read
 * as two subtracks: the records' at the band's top, the genotypes' in the
 * strip under the band. Each hides with its ×, while the other still draws,
 * and a hidden part comes back from its "Show" chip in the strip. The
 * records' chips fall back to the strip where the band's top is taken: by its
 * sections' chips, by the track label over a band with no rows under it, or
 * by a band shorter than a chip.
 */
const BandChips = observer(function BandChips({
  model,
}: {
  model: LinearVariantDisplayModel
}) {
  const { classes } = useStyles()
  const { drawsGenotypeRows, showRecords, topBands, recordsFacet } = model
  const bothShown = drawsGenotypeRows && showRecords
  const recordsOnBand =
    bothShown &&
    recordsFacet === undefined &&
    topBands.reserved.records > GROUP_LABEL_HEIGHT
  return topBands.reserved.chips > 0 ? (
    <>
      {recordsOnBand ? (
        <div
          className={classes.row}
          style={{ top: 1 }}
          data-testid="records_band_chips"
        >
          <RecordsChips model={model} hideable />
        </div>
      ) : null}
      <div
        className={classes.row}
        style={{ top: topBands.top.chips + 2 }}
        data-testid="band_chips_strip"
      >
        {recordsOnBand ? null : (
          <RecordsChips model={model} hideable={bothShown} />
        )}
        {bothShown ? (
          <HideablePill
            label="Genotypes"
            onHide={() => {
              model.setShowGenotypes(false)
            }}
          />
        ) : null}
        {drawsGenotypeRows && !showRecords ? (
          <ChipButton
            testid="show_records_chip"
            title="Draw the records above the genotype rows"
            text="Show records"
            onClick={() => {
              model.setShowRecords(true)
            }}
          />
        ) : null}
        {drawsGenotypeRows ? null : (
          <ChipButton
            testid="show_genotypes_chip"
            title="Draw a row per sample under the records"
            text="Show genotypes"
            onClick={() => {
              model.setShowGenotypes(true)
            }}
          />
        )}
      </div>
    </>
  ) : null
})

export default BandChips
