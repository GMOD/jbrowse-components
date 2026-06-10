import { useState, useTransition } from 'react'

import { stringToJexlExpression } from '@jbrowse/core/util/jexlStrings'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import HelpIcon from '@mui/icons-material/Help'
import { IconButton, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'

import MonospaceTextField from './MonospaceTextField.tsx'

import type PluginManager from '@jbrowse/core/PluginManager'

const useStyles = makeStyles()(theme => ({
  callbackEditor: {
    marginTop: '16px',
    borderBottom: `1px solid ${theme.palette.divider}`,
    width: '100%',
  },
}))

function validateAndSetCode(
  code: string,
  slot: { set: (arg: string) => void; pluginManager: PluginManager },
  setCodeError: (e: unknown) => void,
) {
  // empty buffer is "in progress", not invalid — don't commit and don't warn
  const trimmed = code.trim()
  if (trimmed === '' || trimmed === 'jexl:') {
    setCodeError(undefined)
    return
  }
  try {
    const jexlCode = code.startsWith('jexl:') ? code : `jexl:${code}`
    stringToJexlExpression(jexlCode, slot.pluginManager.jexl)
    slot.set(jexlCode)
    setCodeError(undefined)
  } catch (e) {
    console.error(e)
    setCodeError(e)
  }
}

const CallbackEditor = observer(function CallbackEditor({
  slot,
}: {
  slot: {
    set: (arg: string) => void
    description: string
    name: string
    value: string
    contextVariable: string[]
    pluginManager: PluginManager
  }
}) {
  const { classes } = useStyles()

  const [code, setCode] = useState(slot.value)
  const [error, setCodeError] = useState<unknown>()
  const [, startTransition] = useTransition()

  // if default value is a callback, will have to remove jexl:
  // do this last
  return (
    <MonospaceTextField
      className={classes.callbackEditor}
      value={code}
      error={error}
      onChange={value => {
        setCode(value)
        startTransition(() => {
          validateAndSetCode(value, slot, setCodeError)
        })
      }}
    >
      <p>{slot.description}</p>
      <Tooltip
        title={
          <div>
            Callbacks are written in Jexl format. Click to learn more.
            <br /> Names of available context items:{' '}
            {slot.contextVariable.join(', ')}
          </div>
        }
        arrow
      >
        <IconButton
          color="primary"
          onClick={() => {
            window.open(
              'https://github.com/TomFrost/Jexl',
              '_blank',
              'noopener,noreferrer',
            )
          }}
        >
          <HelpIcon />
        </IconButton>
      </Tooltip>
    </MonospaceTextField>
  )
})

export default CallbackEditor
