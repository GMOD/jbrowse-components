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

const styles = theme => ({
  callbackEditor: {
    marginTop: '16px',
    borderBottom: `1px solid ${theme.palette.divider}`,
    // Optimize by using system default fonts: https://css-tricks.com/snippets/css/font-stacks/
    fontFamily:
      'Consolas, "Andale Mono WT", "Andale Mono", "Lucida Console", "Lucida Sans Typewriter", "DejaVu Sans Mono", "Bitstream Vera Sans Mono", "Liberation Mono", "Nimbus Mono L", Monaco, "Courier New", Courier, monospace',
    fontSize: '90%',
  },
})

class CallbackEditor extends Component {
  static propTypes = {
    slot: PropTypes.objectOrObservableObject.isRequired,
    classes: ReactPropTypes.objectOf(ReactPropTypes.string).isRequired,
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
      <FormControl>
        <InputLabel shrink htmlFor="callback-editor">
          {slot.name}
        </InputLabel>
        <Editor
          className={classes.callbackEditor}
          value={code}
          onValueChange={newCode => {
            this.setState({ code: newCode })
            this.updateSlot(newCode)
          }}
          highlight={newCode =>
            highlight(newCode, languages.javascript, 'javascript')
          }
          padding={10}
        />
        <FormHelperText>{slot.description}</FormHelperText>
      </FormControl>
    )
  }
}

export default withStyles(styles)(observer(CallbackEditor))
