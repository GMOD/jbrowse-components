import {
  FormControl,
  FormHelperText,
  InputLabel,
  withStyles,
} from '@material-ui/core'
import debounce from 'debounce'
import { observer, PropTypes } from 'mobx-react'
import ReactPropTypes from 'prop-types'
import React, { Component } from 'react'
import Editor from 'react-simple-code-editor'
import { highlight, languages } from 'prismjs/components/prism-core'
import 'prismjs/components/prism-clike'
import 'prismjs/components/prism-javascript'
import 'prismjs/themes/prism.css'

const styles = { callbackEditor: {} }

@withStyles(styles)
@observer
class CallbackEditor extends Component {
  static propTypes = {
    slot: PropTypes.objectOrObservableObject.isRequired,
    classes: ReactPropTypes.shape({
      callbackEditor: ReactPropTypes.string.isRequired,
    }).isRequired,
  }

  constructor(props) {
    super(props)
    const { slot } = props
    this.state = { code: slot.value }

    this.updateSlot = debounce(code => slot.set(code), 400)
  }

  render() {
    const { slot, classes } = this.props
    const { code } = this.state
    return (
      <FormControl className={classes.callbackEditor}>
        <InputLabel shrink htmlFor="callback-editor">
          {slot.name}
        </InputLabel>
        <div
          style={{
            marginTop: '16px',
            borderBottom: '1px solid rgba(0,0,0,0.42)',
          }}
        >
          <Editor
            value={code}
            onValueChange={newCode => {
              this.setState({ code: newCode })
              this.updateSlot(newCode)
            }}
            highlight={newCode =>
              highlight(newCode, languages.javascript, 'javascript')
            }
            padding={10}
            style={{
              fontFamily: '"Fira code", "Fira Mono", monospace',
              fontSize: '90%',
            }}
          />
        </div>
        <FormHelperText>{slot.description}</FormHelperText>
      </FormControl>
    )
  }
}

export default CallbackEditor
