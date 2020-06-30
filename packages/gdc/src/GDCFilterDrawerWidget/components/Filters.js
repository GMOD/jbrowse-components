import { v4 as uuidv4 } from 'uuid'

export default jbrowse => {
  const { makeStyles } = jbrowse.jbrequire('@material-ui/core/styles')
  const { observer } = jbrowse.jbrequire('mobx-react')
  const React = jbrowse.jbrequire('react')
  const { useState } = React

  const {
    MenuItem,
    FormControl,
    FormLabel,
    Select,
    Input,
    Checkbox,
    ListItemText,
    IconButton,
    List,
    ListItem,
    Tooltip,
  } = jbrowse.jbrequire('@material-ui/core')

  const { Add: AddIcon, Clear: ClearIcon } = jbrowse.jbrequire(
    '@material-ui/icons',
  )

  const useStyles = makeStyles(theme => ({
    root: {
      padding: theme.spacing(1, 3, 1, 1),
      background: theme.palette.background.default,
      overflowX: 'hidden',
    },
    formControl: {
      margin: theme.spacing(1),
      minWidth: 150,
    },
  }))

  /**
   * An element representing an individual filter with a category and set of applied values
   */
  const Filter = observer(props => {
    const classes = useStyles()
    const { schema, filterModel, facets } = props

    const [categoryValue, setCategoryValue] = useState(
      filterModel.category
        ? facets.find(f => f.name === filterModel.category)
        : facets[0],
    )
    const [filterValue, setFilterValue] = useState(
      filterModel.filter ? filterModel.filter.split(',') : [],
    )

    const handleChangeCategory = event => {
      setCategoryValue(event.target.value)
      setFilterValue([])
      filterModel.setCategory(event.target.value.name)
    }

    const handleChangeFilter = event => {
      setFilterValue(event.target.value)
      filterModel.setFilter(event.target.value.join(','))
      updateTrack(schema.filters, schema.target)
    }

    /**
     * Converts filter model objects to a GDC filter query and updates the track
     * @param {*} filters Array of filter model objects
     * @param {*} target Track target
     */
    function updateTrack(filters, target) {
      let gdcFilters = { op: 'and', content: [] }
      if (filters.length > 0) {
        for (const filter of filters) {
          if (filter.filter !== '') {
            gdcFilters.content.push({
              op: 'in',
              content: {
                field: `${filter.type}s.${filter.category}`,
                value: filter.filter.split(','),
              },
            })
          }
        }
      } else {
        gdcFilters = {}
      }
      target.adapter.filters.set(JSON.stringify(gdcFilters))
    }

    const handleFilterDelete = () => {
      schema.deleteFilter(filterModel.id)
      updateTrack(schema.filters, schema.target)
    }

    return (
      <>
        <List>
          <ListItem>
            <FormControl className={classes.formControl}>
              <Select
                labelId="category-select-label"
                id="category-select"
                value={categoryValue}
                onChange={handleChangeCategory}
                displayEmpty
              >
                <MenuItem disabled value="">
                  <em>Category</em>
                </MenuItem>
                {facets.map(filterOption => {
                  return (
                    <MenuItem value={filterOption} key={filterOption.name}>
                      {filterOption.prettyName}
                    </MenuItem>
                  )
                })}
              </Select>
            </FormControl>
            <FormControl className={classes.formControl}>
              <Select
                labelId="demo-mutiple-checkbox-label"
                id="demo-mutiple-checkbox"
                multiple
                value={filterValue}
                onChange={handleChangeFilter}
                input={<Input />}
                displayEmpty
                renderValue={selected => {
                  if (selected.length === 0) {
                    return <em>Filters</em>
                  }

                  return selected.join(', ')
                }}
              >
                <MenuItem disabled value="">
                  <em>Filters</em>
                </MenuItem>
                {categoryValue.values.map(name => (
                  <MenuItem key={name} value={name}>
                    <Checkbox checked={filterValue.indexOf(name) > -1} />
                    <ListItemText primary={name} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Tooltip
              title="Remove filter"
              aria-label="remove"
              placement="bottom"
            >
              <IconButton
                aria-label="remove filter"
                onClick={handleFilterDelete}
              >
                <ClearIcon />
              </IconButton>
            </Tooltip>
          </ListItem>
        </List>
      </>
    )
  })

  /**
   * A collection of filters along with a button to add new filters
   */
  const FilterList = observer(({ schema, type, facets }) => {
    const initialFilterSelection = facets[0].name

    const handleClick = () => {
      schema.addFilter(uuidv4(), initialFilterSelection, type, '')
    }

    return (
      <>
        <div>
          <FormLabel>{type} filters</FormLabel>
        </div>

        {schema.filters.map(filterModel => {
          if (filterModel.type === type) {
            return (
              <Filter
                schema={schema}
                {...{ filterModel }}
                key={filterModel.id}
                facets={facets}
              />
            )
          }
          return null
        })}
        <Tooltip title="Add a new filter" aria-label="add" placement="right">
          <IconButton aria-label="add" onClick={handleClick}>
            <AddIcon />
          </IconButton>
        </Tooltip>
      </>
    )
  })

  return { FilterList }
}
