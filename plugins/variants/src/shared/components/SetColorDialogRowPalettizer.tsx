import { Button } from '@mui/material'

import { applyColorPalette } from '../applyColorPalette.ts'

import type { Source } from '../types.ts'

const excludedFields = new Set(['name', 'color', 'label', 'id', 'HP'])

export default function SetColorDialogRowPalettizer({
  setCurrLayout,
  currLayout,
}: {
  currLayout: Source[]
  setCurrLayout: (arg: Source[]) => void
}) {
  const firstRow = currLayout[0]
  if (!firstRow) {
    return null
  }

  const fields = Object.keys(firstRow).filter(f => !excludedFields.has(f))

  return (
    <div>
      Create color palette based on...
      {fields.map(field => (
        <Button
          key={field}
          variant="contained"
          color="inherit"
          onClick={() => {
            setCurrLayout(applyColorPalette(currLayout, field))
          }}
        >
          {field}
        </Button>
      ))}
      <Button
        onClick={() => {
          setCurrLayout(currLayout.map(row => ({ ...row, color: undefined })))
        }}
      >
        Clear colors
      </Button>
    </div>
  )
}
