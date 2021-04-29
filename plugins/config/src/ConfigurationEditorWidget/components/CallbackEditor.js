import React, { useEffect, useState } from 'react'
import { useDebounce } from '@jbrowse/core/util'
import { stringToJexlExpression } from '@jbrowse/core/util/jexlStrings'
import FormControl from '@material-ui/core/FormControl'
import FormHelperText from '@material-ui/core/FormHelperText'
import InputLabel from '@material-ui/core/InputLabel'
import { makeStyles } from '@material-ui/core/styles'
import Tooltip from '@material-ui/core/Tooltip'
import IconButton from '@material-ui/core/IconButton'
import HelpIcon from '@material-ui/icons/Help'
import { getEnv } from 'mobx-state-tree'
import { observer, PropTypes } from 'mobx-react'
import Editor from 'react-simple-code-editor'

// fontSize and fontFamily have to match between Editor and SyntaxHighlighter
const fontSize = '12px'

// Optimize by using system default fonts:
// https://css-tricks.com/snippets/css/font-stacks/
const fontFamily =
  'Consolas, "Andale Mono WT", "Andale Mono", "Lucida Console", "Lucida Sans Typewriter", "DejaVu Sans Mono", "Bitstream Vera Sans Mono", "Liberation Mono", "Nimbus Mono L", Monaco, "Courier New", Courier, monospace'

const useStyles = makeStyles(theme => ({
  callbackEditor: {
    marginTop: '16px',
    borderBottom: `1px solid ${theme.palette.divider}`,
    fontFamily,
    fontSize,
  },
}))

function CallbackEditor({ slot }) {
  const classes = useStyles()

  const [code, setCode] = useState(slot.value)
  const [error, setCodeError] = useState()
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
      slot.set(jexlDebouncedCode) // slot.set `jexl:${debouncedCode}`
      setCodeError(null)
    } catch (e) {
      setCodeError(e)
    }
  }, [debouncedCode, slot])

  // if default value is a callback, will have to remove jexl:
  // do this last
  return (
    <>
      <FormControl>
        <InputLabel shrink htmlFor="callback-editor">
          {slot.name}
        </InputLabel>
        <Editor
          className={classes.callbackEditor}
          value={code.startsWith('jexl:') ? code.split('jexl:')[1] : code}
          onValueChange={newCode => {
            setCode(newCode)
          }}
          highlight={newCode => newCode}
          padding={10}
          style={{ background: error ? '#fdd' : undefined }}
        />
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
CallbackEditor.propTypes = {
  slot: PropTypes.objectOrObservableObject.isRequired,
}
export default observer(CallbackEditor)
