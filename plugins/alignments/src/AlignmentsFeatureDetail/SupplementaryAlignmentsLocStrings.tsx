import { getLengthOnRef } from '@jbrowse/alignments-core'
import { toLocale } from '@jbrowse/core/util'
import { navToLoc } from '@jbrowse/sv-core'
import { Link, Typography } from '@mui/material'

import type { AlignmentFeatureWidgetModel } from './stateModelFactory.ts'

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
            if (!saRef || !saStart || !saStrand || !saCigar) {
              return null
            }
            const saLength = getLengthOnRef(saCigar)
            const extra = Math.floor(saLength / 5)
            const start = +saStart
            const end = start + saLength
            const locString = `${saRef}:${Math.max(1, start - extra)}-${end + extra}`
            const displayString = `${saRef}:${toLocale(start)}-${toLocale(end)} (${saStrand}) [${saLength}bp]`
            return (
              /* biome-ignore lint/suspicious/noArrayIndexKey: */
              <li key={`${locString}-${idx}`}>
                <Link
                  href="#"
                  onClick={event => {
                    event.preventDefault()
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
