import React from 'react'
import BaseCard from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/BaseCard'
import SimpleField from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/SimpleField'
import { Checkbox, FormControlLabel, FormGroup } from '@mui/material'
import { makeStyles } from 'tss-react/mui'

const useStyles = makeStyles()({
  compact: {
    paddingRight: 0,
    paddingTop: 0,
    paddingBottom: 0,
  },
})

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

export default function AlignmentFlags(props: { feature: { flags: number } }) {
  const { classes } = useStyles()
  const { feature } = props
  const { flags } = feature

  return (
    <BaseCard {...props} title="Flags">
      <SimpleField name="Flag" value={flags} />
      <FormGroup>
        {flagNames.map((name, idx) => {
          const val = flags & (1 << idx)
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
