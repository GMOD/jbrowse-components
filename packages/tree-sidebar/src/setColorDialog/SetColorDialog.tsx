import { useState } from 'react'

import DraggableDialog from '@jbrowse/core/ui/DraggableDialog'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { pairedColorsOf } from '@jbrowse/display-kit/colorConfigSchema'
import { Button, DialogActions, DialogContent } from '@mui/material'
import { observer } from 'mobx-react'

import { keptUnknown, rowColorChoiceSetting } from '../rowColorChoice.ts'
import { rowFieldValue } from '../rowColorScale.ts'
import { IDENTITY_FIELDS } from '../sourcesGridUtils.ts'
import BulkEditPanel from './BulkEditPanel.tsx'
import ClearTreeWarningDialog from './ClearTreeWarningDialog.tsx'
import PlotColorRow from './PlotColorRow.tsx'
import RowColorPanel from './RowColorPanel.tsx'
import SourceGrid from './SourceGrid.tsx'

import type { RowColorSnapshot } from '../rowColorChoice.ts'
import type { RowColorSetting } from '../rowColorScale.ts'
import type { ValueColor } from './RowColorPanel.tsx'

const useStyles = makeStyles()({
  content: {
    minWidth: 800,
  },
  fr: {
    float: 'right',
    display: 'flex',
    gap: 8,
  },
  left: {
    marginRight: 'auto',
  },
})

// The slice of a TreeSidebarMixin display the dialog drives. Consumers pass the
// model itself (not four separate callbacks) so every plugin shares one
// contract. `editableSources` is the dialog-editable list (no palette
// synthesis, no subtree filter). The dialog snapshots it into local state on
// open and re-reads it after "Clear custom settings", so edits stay uncommitted
// until Submit.
export interface TreeLayoutModel<S extends { name: string }> {
  editableSources: S[]
  applyRowEdits: (s: S[], rowColor?: RowColorSnapshot) => void
  resetRowArrangement: () => void
  // Whether submitting `next` would invalidate a loaded cluster tree; when true
  // the ClearTreeWarning is shown before Submit.
  rowOrderWillDropTree: (next: S[]) => boolean
  rowColorSetting: RowColorSetting
  rowColorChoice: string
  rowPaletteDeals: boolean
  rowColorFields: readonly string[]
  internalRowFields: readonly string[]
  rowColorsFor: (setting: RowColorSnapshot) => ReadonlyMap<string, string>
}

export interface SetColorDialogProps<
  S extends { name: string; rowColor?: string },
> {
  model: TreeLayoutModel<S>
  handleClose: () => void
  title?: string
  // The display's own colour rather than a row's, on one line above the rows.
  // Held here and written in `submit()` AFTER the row edits, so Cancel reverts
  // it like everything else and the write cannot recolour the rows
  // `applyRowEdits` compares the grid's against.
  plotColor?: PlotColorControl
  // False where the display has nothing to arrange — one row, or none arrived
  // yet. The row color choice, the grid and the bulk editor go with it.
  showRows?: boolean
  // The escape for what this dialog does not offer — a ramp, several cut
  // points, hand-written stops. A button here rather than a track-menu row of
  // its own, so one row in the menu reaches every colour the display has.
  onEditAsJson?: () => void
}

export interface PlotColorControl {
  above: string
  below: string
  // `read` shows the pair beside `reason` and offers no edit, for a picture two
  // colours cannot say.
  mode: 'edit' | 'read'
  reason?: string
  onSubmit: (next: { above: string; below: string }) => void
}

type Entries = Readonly<Record<string, Readonly<Record<string, string>>>>

// The colours a `rowColor` object sets on its field's values, by field, which
// the dialog edits before it writes one object back.
function entriesOf(setting: RowColorSetting): Entries {
  return setting.field === 'name'
    ? {}
    : { [setting.field]: Object.fromEntries(pairedColorsOf(setting)) }
}

// Each value of `field` over the rows with its colour and row count, in the
// order the key lists them: the coloured values as dealt, then the rest.
function valueColors(
  rows: readonly object[],
  field: string,
  colors: ReadonlyMap<string, string>,
): ValueColor[] {
  const counts = new Map<string, number>()
  for (const row of rows) {
    const value = rowFieldValue(row, field)
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  const listed = [...colors.keys()].filter(value => counts.has(value))
  const rest = [...counts.keys()].filter(value => !colors.has(value))
  return [...listed, ...rest].map(value => ({
    value,
    count: counts.get(value)!,
    color: colors.get(value),
  }))
}

export default observer(function SetColorDialog<
  S extends { name: string; rowColor?: string },
>({
  model,
  handleClose,
  title = 'Color/arrangement editor',
  plotColor,
  showRows = true,
  onEditAsJson,
}: SetColorDialogProps<S>) {
  const { classes } = useStyles()
  const openedOn = () => ({
    rows: model.editableSources,
    choice: model.rowColorChoice,
    entries: entriesOf(model.rowColorSetting),
    // The Other swatch's colour by field, where the reader set one; the
    // config's `keptUnknown` stands for a field not here.
    others: {} as Readonly<Record<string, string | undefined>>,
  })
  // Undefined until a swatch is touched, so a reset re-reads the model rather
  // than restoring a pair snapshotted before it.
  const [plotPair, setPlotPair] = useState<{
    above: string
    below: string
  }>()
  const [showBulkEditor, setShowBulkEditor] = useState(false)
  const [opened, setOpened] = useState(openedOn)
  const [currLayout, setCurrLayout] = useState(opened.rows)
  const [choice, setChoice] = useState(opened.choice)
  const [entries, setEntries] = useState(opened.entries)
  const [others, setOthers] = useState(opened.others)
  const [pendingReorderConfirm, setPendingReorderConfirm] = useState(false)

  const otherOf = (forChoice: string) => {
    const field = forChoice || 'name'
    return Object.hasOwn(others, field)
      ? others[field]
      : keptUnknown(model.rowColorSetting, forChoice)
  }
  const choiceSetting = (forChoice: string) =>
    rowColorChoiceSetting(
      model.rowPaletteDeals,
      forChoice,
      entries[forChoice] ?? {},
      otherOf(forChoice),
    )

  // A row's own `color` and its resolved `rowColor` never show as raw hex.
  const reserved = new Set<string>([
    ...IDENTITY_FIELDS,
    'color',
    'rowColor',
    ...model.internalRowFields,
  ])

  const byField = choice !== '' && choice !== 'name' ? choice : undefined
  const fieldColors = byField
    ? model.rowColorsFor(choiceSetting(byField))
    : undefined

  // A color by the config names that the display does not offer, a column
  // the samples lack, still shows as chosen.
  const current = model.rowColorChoice
  const fields =
    current === '' ||
    current === 'name' ||
    model.rowColorFields.includes(current)
      ? model.rowColorFields
      : [...model.rowColorFields, current]

  // An untouched panel writes no colour object, so the config's own stands
  // whatever the panel can spell.
  const colorTouched = () => {
    const before = new Map(opened.rows.map(row => [row.name, row]))
    return (
      choice !== opened.choice ||
      entries !== opened.entries ||
      others !== opened.others ||
      currLayout.some(row => row.rowColor !== before.get(row.name)?.rowColor)
    )
  }

  const colorsRows = choice === '' || choice === 'name'

  const paintRows = (colorOf: (row: S) => string | undefined) => {
    setCurrLayout(currLayout.map(row => ({ ...row, rowColor: colorOf(row) })))
  }

  // The row edits go first: a plot colour can change which rows the palette
  // deals, and `applyRowEdits` compares each row against its colour now. Under
  // None and Each row the grid's row colours become the object's pairs.
  const submit = () => {
    model.applyRowEdits(
      currLayout,
      colorTouched() ? choiceSetting(choice) : undefined,
    )
    if (
      plotPair &&
      (plotPair.above !== plotColor?.above ||
        plotPair.below !== plotColor.below)
    ) {
      plotColor?.onSubmit(plotPair)
    }
    handleClose()
  }

  const onSubmit = () => {
    if (model.rowOrderWillDropTree(currLayout)) {
      setPendingReorderConfirm(true)
    } else {
      submit()
    }
  }

  // Drop custom settings and re-seed the grid from the model's persisted state.
  const resetToModel = () => {
    model.resetRowArrangement()
    const next = openedOn()
    setOpened(next)
    setCurrLayout(next.rows)
    setChoice(next.choice)
    setEntries(next.entries)
    setOthers(next.others)
    setPlotPair(undefined)
  }

  return (
    <DraggableDialog open onClose={handleClose} maxWidth="xl" title={title}>
      {showBulkEditor ? (
        <BulkEditPanel
          currLayout={currLayout}
          onClose={next => {
            if (next) {
              setCurrLayout(next)
            }
            setShowBulkEditor(false)
          }}
        />
      ) : (
        <>
          <DialogContent className={classes.content}>
            {showRows ? (
              <div className={classes.fr}>
                <Button
                  color="secondary"
                  variant="contained"
                  onClick={() => {
                    setShowBulkEditor(true)
                  }}
                >
                  Bulk row editor
                </Button>
              </div>
            ) : null}

            {plotColor ? (
              <PlotColorRow
                above={plotPair?.above ?? plotColor.above}
                below={plotPair?.below ?? plotColor.below}
                editable={plotColor.mode === 'edit'}
                reason={plotColor.reason}
                onChange={setPlotPair}
              />
            ) : null}

            {showRows ? (
              <>
                <RowColorPanel
                  eachRow={model.rowPaletteDeals}
                  fields={fields}
                  choice={choice}
                  values={
                    byField && fieldColors
                      ? valueColors(currLayout, byField, fieldColors)
                      : []
                  }
                  other={
                    choice === '' && model.rowPaletteDeals
                      ? undefined
                      : {
                          color: otherOf(choice),
                          count: byField
                            ? currLayout.filter(row => {
                                const value = rowFieldValue(row, byField)
                                return (
                                  value !== '' &&
                                  !Object.hasOwn(entries[byField] ?? {}, value)
                                )
                              }).length
                            : undefined,
                          onChange: color => {
                            setOthers({ ...others, [choice || 'name']: color })
                          },
                          onClear: () => {
                            setOthers({
                              ...others,
                              [choice || 'name']: undefined,
                            })
                          },
                        }
                  }
                  onChoice={setChoice}
                  onValueColor={(value, color) => {
                    if (byField) {
                      setEntries({
                        ...entries,
                        [byField]: { ...entries[byField], [value]: color },
                      })
                    }
                  }}
                  onResetValues={() => {
                    if (byField) {
                      setEntries({ ...entries, [byField]: {} })
                    }
                  }}
                  onStartFrom={field => {
                    const colors = model.rowColorsFor(choiceSetting(field))
                    paintRows(row => colors.get(rowFieldValue(row, field)))
                  }}
                  onClearRows={() => {
                    paintRows(() => undefined)
                  }}
                />

                <SourceGrid
                  rows={currLayout}
                  onChange={setCurrLayout}
                  editsColor={colorsRows}
                  swatchOf={
                    fieldColors && byField
                      ? row => fieldColors.get(rowFieldValue(row, byField))
                      : undefined
                  }
                  reserved={reserved}
                />
              </>
            ) : null}
          </DialogContent>
          <DialogActions>
            {onEditAsJson ? (
              <Button
                className={classes.left}
                color="primary"
                onClick={() => {
                  onEditAsJson()
                  handleClose()
                }}
              >
                Edit plot...
              </Button>
            ) : null}
            <Button variant="contained" color="inherit" onClick={resetToModel}>
              Clear custom settings
            </Button>
            <Button variant="contained" color="secondary" onClick={handleClose}>
              Cancel
            </Button>
            <Button variant="contained" color="primary" onClick={onSubmit}>
              Submit
            </Button>
          </DialogActions>
        </>
      )}
      {pendingReorderConfirm ? (
        <ClearTreeWarningDialog
          handleClose={() => {
            setPendingReorderConfirm(false)
          }}
          onConfirm={() => {
            submit()
          }}
        />
      ) : null}
    </DraggableDialog>
  )
})
