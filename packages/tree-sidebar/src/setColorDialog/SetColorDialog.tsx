import { useState } from 'react'

import DraggableDialog from '@jbrowse/core/ui/DraggableDialog'
import { isCssColor } from '@jbrowse/core/util/cssColorParse'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { pairedColorsOf } from '@jbrowse/display-kit/colorConfigSchema'
import { Button, DialogActions, DialogContent } from '@mui/material'
import { observer } from 'mobx-react'

import { rowColorMembers, samePairs, withPair } from '../rowColorChoice.ts'
import { resolveRowColors, rowFieldValue } from '../rowColorScale.ts'
import { IDENTITY_FIELDS } from '../sourcesGridUtils.ts'
import BulkEditPanel from './BulkEditPanel.tsx'
import ClearTreeWarningDialog from './ClearTreeWarningDialog.tsx'
import PlotColorRow from './PlotColorRow.tsx'
import RowColorPanel from './RowColorPanel.tsx'
import SourceGrid from './SourceGrid.tsx'

import type { RowAlias } from '../arrangeRows.ts'
import type { RowColorSnapshot } from '../rowColorChoice.ts'
import type { RowColorSetting } from '../rowColorScale.ts'
import type { RowSource } from '../types.ts'
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

// The slice of a TreeSidebarMixin display the dialog drives, which every plugin
// passes as the model itself. The dialog snapshots `editableSources` on open
// and holds every edit until Submit.
export interface TreeLayoutModel<S extends RowSource> {
  editableSources: S[]
  applyRowEdits: (s: S[], rowColor?: RowColorSnapshot) => void
  resetRowArrangement: () => void
  // Whether submitting `next` would invalidate a loaded cluster tree; when true
  // the ClearTreeWarning is shown before Submit.
  rowOrderWillDropTree: (next: S[]) => boolean
  rowColorChoice: string
  rowColorAttributesOffered: readonly string[]
  rowColorFor: (choice: string) => RowColorSetting
  rowPaletteDeals: boolean
  rowAlias: RowAlias | undefined
  internalRowFields: readonly string[]
  dealtRowColorsFor: (setting: RowColorSnapshot) => ReadonlyMap<string, string>
}

export interface SetColorDialogProps<S extends RowSource> {
  model: TreeLayoutModel<S>
  handleClose: () => void
  title?: string
  // The display's own colour rather than a row's, on one line above the rows.
  // Held here and written in `submit()` after the row colour, so Cancel
  // reverts it like everything else.
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

// Each value of `field` over the rows with its colour, whether a pair of its
// own sets it, and its row count, in the order the key lists them: the
// coloured values as dealt, then the rest.
function valueColors(
  rows: readonly object[],
  field: string,
  colors: ReadonlyMap<string, string>,
  pairs: ReadonlyMap<string, string>,
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
    paired: pairs.has(value),
  }))
}

export default observer(function SetColorDialog<S extends RowSource>({
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
  // The `rowColor` object each choice the reader edited in this sitting
  // writes; an unedited one writes what it starts from.
  const [drafts, setDrafts] = useState<
    Readonly<Record<string, RowColorSetting>>
  >({})
  const [pendingReorderConfirm, setPendingReorderConfirm] = useState(false)

  const settingOf = (forChoice: string) =>
    drafts[forChoice] ?? model.rowColorFor(forChoice)
  const setting = settingOf(choice)
  const eachRow = settingOf('name')
  const editDraft = (next: (current: RowColorSetting) => RowColorSetting) => {
    setDrafts({ ...drafts, [choice]: next(setting) })
  }
  const pairs = pairedColorsOf(setting)
  const dealt = model.dealtRowColorsFor(setting)
  const colors = resolveRowColors(
    currLayout,
    setting.field,
    dealt,
    model.rowAlias,
  )

  // Each row's picks are set from the row list's swatches, the bulk colour
  // button and a pasted colour column, and choose Each row.
  const setEachRow = (next: RowColorSetting) => {
    setDrafts({ ...drafts, name: next })
    setChoice('name')
  }
  const pickEachRow = (picked: ReadonlyMap<string, string>) => {
    let next = eachRow
    for (const [name, color] of picked) {
      next = withPair(next, name, color)
    }
    setEachRow(next)
  }

  // A row's own `color` and its resolved `rowColor` never show as raw hex.
  const reserved = new Set<string>([
    ...IDENTITY_FIELDS,
    'color',
    'rowColor',
    ...model.internalRowFields,
  ])

  const byField = choice !== '' && choice !== 'name' ? choice : undefined

  // An untouched panel writes no colour object, so the config's own stands
  // whatever the panel can spell.
  const colorTouched = choice !== opened.choice || Object.hasOwn(drafts, choice)

  // The row colour goes first: a plot colour can change whether the palette
  // deals, which the written object was chosen under.
  const submit = () => {
    model.applyRowEdits(
      currLayout,
      colorTouched ? rowColorMembers(setting) : undefined,
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
    setDrafts({})
    setPlotPair(undefined)
  }

  return (
    <DraggableDialog open onClose={handleClose} maxWidth="xl" title={title}>
      {showBulkEditor ? (
        <BulkEditPanel
          currLayout={currLayout.map(row => ({
            ...row,
            rowColor: pairedColorsOf(eachRow).get(row.name),
          }))}
          onClose={next => {
            if (next) {
              const pasted = next.flatMap(({ name, rowColor }) =>
                rowColor && isCssColor(rowColor)
                  ? [[name, rowColor] as const]
                  : [],
              )
              const picked = {
                ...eachRow,
                domain: pasted.map(([name]) => name),
                range: pasted.map(([, color]) => color),
              }
              if (!samePairs(picked, eachRow)) {
                setEachRow(picked)
              }
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
                  fields={model.rowColorAttributesOffered}
                  choice={choice}
                  values={
                    byField
                      ? valueColors(currLayout, byField, dealt, pairs)
                      : []
                  }
                  other={
                    choice === ''
                      ? undefined
                      : {
                          color: setting.unknown,
                          onChange: unknown => {
                            editDraft(s => ({ ...s, unknown }))
                          },
                        }
                  }
                  dealsByRow={model.rowPaletteDeals}
                  onChoice={setChoice}
                  onValueColor={(value, color) => {
                    editDraft(s => withPair(s, value, color))
                  }}
                  onClear={() => {
                    editDraft(s => ({ ...s, domain: [], range: [] }))
                  }}
                />

                <SourceGrid
                  rows={currLayout}
                  onChange={setCurrLayout}
                  colors={colors}
                  eachRow={
                    choice === 'name'
                      ? { picks: pairs, onPick: pickEachRow }
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
