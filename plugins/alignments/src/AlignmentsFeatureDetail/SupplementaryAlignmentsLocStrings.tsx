import React from 'react'
import { Typography, Link } from '@mui/material'
// locals
import { getLengthOnRef } from '../MismatchParser'
import { navToLoc } from './util'
import type { AlignmentFeatureWidgetModel } from './stateModelFactory'

export default function SupplementaryAlignmentsLocStrings({
  tag,
  model,
}: {
  tag: string
  model: AlignmentFeatureWidgetModel
}) {
  return (
    <div>
      <Typography>List of supplementary alignment locations</Typography>
      <ul>
        {tag
          .split(';')
          .filter(SA => !!SA)
          .map((SA, idx) => {
            const [saRef, saStart, saStrand, saCigar] = SA.split(',')
            const saLength = getLengthOnRef(saCigar!)
            const extra = Math.floor(saLength / 5)
            const start = +saStart!
            const end = +saStart! + saLength
            const sp = start - extra
            const ep = end + extra
            const locString = `${saRef}:${Math.max(1, sp)}-${ep}`
            const displayStart = start.toLocaleString('en-US')
            const displayEnd = end.toLocaleString('en-US')
            const displayString = `${saRef}:${displayStart}-${displayEnd} (${saStrand}) [${saLength}bp]`
            return (
              /* biome-ignore lint/suspicious/noArrayIndexKey: */
              <li key={`${locString}-${idx}`}>
                <Link
                  href="#"
                  onClick={async event => {
                    event.preventDefault()

                    // eslint-disable-next-line @typescript-eslint/no-floating-promises
                    navToLoc(locString, model)
                  }}
                >
                  {displayString}
                </Link>
              </li>
            )
          })}
      </ul>
    </div>
  )
}
