import { useState, useTransition } from 'react'

import { MonospaceTextField } from '@jbrowse/core/ui'
import {
  ensureJexlPrefix,
  stringToJexlExpression,
} from '@jbrowse/core/util/jexlStrings'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import HelpIcon from '@mui/icons-material/Help'
import { IconButton, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'

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
    const jexlCode = ensureJexlPrefix(code)
    stringToJexlExpression(jexlCode, slot.pluginManager.jexl)
    slot.set(jexlCode)
    setCodeError(undefined)
  } catch (e) {
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

  const [draft, setDraft] = useState<string>()
  const [codeError, setCodeError] = useState<unknown>()
  const [, startTransition] = useTransition()
  return (
    <MonospaceTextField
      className={classes.callbackEditor}
      value={draft ?? slot.value}
      error={codeError}
      onChange={value => {
        setDraft(value)
        startTransition(() => {
          validateAndSetCode(value, slot, setCodeError)
        })
      }}
      onBlur={() => {
        if (!codeError) {
          setDraft(undefined)
        }
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
              'https://jbrowse.org/jb2/docs/config_guides/jexl/',
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
