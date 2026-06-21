import { getLengthOnRef } from '@jbrowse/alignments-core'
import { ActionLink } from '@jbrowse/core/ui'
import { toLocale } from '@jbrowse/core/util'
import { navToLoc } from '@jbrowse/sv-core'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

import type { AlignmentFeatureWidgetModel } from './stateModelFactory.ts'

const SupplementaryAlignmentsLocStrings = observer(
  function SupplementaryAlignmentsLocStrings({
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
            .filter(Boolean)
            .map(SA => {
              const [saRef, saStart, saStrand, saCigar] = SA.split(',')
              if (!saRef || !saStart || !saStrand || !saCigar) {
                return null
              }
              const saLength = getLengthOnRef(saCigar)
              const extra = Math.floor(saLength / 5)
              const start = +saStart
              const end = start + saLength
              const locString = `${saRef}:${Math.max(1, start - extra)}-${end + extra}`
              const label = `${saRef}:${toLocale(start)}-${toLocale(end)} (${saStrand}) [${saLength}bp]`
              return (
                <li key={locString}>
                  <ActionLink
                    onClick={() => {
                      navToLoc(locString, model)
                    }}
                  >
                    {label}
                  </ActionLink>
                </li>
              )
            })}
        </ul>
      </div>
    )
  },
)

export default SupplementaryAlignmentsLocStrings
