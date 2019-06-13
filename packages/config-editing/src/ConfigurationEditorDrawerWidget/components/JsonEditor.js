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

const styles = {
  callbackEditor: {
    // Optimize by using system default fonts: https://css-tricks.com/snippets/css/font-stacks/
    fontFamily:
      'Consolas, "Andale Mono WT", "Andale Mono", "Lucida Console", "Lucida Sans Typewriter", "DejaVu Sans Mono", "Bitstream Vera Sans Mono", "Liberation Mono", "Nimbus Mono L", Monaco, "Courier New", Courier, monospace',
    fontSize: '90%',
    overflowX: 'auto',
    marginTop: '16px',
    borderBottom: '1px solid rgba(0,0,0,0.42)',
  },
}

class JsonEditor extends Component {
  static propTypes = {
    slot: PropTypes.objectOrObservableObject.isRequired,
    classes: ReactPropTypes.objectOf(ReactPropTypes.string).isRequired,
  }

  constructor(props) {
    super(props)
    const { slot } = props
    this.state = { code: JSON.stringify(slot.value, null, '  '), error: false }

    this.updateSlot = debounce(code => {
      try {
        slot.set(JSON.parse(code))
        this.setState({ error: false })
      } catch (error) {
        this.setState({ error: true })
      }
    }, 400)
  }

  onValueChange = newCode => {
    this.setState({ code: newCode })
    this.updateSlot(newCode)
  }

  render() {
    const { slot, classes } = this.props
    const { code, error } = this.state
    return (
      <FormControl error={error}>
        <InputLabel shrink htmlFor="callback-editor">
          {`${slot.name}${error ? ' (invalid JSON)' : ''}`}
        </InputLabel>
        <Editor
          className={classes.callbackEditor}
          value={code}
          onValueChange={this.onValueChange}
          highlight={newCode =>
            highlight(newCode, languages.javascript, 'javascript')
          }
          padding={10}
          style={{}}
        />
        <FormHelperText>{slot.description}</FormHelperText>
      </FormControl>
    )
  }
}

export default withStyles(styles)(observer(JsonEditor))
