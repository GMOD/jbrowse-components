import ClearIcon from '@material-ui/icons/Clear'
import FilterIcon from '@material-ui/icons/FilterList'

export default pluginManager => {
  const { jbrequire } = pluginManager
  const { observer } = jbrequire('mobx-react')
  const React = jbrequire('react')
  const { useEffect, useState } = React
  const { makeStyles } = jbrequire('@material-ui/core/styles')
  const IconButton = jbrequire('@material-ui/core/IconButton')
  const InputAdornment = jbrequire('@material-ui/core/InputAdornment')
  const { useDebounce } = jbrequire('@gmod/jbrowse-core/util')
  const TextField = jbrequire('@material-ui/core/TextField')

  const useStyles = makeStyles((/* theme */) => {
    return {
      textFilterControlEndAdornment: { marginRight: '-18px' },
    }
  })

  const TextFilter = observer(({ textFilter }) => {
    const classes = useStyles()
    // this paragraph is silliness to debounce the text filter input
    const [textFilterValue, setTextFilterValue] = useState(
      textFilter.stringToFind,
    )
    const debouncedTextFilter = useDebounce(textFilterValue, 500)
    useEffect(() => {
      textFilter.setString(debouncedTextFilter)
    }, [debouncedTextFilter, textFilter])

    return (
      <div className={classes.filterControls}>
        <TextField
          label="text filter"
          value={textFilterValue}
          onChange={evt => setTextFilterValue(evt.target.value)}
          className={classes.textFilterControl}
          margin="dense"
          variant="outlined"
          InputProps={{
            startAdornment: (
              <InputAdornment
                className={classes.textFilterControlStartAdornment}
                position="start"
              >
                <FilterIcon fontSize="small" />
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment
                className={classes.textFilterControlEndAdornment}
                position="end"
              >
                <IconButton
                  aria-label="clear filter"
                  onClick={() => setTextFilterValue('')}
                  color="secondary"
                >
                  <ClearIcon />
                </IconButton>
              </InputAdornment>
            ),
          }}
        />
      </div>
    )
  })

  const FilterControls = observer(({ model }) => {
    // const classes = useStyles()
    const textFilter = model.filterControls.rowFullText
    return <TextFilter textFilter={textFilter} />
  })

  return FilterControls
}
