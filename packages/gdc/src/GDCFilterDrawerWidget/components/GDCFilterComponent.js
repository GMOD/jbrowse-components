import { makeStyles } from '@material-ui/core/styles'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import React from 'react'
import Typography from '@material-ui/core/Typography'
import Alert from '@material-ui/lab/Alert'
import Icon from '@material-ui/core/Icon'
import { v4 as uuidv4 } from 'uuid'
import Tooltip from '@material-ui/core/Tooltip'
import { ssmFacets, geneFacets, caseFacets } from './Utility'
import { TrackType } from './TrackType'
import { FilterList } from './Filters'
import { MutationHighlightFeature } from './ColourFeatures'

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
      {schema.target.adapter.featureType.value === 'mutation' && (
        <MutationHighlightFeature schema={schema} />
      )}
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
