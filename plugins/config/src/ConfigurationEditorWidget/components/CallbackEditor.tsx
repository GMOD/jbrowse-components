import { useState, useTransition } from 'react'

import { stringToJexlExpression } from '@jbrowse/core/util/jexlStrings'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { getEnv } from '@jbrowse/mobx-state-tree'
import HelpIcon from '@mui/icons-material/Help'
import { IconButton, TextField, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'

const fontFamily =
  'Consolas, "Andale Mono WT", "Andale Mono", "Lucida Console", "Lucida Sans Typewriter", "DejaVu Sans Mono", "Bitstream Vera Sans Mono", "Liberation Mono", "Nimbus Mono L", Monaco, "Courier New", Courier, monospace'

const useStyles = makeStyles()(theme => ({
  callbackEditor: {
    marginTop: '16px',
    borderBottom: `1px solid ${theme.palette.divider}`,
    width: '100%',
    fontFamily,
  },
  textAreaFont: {
    fontFamily,
  },
  callbackContainer: {
    width: '100%',
    overflowX: 'auto',
  },

  error: {
    color: 'red',
    fontSize: '0.8em',
  },
}))

function validateAndSetCode(
  code: string,
  slot: { set: (arg: string) => void },
  setCodeError: (e: unknown) => void,
) {
  try {
    const jexlCode = code.startsWith('jexl:') ? code : `jexl:${code}`

    if (jexlCode === 'jexl:') {
      throw new Error('Empty jexl expression is not valid')
    }
    stringToJexlExpression(jexlCode, getEnv(slot).pluginManager?.jexl)
    slot.set(jexlCode)
    setCodeError(undefined)
  } catch (e) {
    console.error({ e })
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
    contextVariable: string
  }
}) {
  const { classes } = useStyles()

  const [code, setCode] = useState(slot.value)
  const [error, setCodeError] = useState<unknown>()
  const [, startTransition] = useTransition()

  // if default value is a callback, will have to remove jexl:
  // do this last
  return (
    <>
      {error ? <p className={classes.error}>{`${error}`}</p> : null}
      <div className={classes.callbackContainer}>
        <TextField
          multiline
          className={classes.callbackEditor}
          value={code.startsWith('jexl:') ? code.split('jexl:')[1] : code}
          onChange={event => {
            const value = event.target.value
            setCode(value)
            startTransition(() => {
              validateAndSetCode(value, slot, setCodeError)
            })
          }}
          style={{ background: error ? '#fdd' : undefined }}
          slotProps={{
            input: {
              classes: {
                input: classes.textAreaFont,
              },
            },
          }}
        />

        <p>{slot.description}</p>
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
      </div>
    </>
  )
})

export default CallbackEditor
