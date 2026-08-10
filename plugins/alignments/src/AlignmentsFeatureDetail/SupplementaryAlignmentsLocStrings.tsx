import { splitSA } from '@jbrowse/cigar-utils'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

import { NavToLocLink } from './links.tsx'
import { parseSupplementaryAlignment } from './parseSupplementaryAlignment.ts'

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
          {splitSA(tag).map((record, idx) => {
            const parsed = parseSupplementaryAlignment(record)
            return parsed ? (
              // eslint-disable-next-line @eslint-react/no-array-index-key -- the split of one SA tag, positional and never reordered; the locString prefix separates the entries that differ
              <li key={`${parsed.locString}-${idx}`}>
                <NavToLocLink model={model} loc={parsed.locString}>
                  {parsed.label}
                </NavToLocLink>
              </li>
            ) : null
          })}
        </ul>
      </div>
    )
  },
)

export default SupplementaryAlignmentsLocStrings
