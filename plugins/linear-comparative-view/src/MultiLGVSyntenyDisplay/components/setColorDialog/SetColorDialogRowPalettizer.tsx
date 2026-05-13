import { set1 } from '@jbrowse/core/ui/colors'
import { randomColor } from '@jbrowse/core/util/color'
import { Button } from '@mui/material'

import type { Source } from './types.ts'

const RESERVED = new Set(['name', 'color', 'label', 'id'])

export default function SetColorDialogRowPalettizer({
  setCurrLayout,
  currLayout,
}: {
  currLayout: Source[]
  setCurrLayout: (arg: Source[]) => void
}) {
  if (!currLayout.length || !currLayout[0]) {
    return null
  }

  const fields = Object.keys(currLayout[0]).filter(f => !RESERVED.has(f))

  return (
    <div>
      Create color palette based on...
      {fields.map(r => (
        <Button
          key={r}
          variant="contained"
          color="inherit"
          onClick={() => {
            const map = new Map<string, number>()
            for (const row of currLayout) {
              const key = String(row[r])
              map.set(key, (map.get(key) ?? 0) + 1)
            }
            const ret = Object.fromEntries(
              [...map.entries()]
                .sort((a, b) => a[1] - b[1])
                .map((entry, idx) => [entry[0], set1[idx] || randomColor(entry[0])]),
            )

            setCurrLayout(
              currLayout.map(row => ({
                ...row,
                color: ret[String(row[r])],
              })),
            )
          }}
        >
          {r}
        </Button>
      ))}
      <Button
        onClick={() => {
          setCurrLayout(
            currLayout.map(row => ({
              ...row,
              color: undefined,
            })),
          )
        }}
      >
        Clear colors
      </Button>
    </div>
  )
}
