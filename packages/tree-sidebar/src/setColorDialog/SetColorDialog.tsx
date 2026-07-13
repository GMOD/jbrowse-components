import { useState } from 'react'

import DraggableDialog from '@jbrowse/core/ui/DraggableDialog'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Button, DialogActions, DialogContent } from '@mui/material'

import BulkEditPanel from './BulkEditPanel.tsx'
import ClearTreeWarningDialog from './ClearTreeWarningDialog.tsx'
import RowPalettizer from './RowPalettizer.tsx'
import SourceGrid from './SourceGrid.tsx'

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
// synthesis, no subtree filter), read live so it reflects a mid-dialog
// "Clear custom settings".
export interface TreeLayoutModel<S extends { name: string }> {
  editableSources?: S[]
  setLayout: (s: S[]) => void
  clearLayout: () => void
  // Whether submitting `next` would invalidate a loaded cluster tree; when true
  // the ClearTreeWarning is shown before Submit.
  willClearTree: (next: S[]) => boolean
}

export interface SetColorDialogProps<
  S extends { name: string; color?: string },
> {
  model: TreeLayoutModel<S>
  handleClose: () => void
  // PopoverPicker columns. Each renders both a bulk header button and a
  // PopoverPicker column. Defaults to a single `color` column.
  colorColumns?: ColorColumn<S>[]
  title?: string
  enableBulkEdit?: boolean
  enableRowPalettizer?: boolean
  // Plugin-specific field names that are internal plumbing (e.g. variants'
  // `sampleName`/`HP`): hidden from both the auto-derived "extras" column
  // list and the palettizer's per-field buttons.
  reservedFields?: ReadonlySet<string>
}

export default function SetColorDialog<
  S extends { name: string; color?: string },
>({
  model,
  handleClose,
  colorColumns = [{ field: 'color', headerName: 'Color' }],
  title = 'Color/arrangement editor',
  enableBulkEdit = false,
  enableRowPalettizer = false,
  reservedFields,
}: SetColorDialogProps<S>) {
  const { classes } = useStyles()
  const getSources = () => model.editableSources ?? []
  const [showBulkEditor, setShowBulkEditor] = useState(false)
  const [currLayout, setCurrLayout] = useState(getSources)
  const [pendingReorderConfirm, setPendingReorderConfirm] = useState(false)

  const submit = () => {
    model.setLayout(currLayout)
    handleClose()
  }

  const onSubmit = () => {
    if (model.willClearTree(currLayout)) {
      setPendingReorderConfirm(true)
    } else {
      submit()
    }
  }

  // Drop custom settings and re-seed the grid from the model's persisted state.
  const resetToModel = () => {
    model.clearLayout()
    setCurrLayout(getSources())
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
            <div className={classes.fr}>
              {enableRowPalettizer ? (
                <RowPalettizer
                  currLayout={currLayout}
                  setCurrLayout={setCurrLayout}
                  excludedFields={reservedFields}
                />
              ) : null}
              {enableBulkEdit ? (
                <Button
                  color="secondary"
                  variant="contained"
                  onClick={() => {
                    setShowBulkEditor(true)
                  }}
                >
                  Bulk row editor
                </Button>
              ) : null}
            </div>

            <SourceGrid
              rows={currLayout}
              onChange={setCurrLayout}
              colorColumns={colorColumns}
              reservedExtra={reservedFields}
            />
          </DialogContent>
          <DialogActions>
            <Button
              variant="contained"
              color="inherit"
              onClick={() => {
                resetToModel()
              }}
            >
              Clear custom settings
            </Button>
            <Button
              variant="contained"
              color="secondary"
              onClick={() => {
                handleClose()
              }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              color="primary"
              onClick={() => {
                onSubmit()
              }}
            >
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
}
