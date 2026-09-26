import { useState } from 'react'

import DraggableDialog from '@jbrowse/core/ui/DraggableDialog'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { pairedColorsOf } from '@jbrowse/display-kit/colorConfigSchema'
import {
  Button,
  DialogActions,
  DialogContent,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material'
import { observer } from 'mobx-react'

import { rowFieldValue } from '../rowColorScale.ts'
import { IDENTITY_FIELDS } from '../sourcesGridUtils.ts'
import BulkEditPanel from './BulkEditPanel.tsx'
import ClearTreeWarningDialog from './ClearTreeWarningDialog.tsx'
import PlotColorRow from './PlotColorRow.tsx'
import RowColorPanel from './RowColorPanel.tsx'
import SourceGrid from './SourceGrid.tsx'

import type { RowColorSetting, RowColorSnapshot } from '../TreeSidebarMixin.ts'
import type { ValueColor } from './RowColorPanel.tsx'
import type { ColorColumn } from './SourceGrid.tsx'

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
// contract. `dialogSources` is the dialog-editable list (no palette
// synthesis, no subtree filter). The dialog snapshots it into local state on
// open and re-reads it after "Clear custom settings", so edits stay uncommitted
// until Submit.
export interface TreeLayoutModel<S extends { name: string }> {
  editableSources: S[]
  dialogSources: S[]
  applyRowEdits: (s: S[], rowColor?: RowColorSnapshot) => void
  resetRowArrangement: () => void
  // Whether submitting `next` would invalidate a loaded cluster tree; when true
  // the ClearTreeWarning is shown before Submit.
  rowOrderWillDropTree: (next: S[]) => boolean
  rowColorSetting: RowColorSetting
  rowColorChoice: string
  rowColorFields: readonly string[]
  rowColorsFor: (setting: RowColorSetting) => ReadonlyMap<string, string>
}

export interface SetColorDialogProps<
  S extends { name: string; color?: string },
> {
  model: TreeLayoutModel<S>
  handleClose: () => void
  // PopoverPicker columns. Defaults to a single `color` column. With more than
  // one, a header toggle switches which single column the grid edits.
  colorColumns?: ColorColumn<S>[]
  // Which color column starts active; defaults to the first.
  defaultColorField?: keyof S & string
  title?: string
  enableBulkEdit?: boolean
  // Plugin-specific field names that are internal plumbing (e.g. variants'
  // `sampleName`/`HP`): hidden from the auto-derived "extras" column list.
  reservedFields?: ReadonlySet<string>
  // The display's own colour rather than a row's, on one line above the rows.
  // Held here and written in `submit()` AFTER the row edits, so Cancel reverts
  // it like everything else and the write cannot move the channel
  // `applyRowEdits` compares a row's swatch on.
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

function settingFor(field: string, entries: Entries): RowColorSetting {
  const own = entries[field] ?? {}
  return {
    field,
    scale: undefined,
    domain: Object.keys(own),
    range: Object.values(own),
  }
}

// Each value of `field` over the rows, most rows first, with its colour.
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
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([value, count]) => ({ value, count, color: colors.get(value) }))
}

export default observer(function SetColorDialog<
  S extends { name: string; color?: string },
>({
  model,
  handleClose,
  colorColumns = [{ field: 'color', headerName: 'Color' }],
  defaultColorField,
  title = 'Color/arrangement editor',
  enableBulkEdit = false,
  reservedFields,
  plotColor,
  showRows = true,
  onEditAsJson,
}: SetColorDialogProps<S>) {
  const { classes } = useStyles()
  const getSources = () => model.dialogSources
  // Undefined until a swatch is touched, so a reset re-reads the model rather
  // than restoring a pair snapshotted before it.
  const [plotPair, setPlotPair] = useState<{
    above: string
    below: string
  }>()
  const [showBulkEditor, setShowBulkEditor] = useState(false)
  const [currLayout, setCurrLayout] = useState(getSources)
  const [choice, setChoice] = useState(model.rowColorChoice)
  const [kept, setKept] = useState(model.rowColorSetting.field)
  const [entries, setEntries] = useState(() => entriesOf(model.rowColorSetting))
  const [pendingReorderConfirm, setPendingReorderConfirm] = useState(false)
  const [activeField, setActiveField] = useState(
    defaultColorField ?? colorColumns[0]?.field,
  )

  // The grid edits one color column at a time; the bulk button paints that
  // same one.
  const activeColumn =
    colorColumns.find(c => c.field === activeField) ?? colorColumns[0]

  // Every color column is reserved from the auto-derived extras, not just the
  // active one, so an inactive swatch field never leaks as a raw hex column.
  const reserved = new Set<string>([
    ...IDENTITY_FIELDS,
    ...colorColumns.map(c => c.field),
    ...(reservedFields ?? []),
  ])

  const byField = choice !== '' && choice !== 'name' ? choice : undefined
  const fieldColors = byField
    ? model.rowColorsFor(settingFor(byField, entries))
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

  // What the submit writes: the object as the reader left it, keeping the
  // last field chosen and its entries under None for the way back.
  const chosenRowColor = (): RowColorSnapshot => {
    const setting = model.rowColorSetting
    if (choice === '') {
      const { domain, range } =
        kept === 'name'
          ? setting.field === 'name'
            ? setting
            : { domain: [], range: [] }
          : settingFor(kept, entries)
      return {
        field: kept,
        scale: 'none',
        domain: [...domain],
        range: [...range],
      }
    }
    if (choice === 'name') {
      return { field: 'name' }
    }
    const { domain, range } = settingFor(choice, entries)
    return { field: choice, domain, range }
  }

  const paintRows = (colorOf: (row: S) => string | undefined) => {
    if (activeColumn) {
      setCurrLayout(
        currLayout.map(row => ({ ...row, [activeColumn.field]: colorOf(row) })),
      )
    }
  }

  // The row edits go first: a plot colour can move which channel carries a
  // row's identity, and `applyRowEdits` reads a row's swatch off that channel.
  const submit = () => {
    model.applyRowEdits(currLayout, chosenRowColor())
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
    setCurrLayout(getSources())
    setChoice(model.rowColorChoice)
    setKept(model.rowColorSetting.field)
    setEntries(entriesOf(model.rowColorSetting))
    setPlotPair(undefined)
  }

  return (
    <DraggableDialog open onClose={handleClose} maxWidth="xl" title={title}>
      {showBulkEditor && enableBulkEdit ? (
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
            {enableBulkEdit && showRows ? (
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
                  fields={fields}
                  choice={choice}
                  values={
                    byField && fieldColors
                      ? valueColors(currLayout, byField, fieldColors)
                      : []
                  }
                  onChoice={value => {
                    setChoice(value)
                    if (value !== '') {
                      setKept(value)
                    }
                  }}
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
                    const colors = model.rowColorsFor(
                      settingFor(field, entries),
                    )
                    paintRows(row => colors.get(rowFieldValue(row, field)))
                  }}
                  onClearRows={() => {
                    paintRows(() => undefined)
                  }}
                />

                {choice === 'name' && colorColumns.length > 1 ? (
                  <ToggleButtonGroup
                    exclusive
                    size="small"
                    value={activeColumn?.field}
                    onChange={(_event, value) => {
                      if (value) {
                        setActiveField(value)
                      }
                    }}
                  >
                    {colorColumns.map(c => (
                      <ToggleButton key={c.field} value={c.field}>
                        {c.headerName}
                      </ToggleButton>
                    ))}
                  </ToggleButtonGroup>
                ) : null}

                <SourceGrid
                  rows={currLayout}
                  onChange={setCurrLayout}
                  colorColumn={choice === 'name' ? activeColumn : undefined}
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
                Edit as JSON...
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
