import React, { useEffect, useState } from 'react'
import { useDebounce } from '@jbrowse/core/util'
import { stringToJexlExpression } from '@jbrowse/core/util/jexlStrings'
import {
  FormControl,
  FormHelperText,
  InputLabel,
  Tooltip,
  IconButton,
  TextField,
} from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import HelpIcon from '@mui/icons-material/Help'
import { getEnv } from 'mobx-state-tree'
import { observer } from 'mobx-react'

// Optimize by using system default fonts:
// https://css-tricks.com/snippets/css/font-stacks/
const fontFamily =
  'Consolas, "Andale Mono WT", "Andale Mono", "Lucida Console", "Lucida Sans Typewriter", "DejaVu Sans Mono", "Bitstream Vera Sans Mono", "Liberation Mono", "Nimbus Mono L", Monaco, "Courier New", Courier, monospace'

const useStyles = makeStyles()(theme => ({
  callbackEditor: {
    marginTop: '16px',
    borderBottom: `1px solid ${theme.palette.divider}`,
    fontFamily,
  },
  textAreaFont: {
    fontFamily,
  },
}))

function CallbackEditor({
  slot,
}: {
  slot: {
    set: (arg: string) => void
    description: string
    name: string
    value: string
    contextVariable: string
  }
}) {
  const { classes } = useStyles()

  const [code, setCode] = useState(slot.value)
  const [error, setCodeError] = useState<unknown>()
  const debouncedCode = useDebounce(code, 400)

  useEffect(() => {
    try {
      const jexlDebouncedCode = debouncedCode.startsWith('jexl:')
        ? debouncedCode
        : `jexl:${debouncedCode}`
      stringToJexlExpression(
        jexlDebouncedCode,
        getEnv(slot).pluginManager?.jexl,
      )
      slot.set(jexlDebouncedCode)
      setCodeError(undefined)
    } catch (e) {
      console.error({ e })
      setCodeError(e)
    }
  }, [debouncedCode, slot])

  // if default value is a callback, will have to remove jexl:
  // do this last
  console.log({ error })
  return (
    <>
      <FormControl>
        <InputLabel shrink htmlFor="callback-editor">
          {slot.name}
        </InputLabel>
        <TextField
          multiline
          className={classes.callbackEditor}
          value={code.startsWith('jexl:') ? code.split('jexl:')[1] : code}
          onChange={event => setCode(event.target.value)}
          style={{ background: error ? '#fdd' : undefined }}
          InputProps={{
            classes: {
              input: classes.textAreaFont,
            },
          }}
        />
        {error ? (
          <FormHelperText
            style={{ color: '#f00' }}
          >{`${error}`}</FormHelperText>
        ) : null}
        <FormHelperText>{slot.description}</FormHelperText>
      </FormControl>
      <Tooltip
        title={
          <div>
            Callbacks are written in Jexl format. Click to learn more.
            <br /> Names of available context items: {slot.contextVariable}
          </div>
        }
        arrow
      >
        <IconButton
          color="primary"
          onClick={() => {
            const newWindow = window.open(
              'https://github.com/TomFrost/Jexl',
              '_blank',
              'noopener,noreferrer',
            )
            if (newWindow) {
              newWindow.opener = null
            }
          }}
        >
          <HelpIcon />
        </IconButton>
      </Tooltip>
    </>
  )
}

export default observer(CallbackEditor)
