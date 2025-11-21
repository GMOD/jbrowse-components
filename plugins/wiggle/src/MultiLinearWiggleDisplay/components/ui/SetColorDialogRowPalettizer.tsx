import { set1 } from '@jbrowse/core/ui/colors'
import { randomColor } from '@jbrowse/core/util/color'
import { Button } from '@mui/material'

export default function SetColorDialogRowPalettizer({
  setCurrLayout,
  currLayout,
}: {
  currLayout: { name: string; [key: string]: unknown }[]
  setCurrLayout: (arg: { name: string; [key: string]: unknown }[]) => void
}) {
  if (!currLayout.length || !currLayout[0]) {
    return null
  }

  const fields = Object.keys(currLayout[0]).filter(
    f =>
      f !== 'name' &&
      f !== 'color' &&
      f !== 'source' &&
      f !== 'label' &&
      f !== 'id' &&
      f !== 'HP',
  )

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
              const val = map.get(row[r] as string)
              if (!val) {
                map.set(row[r] as string, 1)
              } else {
                map.set(row[r] as string, val + 1)
              }
            }
            const ret = Object.fromEntries(
              [...map.entries()]
                .sort((a, b) => a[1] - b[1])
                .map((r, idx) => [r[0], set1[idx] || randomColor(r[0])]),
            )

            setCurrLayout(
              currLayout.map(row => ({
                ...row,
                color: ret[row[r] as string],
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
