import { Typography, Link, Paper } from '@material-ui/core'
import { observer } from 'mobx-react'
import { getSession } from '@jbrowse/core/util'
import React, { useState } from 'react'
import copy from 'copy-to-clipboard'
import {
  FeatureDetails,
  BaseCard,
  useStyles,
} from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail'
import { parseCigar } from '../BamAdapter/MismatchParser'

const omit = ['clipPos', 'flags']

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function AlignmentFlags(props: { feature: any }) {
  const classes = useStyles()
  const { feature } = props
  const { flags } = feature
  const flagNames = [
    'read paired',
    'read mapped in proper pair',
    'read unmapped',
    'mate unmapped',
    'read reverse strand',
    'mate reverse strand',
    'first in pair',
    'second in pair',
    'not primary alignment',
    'read fails platform/vendor quality checks',
    'read is PCR or optical duplicate',
    'supplementary alignment',
  ]
  return (
    <BaseCard {...props} title="Flags">
      <div style={{ display: 'flex' }}>
        <div className={classes.fieldName}>Flag</div>
        <div className={classes.fieldValue}>{flags}</div>
      </div>
      {flagNames.map((name, index) => {
        const val = flags & (1 << index)
        const key = `${name}_${val}`
        return (
          <div key={key}>
            <input type="checkbox" checked={Boolean(val)} id={key} readOnly />
            <label htmlFor={key}>{name}</label>
          </div>
        )
      })}
    </BaseCard>
  )
}

function Formatter({ value }: { value: unknown }) {
  const [show, setShow] = useState(false)
  const display = String(value)
  if (display.length > 100) {
    return (
      <>
        <button type="button" onClick={() => copy(display)}>
          Copy
        </button>
        <button type="button" onClick={() => setShow(val => !val)}>
          {show ? 'Show less' : 'Show more'}
        </button>
        <div>{show ? display : `${display.slice(0, 100)}...`}</div>
      </>
    )
  }
  return <div>{display}</div>
}

// utility function to get length of alignment from cigar
function getLengthOnRef(cigar: string) {
  const cigarOps = parseCigar(cigar)
  let lengthOnRef = 0
  for (let i = 0; i < cigarOps.length; i += 2) {
    const len = +cigarOps[i]
    const op = cigarOps[i + 1]
    if (op !== 'H' && op !== 'S' && op !== 'I') {
      lengthOnRef += len
    }
  }
  return lengthOnRef
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function SupplementaryAlignments(props: { tag: string; model: any }) {
  const { tag, model } = props
  const session = getSession(model)
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
            const displayString = `${saRef}:${start}-${end} (${saStrand})`
            return (
              <li key={`${locString}-${index}`}>
                <Link
                  onClick={() => {
                    const { view } = model
                    if (view) {
                      view.navToLocString(locString)
                    } else {
                      session.notify(
                        'No view associated with this feature detail panel anymore',
                        'warning',
                      )
                    }
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function PairLink({ locString, model }: { locString: string; model: any }) {
  const session = getSession(model)
  return (
    <Link
      onClick={() => {
        const { view } = model
        if (view) {
          view.navToLocString(locString)
        } else {
          session.notify(
            'No view associated with this feature detail panel anymore',
            'warning',
          )
        }
      }}
      href="#"
    >
      {locString}
    </Link>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function AlignmentFeatureDetails(props: { model: any }) {
  const { model } = props
  const feat = JSON.parse(JSON.stringify(model.featureData))
  const SA = (feat.tags && feat.tags.SA) || feat.SA
  return (
    <Paper data-testid="alignment-side-drawer">
      <FeatureDetails
        {...props}
        omit={omit}
        feature={feat}
        formatter={(value: unknown, key: string) => {
          return key === 'next_segment_position' ? (
            <PairLink model={model} locString={value as string} />
          ) : (
            <Formatter value={value} />
          )
        }}
      />
      {SA ? <SupplementaryAlignments model={model} tag={SA} /> : null}
      <AlignmentFlags feature={feat} {...props} />
    </Paper>
  )
}

export default observer(AlignmentFeatureDetails)
