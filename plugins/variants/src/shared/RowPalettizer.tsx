import React from 'react'

import { set1 } from '@jbrowse/core/ui/colors'
import { Button } from '@mui/material'

import { type Source, randomColor } from '../util'

export default function RowPalettizer({
  setCurrLayout,
  currLayout,
}: {
  currLayout: Source[]
  setCurrLayout: (arg: Source[]) => void
}) {
  return (
    <div>
      {Object.keys(currLayout[0] ?? [])
        .filter(f => f !== 'name' && f !== 'color')
        .map(r => {
          return (
            <Button
              key={r}
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
              Palettize {r}
            </Button>
          )
        })}
    </div>
  )
}
