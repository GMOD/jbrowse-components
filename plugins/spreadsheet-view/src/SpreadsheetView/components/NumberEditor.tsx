import React, { useState, useEffect } from 'react'
import { TextField } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

// locals
import type { ImportWizardModel } from '../models/ImportWizard'

const useStyles = makeStyles()({
  textField: {
    width: '2rem',
    verticalAlign: 'baseline',
  },
})

const NumberEditor = observer(function ({
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
  useEffect(() => {
    const num = Number.parseInt(val, 10)
    if (!Number.isNaN(num)) {
      if (num > 0) {
        // @ts-expect-error
        model[modelSetterName](num)
      } else {
        setVal(1)
      }
    }
  }, [model, modelSetterName, val])
  return (
    <TextField
      value={val}
      disabled={disabled}
      type="number"
      onChange={evt => {
        setVal(evt.target.value)
      }}
      className={classes.textField}
    />
  )
})

export default NumberEditor
