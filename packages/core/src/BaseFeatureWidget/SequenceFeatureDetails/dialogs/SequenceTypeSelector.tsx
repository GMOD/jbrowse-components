import { FormControl, MenuItem, Select } from '@mui/material'
import { observer } from 'mobx-react'

import { makeStyles } from '../../../util/tss-react/index.ts'
import { getAvailableModes } from '../featureTypeUtil.ts'
import { sequenceModes } from '../sequenceModes.ts'

import type { SimpleFeatureSerialized } from '../../../util/index.ts'
import type {
  SequenceDisplayMode,
  SequenceFeatureDetailsModel,
} from '../model.ts'

const useStyles = makeStyles()({
  formControl: {
    margin: 0,
    marginLeft: 4,
  },
})

const SequenceTypeSelector = observer(function SequenceTypeSelector({
  model,
  feature,
  mode,
}: {
  model: SequenceFeatureDetailsModel
  feature: SimpleFeatureSerialized
  mode: SequenceDisplayMode
}) {
  const { classes } = useStyles()
  const { intronBp, upDownBp } = model
  return (
    <FormControl className={classes.formControl}>
      <Select
        size="small"
        value={mode}
        onChange={event => {
          model.setMode(event.target.value)
        }}
        aria-label="Sequence type"
      >
        {getAvailableModes(feature).map(key => (
          <MenuItem key={key} value={key} data-testid={`sequence_type_${key}`}>
            {sequenceModes[key].label({ intronBp, upDownBp })}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  )
})

export default SequenceTypeSelector
