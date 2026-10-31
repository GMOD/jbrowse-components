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
 * The records band's and the genotype rows' chips, one row under the band:
 * each shown part hides with its ×, while the other still draws, and a hidden
 * part comes back from its "Show" chip. Beside them, the count of records the
 * band hides past its height, which raises the band to its stack.
 */
const BandChips = observer(function BandChips({
  model,
}: {
  model: LinearVariantDisplayModel
}) {
  const { classes } = useStyles()
  const {
    drawsRows,
    showRecords,
    recordsOnly,
    atGenomicPositions,
    recordsHiddenCount,
  } = model
  const bothShown = drawsRows && showRecords
  return atGenomicPositions && !recordsOnly ? (
    <div
      className={classes.row}
      style={{ top: model.topBands.recordsHeight + 2 }}
    >
      {bothShown ? (
        <HideablePill
          label="Records"
          onHide={() => {
            model.setShowRecords(false)
          }}
        />
      ) : null}
      {recordsHiddenCount > 0 ? (
        <ChipButton
          testid="records_hidden_chip"
          title="Records that do not fit the band. Click to show every row."
          text={`+${recordsHiddenCount.toLocaleString('en-US')} hidden`}
          onClick={() => {
            model.showAllRecordRows()
          }}
        />
      ) : null}
      {bothShown ? (
        <HideablePill
          label="Genotypes"
          onHide={() => {
            model.setShowGenotypes(false)
          }}
        />
      ) : null}
      {drawsRows && !showRecords ? (
        <ChipButton
          testid="show_records_chip"
          title="Draw the records above the genotype rows"
          text="Show records"
          onClick={() => {
            model.setShowRecords(true)
          }}
        />
      ) : null}
      {drawsRows ? null : (
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
  ) : null
})

export default BandChips
