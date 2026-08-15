import { LabeledCheckbox } from '@jbrowse/core/ui'
import { assembleLocString, getBpDisplayStr } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import AnchorIcon from '@mui/icons-material/Anchor'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import { Button, IconButton, Tooltip, Typography } from '@mui/material'

import {
  movePanel,
  setAllPanelsChecked,
  setPanelChecked,
} from './panelOrder.ts'

import type { PanelRow } from './panelOrder.ts'
import type { Region } from '@jbrowse/core/util'

// The panel list is one row per aligning assembly, so an all-vs-all locus can
// produce a dozen; at MUI's default checkbox padding that list alone is taller
// than the rest of the dialog. Rows are compacted to a single text line each
// (small checkbox, no vertical margin) so the whole list stays readable at once.
const useStyles = makeStyles()(theme => ({
  panels: {
    margin: 10,
    maxHeight: 260,
    overflowY: 'auto',
  },
  panelRow: {
    display: 'flex',
    alignItems: 'center',
  },
  panelLabel: {
    flex: 1,
    margin: 0,
  },
  anchorLabel: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
  },
  // stands in the checkbox column the mate rows have. MUI's small Checkbox is a
  // 20px icon in 9px of padding either side, so 38px starts the anchor's name in
  // the same place as every mate's.
  anchorMark: {
    width: 38,
    flexShrink: 0,
    display: 'flex',
    justifyContent: 'center',
    color: theme.palette.text.secondary,
  },
  // outside the checkbox's own label, so the row's accessible name stays the
  // assembly — the locus is what the panel will show, not what it is
  panelLocus: {
    marginRight: theme.spacing(1),
    whiteSpace: 'nowrap',
    color: theme.palette.text.secondary,
  },
}))

// Above how many rows unchecking them one at a time stops being reasonable: an
// all-vs-all locus can list a dozen assemblies, all checked, and picking two of
// them out is otherwise ten clicks.
const BULK_SELECT_THRESHOLD = 3

/**
 * Where the anchor panel will open, which is not the selection: every panel is
 * clipped to the region, so the anchor row spans the union of what the CHECKED
 * panels resolved to on its axis — the same union `buildSyntenyViewSpec`
 * computes, so the row and the launched view agree. A selection whose flanks
 * align to nothing therefore opens narrower than it was dragged, and this is
 * the line that says so; the dialog's title line still carries the selection
 * itself, so the two are readable against each other.
 *
 * Falls back to the selection with nothing checked, where there is no launch to
 * describe and the anchor is all the panel list is.
 */
function resolvedAnchorSpan(rows: PanelRow[], region: Region) {
  const panels = rows.filter(row => row.kind === 'mate').filter(r => r.checked)
  return {
    refName: region.refName,
    start: panels.length
      ? Math.min(...panels.map(p => p.anchorStart))
      : region.start,
    end: panels.length ? Math.max(...panels.map(p => p.anchorEnd)) : region.end,
    reversed: false,
  }
}

// The interval a row's panel will open on, unpadded. Unpadded because the
// window size is a live field further down the dialog and this is meant to say
// where in each assembly the region lands, not to restate that arithmetic. The
// strand is spelled out rather than left to the locstring's `[rev]`, which means
// "this panel opens flipped" and so depends on the checkbox below.
//
// The anchor gets one too, rather than a hole in the column: this is read down,
// a mate's locus says little except against the anchor's, and the row every
// other row was resolved against is the wrong place to leave blank.
//
// WITH ITS SIZE, in the same words the selection above it is given. A panel
// spans every block its mate aligns the selection with, and how much sequence
// that is IS the comparison: 8 kb of K12 reaches 46 kb of Sakai across the
// prophage island at chr:800,000 (multiway_synteny/ecoli_launch_dialog), which
// as a locstring alone is four digits nobody subtracts and as a size is the
// thing the row is worth opening for. It is also what makes an outlier one — a
// span far past its neighbours' is a paralog, and unchecking it is a click.
function PanelLocus({
  row,
  anchorSpan,
  className,
}: {
  row: PanelRow
  anchorSpan: ReturnType<typeof resolvedAnchorSpan>
  className?: string
}) {
  const span =
    row.kind === 'anchor'
      ? anchorSpan
      : {
          refName: row.refName,
          start: row.mateStart,
          end: row.mateEnd,
          reversed: row.reversed,
        }
  return (
    <Typography variant="body2" className={className}>
      {assembleLocString({
        refName: span.refName,
        start: span.start,
        end: span.end,
      })}
      {span.reversed ? ' (-)' : ''} ({getBpDisplayStr(span.end - span.start)})
    </Typography>
  )
}

// The anchor is in the stack unconditionally — it is the assembly the region was
// selected on, and every mate's coordinates were resolved against it — so it
// gets a mark rather than a disabled checkbox. `disabled` said the same thing by
// making the row everything else is measured from the lowest-contrast line in
// the dialog, and by dropping its name out of the tab order while its own move
// buttons stayed in it. A mark instead: nothing to click, and nothing greyed out.
function AnchorMark({ assemblyName }: { assemblyName: string }) {
  const { classes } = useStyles()
  return (
    <Tooltip title="The assembly you selected in. Every other panel's locus is resolved against it, so this panel can be moved but not removed.">
      <div className={classes.anchorLabel}>
        <div className={classes.anchorMark}>
          <AnchorIcon fontSize="small" />
        </div>
        <Typography>{`${assemblyName} (your selection)`}</Typography>
      </div>
    </Tooltip>
  )
}

function MoveButton({
  row,
  index,
  delta,
  disabled,
  onMove,
}: {
  row: PanelRow
  index: number
  delta: 1 | -1
  disabled: boolean
  onMove: (delta: 1 | -1) => void
}) {
  const Icon = delta === -1 ? ArrowUpwardIcon : ArrowDownwardIcon
  return (
    <IconButton
      size="small"
      // positioned as well as named: a self-alignment track lists the anchor's
      // assembly twice (see PanelList's key), and "Move volvox up" twice over is
      // two buttons a screen reader cannot tell apart
      aria-label={`Move ${row.assemblyName} (panel ${index + 1}) ${
        delta === -1 ? 'up' : 'down'
      }`}
      disabled={disabled}
      onClick={() => {
        onMove(delta)
      }}
    >
      <Icon fontSize="small" />
    </IconButton>
  )
}

/**
 * The panels the launch will open, top to bottom: the anchor plus one row per
 * aligning assembly, each reorderable and — the anchor excepted — removable.
 *
 * Order is not cosmetic. A LinearSyntenyView draws a ribbon band between
 * *adjacent* panels only, so this list decides which comparisons the launched
 * view holds at all.
 */
export default function PanelList({
  rows,
  region,
  setRows,
  labelledBy,
}: {
  rows: PanelRow[]
  region: Region
  setRows: (rows: PanelRow[]) => void
  labelledBy: string
}) {
  const { classes } = useStyles()
  const anchorSpan = resolvedAnchorSpan(rows, region)
  return (
    <>
      <div className={classes.panels} role="group" aria-labelledby={labelledBy}>
        {/* keyed by position, which is also what movePanel/setPanelChecked
        address: a self-alignment track keeps its own lane as a mate (see
        pickMatesForRegion), so the anchor and that mate carry the same
        assembly name and the name is not an identity */}
        {rows.map((row, index) => (
          <div
            className={classes.panelRow}
            // eslint-disable-next-line @eslint-react/no-array-index-key -- see above
            key={`${row.assemblyName}-${index}`}
          >
            {row.kind === 'anchor' ? (
              <AnchorMark assemblyName={row.assemblyName} />
            ) : (
              <LabeledCheckbox
                className={classes.panelLabel}
                size="small"
                checked={row.checked}
                onChange={val => {
                  setRows(setPanelChecked(rows, index, val))
                }}
                label={row.assemblyName}
              />
            )}
            {/* Where this panel will actually open, resolved the same way the
             launch resolves it — the assembly name alone says nothing about
             which contig the region reaches, whether the match is inverted, or
             that a mate's alignment stops short of the selection. */}
            <PanelLocus
              row={row}
              anchorSpan={anchorSpan}
              className={classes.panelLocus}
            />
            <MoveButton
              row={row}
              index={index}
              delta={-1}
              disabled={index === 0}
              onMove={delta => {
                setRows(movePanel(rows, index, delta))
              }}
            />
            <MoveButton
              row={row}
              index={index}
              delta={1}
              disabled={index === rows.length - 1}
              onMove={delta => {
                setRows(movePanel(rows, index, delta))
              }}
            />
          </div>
        ))}
      </div>
      {rows.length > BULK_SELECT_THRESHOLD ? (
        <div>
          <Button
            size="small"
            onClick={() => {
              setRows(setAllPanelsChecked(rows, true))
            }}
          >
            Select all
          </Button>
          <Button
            size="small"
            onClick={() => {
              setRows(setAllPanelsChecked(rows, false))
            }}
          >
            Select none
          </Button>
        </div>
      ) : null}
    </>
  )
}
