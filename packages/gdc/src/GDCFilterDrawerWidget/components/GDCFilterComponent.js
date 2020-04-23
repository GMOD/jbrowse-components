import { makeStyles } from '@material-ui/core/styles'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import React, { useState } from 'react'
import Typography from '@material-ui/core/Typography'
import Alert from '@material-ui/lab/Alert'
import MenuItem from '@material-ui/core/MenuItem'
import FormControl from '@material-ui/core/FormControl'
import FormLabel from '@material-ui/core/FormLabel'
import Select from '@material-ui/core/Select'
import Input from '@material-ui/core/Input'
import Checkbox from '@material-ui/core/Checkbox'
import ListItemText from '@material-ui/core/ListItemText'
import Icon from '@material-ui/core/Icon'
import IconButton from '@material-ui/core/IconButton'
import { v4 as uuidv4 } from 'uuid'
import List from '@material-ui/core/List'
import ListItem from '@material-ui/core/ListItem'
import Tooltip from '@material-ui/core/Tooltip'
import Table from '@material-ui/core/Table'
import TableBody from '@material-ui/core/TableBody'
import TableCell from '@material-ui/core/TableCell'
import TableHead from '@material-ui/core/TableHead'
import TableRow from '@material-ui/core/TableRow'
import {
  ssmFacets,
  geneFacets,
  caseFacets,
  mutationHighlightFeatures,
} from './Utility'

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
  filterCard: {
    margin: theme.spacing(1),
  },
  text: {
    display: 'flex',
    alignItems: 'center',
  },
}))

let isValidGDCFilter = true
let validationMessage = ''

/**
 * A component for changing the track type
 */
const TrackType = observer(props => {
  const classes = useStyles()
  const [trackType, setTrackType] = useState(props.adapter.featureType.value)

  const handleChange = event => {
    setTrackType(event.target.value)
    props.adapter.featureType.set(event.target.value)
  }
  return (
    <>
      <Typography variant="h6" className={classes.text}>
        Track Type
        <Tooltip
          title="Set the type of features to grab from the GDC portal"
          aria-label="help"
          placement="right"
        >
          <Icon>help</Icon>
        </Tooltip>
      </Typography>
      <List>
        <ListItem>
          <FormControl className={classes.formControl}>
            <Select
              labelId="track-type-select-label"
              id="track-type-select"
              value={trackType}
              onChange={handleChange}
              displayEmpty
            >
              <MenuItem disabled value="">
                <em>Track type</em>
              </MenuItem>
              <MenuItem value={'mutation'}>Mutation</MenuItem>
              <MenuItem value={'gene'}>Gene</MenuItem>
            </Select>
          </FormControl>
        </ListItem>
      </List>
    </>
  )
})

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

          <Tooltip title="Remove filter" aria-label="remove" placement="bottom">
            <IconButton aria-label="remove filter" onClick={handleFilterDelete}>
              <Icon>clear</Icon>
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
          <Icon>add</Icon>
        </IconButton>
      </Tooltip>
    </>
  )
})

/**
 * Render a highlight/colour by element for colouring features
 */
const HighlightFeature = observer(({ schema }) => {
  const classes = useStyles()
  const [highlightBy, setHighlightBy] = useState({})

  const handleChangeHighlightBy = event => {
    const hlBy = event.target.value
    setHighlightBy(event.target.value)

    if (hlBy.type === 'splitCount') {
      schema.target.renderer.color1.set(
        `function(feature) { if (feature.get('${hlBy.attributeName}') > ${hlBy.values[0].splitBy}) {return '${hlBy.values[0].colour1}'; } else {return '${hlBy.values[0].colour2}'; } }`,
      )
    } else if (hlBy.type === 'category') {
      if (
        hlBy.name === 'VEP' ||
        hlBy.name === 'SIFT' ||
        hlBy.name === 'PolyPhen'
      ) {
        let switchStatement = `switch(impact) {`
        hlBy.values.forEach(element => {
          switchStatement += `case '${element.name}': return '${element.colour}'; break;`
        })
        switchStatement += '}'
        schema.target.renderer.color1.set(
          `function(feature) { const filteredConsequences = feature.get('consequence').hits.edges.filter(cons => cons.node.transcript.is_canonical); const impact = filteredConsequences[0].node.transcript.annotation.${hlBy.attributeName}; ${switchStatement}}`,
        )
      }
    }
  }

  return (
    <>
      <Typography variant="h6" className={classes.text}>
        Colour Features
        <Tooltip
          title="Colour features on track based on feature attributes"
          aria-label="help"
          placement="right"
        >
          <Icon>help</Icon>
        </Tooltip>
      </Typography>
      <FormControl className={classes.formControl}>
        <Select
          labelId="category-select-label"
          id="category-select"
          value={highlightBy}
          onChange={handleChangeHighlightBy}
          displayEmpty
        >
          <MenuItem disabled value="">
            <em>Attribute</em>
          </MenuItem>
          {mutationHighlightFeatures.map(element => {
            return (
              <MenuItem value={element} key={element.name}>
                {element.name}
              </MenuItem>
            )
          })}
        </Select>
      </FormControl>
      {highlightBy && highlightBy.values && (
        <div>
          <Typography variant="subtitle2" className={classes.text}>
            {highlightBy.description}
          </Typography>
          {highlightBy.values && highlightBy.type === 'category' && (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Value</TableCell>
                  <TableCell>Colour</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {highlightBy.values &&
                  highlightBy.values.map(value => {
                    return (
                      <TableRow key={value.name}>
                        <TableCell>{value.name}</TableCell>
                        <TableCell>{value.colour}</TableCell>
                      </TableRow>
                    )
                  })}
              </TableBody>
            </Table>
          )}

          {highlightBy.values && highlightBy.type === 'splitCount' && (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Value</TableCell>
                  <TableCell>Split By</TableCell>
                  <TableCell>Lower Colour</TableCell>
                  <TableCell>Higher Colour</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {highlightBy.values &&
                  highlightBy.values.map(value => {
                    return (
                      <TableRow key={value.name}>
                        <TableCell>{value.name}</TableCell>
                        <TableCell>{value.splitBy}</TableCell>
                        <TableCell>{value.colour1}</TableCell>
                        <TableCell>{value.colour2}</TableCell>
                      </TableRow>
                    )
                  })}
              </TableBody>
            </Table>
          )}
        </div>
      )}
    </>
  )
})

/**
 * Creates corresponding filter models for existing filters from track
 * Assumes that the track filters are in a specific format
 * @param {*} schema schema
 */
function loadFilters(schema) {
  setValidationMessage('', true)
  try {
    const filters = JSON.parse(schema.target.adapter.filters.value)
    if (filters.content && filters.content.length > 0) {
      for (const filter of filters.content) {
        let type
        if (filter.content.field.startsWith('cases.')) {
          type = 'case'
        } else if (filter.content.field.startsWith('ssms.')) {
          type = 'ssm'
        } else if (filter.content.field.startsWith('genes.')) {
          type = 'gene'
        } else {
          setValidationMessage(
            `The filter ${filter.content.field} is missing a type prefix and is invalid. Any changes on this panel will overwrite invalid filters.`,
            false,
          )
        }
        if (type) {
          const name = filter.content.field.replace(`${type}s.`, '')
          schema.addFilter(uuidv4(), name, type, filter.content.value.join(','))
        }
      }
    }
  } catch (error) {
    setValidationMessage(
      'The current filters are not in the expected format. Any changes on this panel will overwrite invalid filters.',
      false,
    )
  }
}

/**
 * Creates the form for interacting with the track filters
 */
const GDCQueryBuilder = observer(({ schema }) => {
  schema.clearFilters()
  loadFilters(schema)

  const classes = useStyles()
  return (
    <>
      {!isValidGDCFilter && <Alert severity="info">{validationMessage}</Alert>}
      <TrackType {...schema.target} />
      <Typography variant="h6" className={classes.text}>
        Filters
        <Tooltip
          title="Apply filters to the current track"
          aria-label="help"
          placement="right"
        >
          <Icon>help</Icon>
        </Tooltip>
      </Typography>
      <FilterList schema={schema} type="case" facets={caseFacets} />
      <FilterList schema={schema} type="gene" facets={geneFacets} />
      <FilterList schema={schema} type="ssm" facets={ssmFacets} />
      <HighlightFeature schema={schema} />
    </>
  )
})

function ConfigurationEditor({ model }) {
  const classes = useStyles()

  return (
    <div className={classes.root} data-testid="configEditor">
      {!model.target ? (
        'no target set'
      ) : (
        <GDCQueryBuilder schema={model} key="configEditor" />
      )}
    </div>
  )
}
ConfigurationEditor.propTypes = {
  model: MobxPropTypes.objectOrObservableObject.isRequired,
}

/**
 * Updates the validation message for filters
 * @param {*} msg Message to display if invalid
 * @param {*} isValid Do not display if valid
 */
function setValidationMessage(msg, isValid) {
  validationMessage = msg
  isValidGDCFilter = isValid
}

export default observer(ConfigurationEditor)
