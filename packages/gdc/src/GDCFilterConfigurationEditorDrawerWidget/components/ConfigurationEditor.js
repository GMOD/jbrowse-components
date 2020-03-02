import {
  getTypeNamesFromExplicitlyTypedUnion,
  isConfigurationSchemaType,
  isConfigurationSlotType,
} from '@gmod/jbrowse-core/configuration/configurationSchema'
import { iterMap } from '@gmod/jbrowse-core/util'
import FormGroup from '@material-ui/core/FormGroup'
import FormLabel from '@material-ui/core/FormLabel'
import { makeStyles } from '@material-ui/core/styles'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import { getMembers } from 'mobx-state-tree'
import React, { Fragment } from 'react'
import Card from '@material-ui/core/Card'
import CardActions from '@material-ui/core/CardActions'
import CardContent from '@material-ui/core/CardContent'
import Button from '@material-ui/core/Button'
import Typography from '@material-ui/core/Typography'
import InputLabel from '@material-ui/core/InputLabel'
import MenuItem from '@material-ui/core/MenuItem'
import FormHelperText from '@material-ui/core/FormHelperText'
import FormControl from '@material-ui/core/FormControl'
import Select from '@material-ui/core/Select'
import Input from '@material-ui/core/Input'
import Checkbox from '@material-ui/core/Checkbox'
import ListItemText from '@material-ui/core/ListItemText'
import Fab from '@material-ui/core/Fab'
import AddIcon from '@material-ui/icons/Add'
import DeleteIcon from '@material-ui/icons/Delete'
import IconButton from '@material-ui/core/IconButton'
import { v4 as uuidv4 } from 'uuid'

const facets = [
  {
    name: 'primary_site',
    description: 'The primary site of the cancer',
    values: ['brain', 'breast', 'kidney', 'ovary'],
  },
  {
    name: 'project.project_id',
    description: 'The project the case belongs to',
    values: ['TCGA-BRCA', 'TCGA-GBM', 'TCGA-OV'],
  },
]
const useStyles = makeStyles(theme => ({
  root: {
    padding: theme.spacing(1, 3, 1, 1),
    background: theme.palette.background.default,
    overflowX: 'hidden',
  },
  formControl: {
    margin: theme.spacing(1),
    minWidth: 120,
  },
  filterCard: {
    margin: theme.spacing(1),
  },
}))

const TrackType = observer(props => {
  const classes = useStyles()
  const [trackType, setTrackType] = React.useState(
    props.adapter.featureType.value,
  )

  const handleChange = event => {
    setTrackType(event.target.value)
    props.adapter.featureType.set(event.target.value)
  }
  return (
    <>
      <Typography variant="h6" gutterBottom>
        Track Settings
      </Typography>
      <Card>
        <CardContent>
          <FormControl className={classes.formControl}>
            <InputLabel id="track-type-select-label">Track Type</InputLabel>
            <Select
              labelId="track-type-select-label"
              id="track-type-select"
              value={trackType}
              onChange={handleChange}
            >
              <MenuItem value={'mutation'}>Mutation</MenuItem>
              <MenuItem value={'gene'}>Gene</MenuItem>
            </Select>
            <FormHelperText>The type of track to display</FormHelperText>
          </FormControl>
        </CardContent>
      </Card>
    </>
  )
})

const Filter = observer(props => {
  const classes = useStyles()
  const { schema, filterObject } = props
  const [categoryValue, setCategoryValue] = React.useState(facets[0])
  const [filterValue, setFilterValue] = React.useState([])

  const handleChangeFilter = event => {
    setFilterValue(event.target.value)
    filterObject.setFilter(event.target.value.join(','))
    updateTrack(schema.filters, schema.target)
  }

  function updateTrack(filters, target) {
    const gdcFilters = { op: 'and', content: [] }
    for (const filter of filters) {
      if (filter.filter !== '') {
        gdcFilters.content.push({
          op: 'in',
          content: {
            field: `cases.${filter.category}`,
            value: filter.filter.split(','),
          },
        })
      }
    }
    target.adapter.filters.set(JSON.stringify(gdcFilters))
    console.log(gdcFilters)
  }

  const handleChangeCategory = event => {
    setCategoryValue(event.target.value)
    setFilterValue([])
    filterObject.setCategory(event.target.value.name)
  }

  const handleFilterDelete = event => {
    schema.deleteFilter(filterObject.id)
  }

  return (
    <>
      <Card className={classes.filterCard}>
        <CardContent>
          <FormControl className={classes.formControl}>
            <InputLabel id="category-select-label">Category</InputLabel>
            <Select
              labelId="category-select-label"
              id="category-select"
              value={categoryValue}
              onChange={handleChangeCategory}
            >
              {facets.map(filterOption => {
                return (
                  <MenuItem value={filterOption} key={filterOption.name}>
                    {filterOption.name}
                  </MenuItem>
                )
              })}
            </Select>
          </FormControl>
          <FormControl className={classes.formControl}>
            <InputLabel id="demo-mutiple-checkbox-label">Filter</InputLabel>
            <Select
              labelId="demo-mutiple-checkbox-label"
              id="demo-mutiple-checkbox"
              multiple
              value={filterValue}
              onChange={handleChangeFilter}
              input={<Input />}
              renderValue={selected => selected.join(', ')}
            >
              {categoryValue.values.map(name => (
                <MenuItem key={name} value={name}>
                  <Checkbox checked={filterValue.indexOf(name) > -1} />
                  <ListItemText primary={name} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormHelperText>{categoryValue.description}</FormHelperText>
        </CardContent>
        <CardActions disableSpacing>
          <IconButton aria-label="delete filter" onClick={handleFilterDelete}>
            <DeleteIcon />
          </IconButton>
        </CardActions>
      </Card>
    </>
  )
})

const GDCQueryBuilder = observer(({ schema }) => {
  const handleClick = event => {
    schema.addFilter(uuidv4(), facets[0].name, 'case', '')
  }

  const handleClickClear = event => {
    schema.clearFilters()
  }

  return (
    <>
      {<TrackType {...schema.target} />}
      <Typography variant="h6" gutterBottom>
        Case Filters
      </Typography>
      {schema.filters.map(filterObject => {
        return (
          <Filter schema={schema} {...{ filterObject }} key={filterObject.id} />
        )
      })}
      <Fab color="primary" aria-label="add" onClick={handleClick}>
        <AddIcon />
      </Fab>
      <Fab color="primary" aria-label="add" onClick={handleClickClear}>
        <DeleteIcon />
      </Fab>
    </>
  )
})

function ConfigurationEditor({ model }) {
  const classes = useStyles()
  // updateTrack(model.filters, model.target)
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

export default observer(ConfigurationEditor)
