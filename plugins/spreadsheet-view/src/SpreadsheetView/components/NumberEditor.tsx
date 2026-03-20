import { useState } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'
import { TextField } from '@mui/material'
import { observer } from 'mobx-react'

import type { ImportWizardModel } from '../ImportWizard.ts'

const useStyles = makeStyles()({
  textField: {
    width: '2rem',
    verticalAlign: 'baseline',
  },
})

const NumberEditor = observer(function NumberEditor({
  model,
  disabled,
  modelPropName,
  modelSetterName,
}: {
  model: ImportWizardModel
  disabled: boolean
  modelPropName: string
  modelSetterName: string
}) {
  // @ts-expect-error
  const [val, setVal] = useState(model[modelPropName])
  const { classes } = useStyles()
  return (
    <TextField
      value={val}
      disabled={disabled}
      type="number"
      onChange={evt => {
        const v = evt.target.value
        const num = Number.parseInt(v, 10)
        if (!Number.isNaN(num) && num > 0) {
          // @ts-expect-error
          model[modelSetterName](num)
          setVal(v)
        } else if (!Number.isNaN(num) && num <= 0) {
          // @ts-expect-error
          model[modelSetterName](1)
          setVal(1)
        } else {
          setVal(v)
        }
      }}
      className={classes.textField}
    />
  )
})

export default NumberEditor
