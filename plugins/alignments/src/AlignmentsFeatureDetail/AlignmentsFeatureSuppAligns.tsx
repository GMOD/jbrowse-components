import React from 'react'
import { Typography, Link } from '@mui/material'
import { BaseCard } from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail'
import { getLengthOnRef } from '../MismatchParser'
import { IAnyStateTreeNode } from 'mobx-state-tree'
import { navToLoc } from './util'

export default function SupplementaryAlignments(props: {
  tag: string
  model: IAnyStateTreeNode
}) {
  const { tag, model } = props
  return (
    <BaseCard {...props} title="Supplementary alignments">
      <Typography>List of supplementary alignment locations</Typography>
      <ul>
        {tag
          .split(';')
          .filter(SA => !!SA)
          .map((SA, index) => {
            const [saRef, saStart, saStrand, saCigar] = SA.split(',')
            const saLength = getLengthOnRef(saCigar)
            const extra = Math.floor(saLength / 5)
            const start = +saStart
            const end = +saStart + saLength
            const locString = `${saRef}:${Math.max(1, start - extra)}-${
              end + extra
            }`
            const displayStart = start.toLocaleString('en-US')
            const displayEnd = end.toLocaleString('en-US')
            const displayString = `${saRef}:${displayStart}-${displayEnd} (${saStrand}) [${saLength}bp]`
            return (
              <li key={`${locString}-${index}`}>
                <Link
                  onClick={async event => {
                    event.preventDefault()

                    // eslint-disable-next-line @typescript-eslint/no-floating-promises
                    navToLoc(locString, model)
                  }}
                  href="#"
                >
                  {displayString}
                </Link>
              </li>
            )
          })}
      </ul>
    </BaseCard>
  )
}
