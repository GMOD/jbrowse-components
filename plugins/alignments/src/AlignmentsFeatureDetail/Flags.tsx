import { samFlagLabels } from '@jbrowse/alignments-core'
import BaseCard from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/BaseCard'
import SimpleField from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/SimpleField'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Checkbox, FormControlLabel, FormGroup } from '@mui/material'

const useStyles = makeStyles()({
  compact: {
    paddingRight: 0,
    paddingTop: 0,
    paddingBottom: 0,
  },
})

export default function AlignmentFlags({ flags }: { flags: number }) {
  const { classes } = useStyles()
  return (
    <BaseCard title="Flags">
      <SimpleField name="Flag" value={flags} />
      <FormGroup>
        {samFlagLabels.map((name, idx) => (
          <FormControlLabel
            key={name}
            control={
              <Checkbox
                className={classes.compact}
                checked={(flags & (1 << idx)) !== 0}
                name={name}
                readOnly
              />
            }
            label={name}
          />
        ))}
      </FormGroup>
    </BaseCard>
  )
}
