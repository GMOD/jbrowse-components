import { set1 } from '@jbrowse/core/ui/colors'
import { randomColor } from '@jbrowse/core/util/color'
import { Button } from '@mui/material'

const excludedFields = new Set(['name', 'color', 'label', 'id', 'HP'])

export default function SetColorDialogRowPalettizer({
  setCurrLayout,
  currLayout,
}: {
  currLayout: { name: string; [key: string]: unknown }[]
  setCurrLayout: (arg: { name: string; [key: string]: unknown }[]) => void
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
            const counts = new Map<string, number>()
            for (const row of currLayout) {
              const key = row[field] as string
              counts.set(key, (counts.get(key) || 0) + 1)
            }
            const colorMap = Object.fromEntries(
              [...counts.entries()]
                .sort((a, b) => a[1] - b[1])
                .map(([key], idx) => [key, set1[idx] || randomColor(key)]),
            )
            setCurrLayout(
              currLayout.map(row => ({
                ...row,
                color: colorMap[row[field] as string],
              })),
            )
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
