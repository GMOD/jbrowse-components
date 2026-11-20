import { useState } from 'react'

import SubmitDialog from '@jbrowse/core/ui/SubmitDialog'
import VirtualTable, {
  HEADER_HEIGHT,
  ROW_HEIGHT,
  TABLE_BORDER_WIDTH,
  checkboxLeading,
} from '@jbrowse/core/ui/VirtualTable'
import { observer } from 'mobx-react'

import type { VirtualTableColumn } from '@jbrowse/core/ui/VirtualTable'
import type { GroupId } from '@jbrowse/core/util/groupKeys'

export interface SectionsDialogModel {
  sectionsHeading: string
  knownSections: readonly GroupId[]
  hiddenGroups: ReadonlySet<string>
  setHiddenGroups: (keys: readonly string[]) => void
}

interface SectionRow {
  id: string
  label: string
}

function columnsFor(heading: string): VirtualTableColumn<SectionRow>[] {
  return [
    { id: 'section', header: heading, cell: row => row.label, fill: true },
  ]
}

/**
 * A checklist of the sections a grouped track knows, in stacking order. What
 * it edits is the hidden set, so a section that arrives while it is open
 * comes in ticked. Edits wait for Apply.
 */
const SectionsDialog = observer(function SectionsDialog({
  model,
  handleClose,
}: {
  model: SectionsDialogModel
  handleClose: () => void
}) {
  const rows = model.knownSections.map(({ key, label }) => ({ id: key, label }))
  const [hidden, setHidden] = useState<ReadonlySet<string>>(model.hiddenGroups)
  const shown = new Set(rows.map(row => row.id).filter(id => !hidden.has(id)))
  const showOnly = (next: ReadonlySet<string>) => {
    setHidden(new Set(rows.map(row => row.id).filter(id => !next.has(id))))
  }
  const height =
    HEADER_HEIGHT +
    Math.max(rows.length, 2) * ROW_HEIGHT +
    2 * TABLE_BORDER_WIDTH
  return (
    <SubmitDialog
      open
      title="Sections"
      submitText="Apply"
      submitDisabled={shown.size === 0}
      onCancel={handleClose}
      onSubmit={() => {
        if (hidden !== model.hiddenGroups) {
          model.setHiddenGroups(
            rows.map(row => row.id).filter(id => hidden.has(id)),
          )
        }
        handleClose()
      }}
    >
      <div
        style={{
          width: 300,
          maxWidth: '100%',
          height: `min(60vh, ${height}px)`,
        }}
      >
        <VirtualTable
          rows={rows}
          columns={columnsFor(model.sectionsHeading)}
          widths={available => ({ section: available })}
          onRowClick={row => {
            setHidden(
              prev =>
                new Set(
                  prev.has(row.id)
                    ? [...prev].filter(id => id !== row.id)
                    : [...prev, row.id],
                ),
            )
          }}
          emptyMessage="No sections in view"
          leading={checkboxLeading<SectionRow>({
            selected: shown,
            onChange: showOnly,
            label: row => row.label,
            allLabel: 'All sections',
          })}
          testId="sections-list"
        />
      </div>
    </SubmitDialog>
  )
})

export default SectionsDialog
