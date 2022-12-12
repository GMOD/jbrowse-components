import React, { useState } from 'react'
import {
  Typography,
  Link,
  Paper,
  Checkbox,
  FormControlLabel,
  FormGroup,
} from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { observer } from 'mobx-react'
import { getSession } from '@jbrowse/core/util'
import copy from 'copy-to-clipboard'
import clone from 'clone'
import {
  FeatureDetails,
  BaseCard,
  SimpleValue,
} from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail'
import { parseCigar } from '../MismatchParser'

const useStyles = makeStyles()({
  compact: {
    paddingRight: 0,
    paddingTop: 0,
    paddingBottom: 0,
  },
})

const omit = ['clipPos', 'flags']

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function AlignmentFlags(props: { feature: any }) {
  const { classes } = useStyles()
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
      <SimpleValue name={'Flag'} value={flags} />

      <FormGroup>
        {flagNames.map((name, index) => {
          const val = flags & (1 << index)
          const key = `${name}_${val}`
          return (
            <FormControlLabel
              key={key}
              control={
                <Checkbox
                  className={classes.compact}
                  checked={Boolean(val)}
                  name={name}
                  readOnly
                />
              }
              label={name}
            />
          )
        })}
      </FormGroup>
    </BaseCard>
  )
}

function Formatter({ value }: { value: unknown }) {
  const [show, setShow] = useState(false)
  const [copied, setCopied] = useState(false)
  const display = String(value)
  if (display.length > 100) {
    return (
      <>
        <button
          type="button"
          onClick={() => {
            copy(display)
            setCopied(true)
            setTimeout(() => {
              setCopied(false)
            }, 700)
          }}
        >
          {copied ? 'Copied to clipboard' : 'Copy'}
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
            const displayStart = start.toLocaleString('en-US')
            const displayEnd = end.toLocaleString('en-US')
            const displayString = `${saRef}:${displayStart}-${displayEnd} (${saStrand})`
            return (
              <li key={`${locString}-${index}`}>
                <Link
                  onClick={async event => {
                    event.preventDefault()
                    const { view } = model
                    try {
                      if (view) {
                        await view.navToLocString(locString)
                      } else {
                        throw new Error(
                          'No view associated with this view anymore',
                        )
                      }
                    } catch (e) {
                      console.error(e)
                      session.notify(`${e}`)
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
      onClick={async () => {
        const { view } = model
        if (!view) {
          throw new Error(
            'No view associated with this feature detail panel anymore',
          )
        }
        try {
          await view.navToLocString(locString)
        } catch (e) {
          console.error(e)
          session.notify(`${e}`)
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
  const feat = clone(model.featureData)
  const SA = (feat.tags && feat.tags.SA) || feat.SA
  return (
    <Paper data-testid="alignment-side-drawer">
      <FeatureDetails
        {...props}
        omit={omit}
        feature={feat}
        formatter={(value, key) => {
          return key === 'next_segment_position' ? (
            <PairLink model={model} locString={value as string} />
          ) : (
            <Formatter value={value} />
          )
        }}
      />
      {SA ? <SupplementaryAlignments model={model} tag={SA} /> : null}
      {feat.flags !== undefined ? (
        <AlignmentFlags feature={feat} {...props} />
      ) : null}
    </Paper>
  )
}

export default observer(AlignmentFeatureDetails)
