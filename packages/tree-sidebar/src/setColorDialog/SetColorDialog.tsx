import { useState } from 'react'

import DraggableDialog from '@jbrowse/core/ui/DraggableDialog'
import { useLocalStorage } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Button, DialogActions, DialogContent } from '@mui/material'

import BulkEditPanel from './BulkEditPanel.tsx'
import ClearTreeWarningDialog from './ClearTreeWarningDialog.tsx'
import HelpfulTips from './HelpfulTips.tsx'
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

// Model contract — `sources` should be implemented as a getter that returns
// the dialog-editable view (no palette-synthesized colors, no subtree filter),
// so Submit only persists explicit choices and Clear-then-render sees the
// post-clearLayout state.
export interface SetColorDialogModel<S extends { name: string; color?: string }> {
  sources: S[]
  setLayout: (s: S[], clearTree?: boolean) => void
  clearLayout: () => void
}

export interface SetColorDialogProps<
  S extends { name: string; color?: string },
> {
  model: SetColorDialogModel<S>
  handleClose: () => void
  // PopoverPicker columns. Each renders both a bulk header button and a
  // PopoverPicker column. Defaults to a single `color` column.
  colorColumns?: ColorColumn<S>[]
  // Trigger the ClearTreeWarning dialog before Submit when the user reordered
  // rows. Pass true when a cluster tree is currently loaded.
  hasClusterTree?: boolean
  title?: string
  enableBulkEdit?: boolean
  enableRowPalettizer?: boolean
  showTipsStorageKey?: string
  // Additional column names hidden from the auto-derived "extras" list and
  // from the palettizer's choices (e.g. variants' `sampleName`/`HP`).
  reservedExtra?: ReadonlySet<string>
  palettizerExcludedFields?: ReadonlySet<string>
}

export default function SetColorDialog<
  S extends { name: string; color?: string },
>({
  model,
  handleClose,
  colorColumns = [{ field: 'color', headerName: 'Color' }],
  hasClusterTree,
  title = 'Color/arrangement editor',
  enableBulkEdit = false,
  enableRowPalettizer = false,
  showTipsStorageKey = 'setColorDialog-showTips',
  reservedExtra,
  palettizerExcludedFields,
}: SetColorDialogProps<S>) {
  const { classes } = useStyles()
  const [showBulkEditor, setShowBulkEditor] = useState(false)
  const [currLayout, setCurrLayout] = useState(() =>
    structuredClone(model.sources),
  )
  const [showTips, setShowTips] = useLocalStorage(showTipsStorageKey, false)
  const [pendingReorderConfirm, setPendingReorderConfirm] = useState(false)

  const submit = () => {
    model.setLayout(currLayout)
    handleClose()
  }

  const onSubmit = () => {
    const original = model.sources
    const reordered =
      hasClusterTree &&
      original.length === currLayout.length &&
      original.some((s, idx) => s.name !== currLayout[idx]?.name)
    if (reordered) {
      setPendingReorderConfirm(true)
    } else {
      submit()
    }
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
              <Button
                variant="contained"
                onClick={() => {
                  setShowTips(!showTips)
                }}
              >
                {showTips ? 'Hide tips' : 'Show tips'}
              </Button>
              {enableBulkEdit ? (
                <Button
                  color="secondary"
                  variant="contained"
                  onClick={() => {
                    setShowBulkEditor(true)
                  }}
                >
                  Show Bulk row editor
                </Button>
              ) : null}
            </div>

            {showTips ? <HelpfulTips /> : null}
            {enableRowPalettizer ? (
              <>
                <br />
                <RowPalettizer
                  currLayout={currLayout}
                  setCurrLayout={setCurrLayout}
                  excludedFields={palettizerExcludedFields}
                />
              </>
            ) : null}

            <SourceGrid
              rows={currLayout}
              onChange={setCurrLayout}
              showTips={showTips}
              colorColumns={colorColumns}
              reservedExtra={reservedExtra}
            />
          </DialogContent>
          <DialogActions>
            <Button
              variant="contained"
              type="submit"
              color="inherit"
              onClick={() => {
                model.clearLayout()
                setCurrLayout(model.sources)
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
              type="submit"
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
