import React from 'react'
import {
  FormHelperText,
  FormControl,
  InputLabel,
  Input,
} from '@material-ui/core'
import { observer, inject } from 'mobx-react'
// import ReactPropTypes from 'prop-types'

// import Highlight from 'react-highlight.js'

// const Highlighter = props => {
//   const { value } = props

//   return <Highlight language="js">{value}</Highlight>
// }
// Highlighter.propTypes = {
//   value: ReactPropTypes.string.isRequired,
// }

const CallbackEditor = inject('classes')(
  observer(({ slot, slotSchema, classes }) => (
    <FormControl className={classes.callbackEditor}>
      <InputLabel htmlFor="callback-editor">{slot.name}</InputLabel>
      <Input
        value={slot.value}
        id="callback-editor"
        multiline
        onChange={evt => slot.set(evt.target.value)}
      />
      <FormHelperText>{slot.description}</FormHelperText>
    </FormControl>
  )),
)

export default CallbackEditor
