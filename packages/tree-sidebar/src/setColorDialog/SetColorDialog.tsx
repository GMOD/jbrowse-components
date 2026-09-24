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
  // Display-level color controls (not per-row), rendered above the grid. These
  // write the model directly rather than joining `currLayout`, so they take
  // effect immediately and Cancel does not revert them — keep them to settings
  // whose own dialog would be overkill (multi-wiggle's score-sign palette).
  displayControls?: React.ReactNode
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
  displayControls,
}: SetColorDialogProps<S>) {
  const { classes } = useStyles()
  const getSources = () => model.editableSources
  const [showBulkEditor, setShowBulkEditor] = useState(false)
  const [currLayout, setCurrLayout] = useState(getSources)
  const [choice, setChoice] = useState(model.rowColorChoice)
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

  // What the submit writes: the object as the reader left it, keeping the
  // field and its entries under None for the way back.
  const chosenRowColor = (): RowColorSnapshot => {
    const setting = model.rowColorSetting
    if (choice === '') {
      return {
        field: setting.field,
        scale: 'none',
        domain: [...setting.domain],
        range: [...setting.range],
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

  const submit = () => {
    model.applyRowEdits(currLayout, chosenRowColor())
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
    setEntries(entriesOf(model.rowColorSetting))
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
            {enableBulkEdit ? (
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

            {displayControls}

            <RowColorPanel
              fields={model.rowColorFields}
              choice={choice}
              values={
                byField && fieldColors
                  ? valueColors(currLayout, byField, fieldColors)
                  : []
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
                const colors = model.rowColorsFor(settingFor(field, entries))
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
          </DialogContent>
          <DialogActions>
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
