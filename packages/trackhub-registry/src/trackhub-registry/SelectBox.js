import FormControl from '@material-ui/core/FormControl'
import FormHelperText from '@material-ui/core/FormHelperText'
import InputLabel from '@material-ui/core/InputLabel'
import MenuItem from '@material-ui/core/MenuItem'
import Select from '@material-ui/core/Select'
import { withStyles } from '@material-ui/core/styles'
import PropTypes from 'prop-types'
import React from 'react'

const styles = theme => ({
  formControl: {
    minWidth: 192,
    marginLeft: theme.spacing.unit * 2,
    marginRight: theme.spacing.unit * 2,
  },
})

function SelectBox(props) {
  const {
    classes,
    selectList,
    selectedItem,
    handleSelect,
    label,
    helpText,
  } = props
  return (
    <FormControl className={classes.formControl}>
      <InputLabel>{label}</InputLabel>
      <Select value={selectedItem} onChange={handleSelect}>
        {selectList.map(item => {
          let value
          let description
          if (item.name) {
            value = item.name
            description = `${item.name} (${item.synonyms.join(' ')})`
          }
          return (
            <MenuItem key={description || item} value={value || item}>
              {description || item}
            </MenuItem>
          )
        })}
      </Select>
      <FormHelperText>{selectedItem ? '' : helpText}</FormHelperText>
    </FormControl>
  )
}

SelectBox.propTypes = {
  selectList: PropTypes.arrayOf(
    PropTypes.oneOfType([PropTypes.string, PropTypes.shape()]),
  ).isRequired,
  selectedItem: PropTypes.string.isRequired,
  handleSelect: PropTypes.func.isRequired,
  label: PropTypes.string.isRequired,
  helpText: PropTypes.string.isRequired,
  classes: PropTypes.objectOf(PropTypes.string).isRequired,
}

export default withStyles(styles)(SelectBox)
