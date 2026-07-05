import { samFlagDescriptions, samFlagLabels } from '@jbrowse/alignments-core'
import BaseCard from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/BaseCard'
import SimpleField from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/SimpleField'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Checkbox, FormControlLabel, FormGroup, Tooltip } from '@mui/material'

const useStyles = makeStyles()({
  compact: {
    paddingRight: 0,
    paddingTop: 0,
    paddingBottom: 0,
    cursor: 'default',
  },
  set: {
    fontWeight: 'bold',
  },
})

export default function AlignmentFlags({ flags }: { flags: number }) {
  const { classes, cx } = useStyles()
  return (
    <BaseCard title="Flags">
      <SimpleField name="Flag" value={flags} />
      <FormGroup>
        {samFlagLabels.map((name, idx) => {
          const checked = (flags & (1 << idx)) !== 0
          return (
            <Tooltip
              key={name}
              title={samFlagDescriptions[idx]}
              placement="left"
            >
              <FormControlLabel
                classes={{ label: cx(checked && classes.set) }}
                control={
                  <Checkbox
                    className={classes.compact}
                    checked={checked}
                    name={name}
                    disableRipple
                    readOnly
                  />
                }
                label={name}
              />
            </Tooltip>
          )
        })}
      </FormGroup>
    </BaseCard>
  )
}
