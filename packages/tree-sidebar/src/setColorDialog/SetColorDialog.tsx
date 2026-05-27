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

export interface SetColorDialogProps<
  S extends { name: string; color?: string },
> {
  // Returns the current dialog-editable source list (no palette synthesis, no
  // subtree filter). Called once on mount to seed local state and again after
  // "Clear custom settings" to refresh from the underlying model. Use a
  // function (not a value) so the dialog reads the post-clearLayout state.
  getSources: () => S[]
  onSetLayout: (s: S[]) => void
  onClearLayout: () => void
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
  // Plugin-specific field names that are internal plumbing (e.g. variants'
  // `sampleName`/`HP`): hidden from both the auto-derived "extras" column
  // list and the palettizer's per-field buttons.
  reservedFields?: ReadonlySet<string>
}

export default function SetColorDialog<
  S extends { name: string; color?: string },
>({
  getSources,
  onSetLayout,
  onClearLayout,
  handleClose,
  colorColumns = [{ field: 'color', headerName: 'Color' }],
  hasClusterTree,
  title = 'Color/arrangement editor',
  enableBulkEdit = false,
  enableRowPalettizer = false,
  showTipsStorageKey = 'setColorDialog-showTips',
  reservedFields,
}: SetColorDialogProps<S>) {
  const { classes } = useStyles()
  const [showBulkEditor, setShowBulkEditor] = useState(false)
  const [currLayout, setCurrLayout] = useState(() =>
    structuredClone(getSources()),
  )
  const [showTips, setShowTips] = useLocalStorage(showTipsStorageKey, false)
  const [pendingReorderConfirm, setPendingReorderConfirm] = useState(false)

  const submit = () => {
    onSetLayout(currLayout)
    handleClose()
  }

  const onSubmit = () => {
    const original = getSources()
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
                  excludedFields={reservedFields}
                />
              </>
            ) : null}

            <SourceGrid
              rows={currLayout}
              onChange={setCurrLayout}
              showTips={showTips}
              colorColumns={colorColumns}
              reservedExtra={reservedFields}
            />
          </DialogContent>
          <DialogActions>
            <Button
              variant="contained"
              type="submit"
              color="inherit"
              onClick={() => {
                onClearLayout()
                setCurrLayout(getSources())
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
