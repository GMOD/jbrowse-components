import { v4 as uuidv4 } from 'uuid'

import { ssmFacets, geneFacets, caseFacets } from './Utility'

export default jbrowse => {
  const { makeStyles, Typography, Tooltip } = jbrowse.jbrequire(
    '@material-ui/core',
  )
  const { observer, PropTypes: MobxPropTypes } = jbrowse.jbrequire('mobx-react')
  const React = jbrowse.lib.react
  const { useState, useEffect } = React
  const { Alert } = jbrowse.jbrequire('@material-ui/lab')
  const { Help: HelpIcon } = jbrowse.jbrequire('@material-ui/icons')
  const { FilterList } = jbrowse.jbrequire(require('./Filters'))
  const { HighlightFeature } = jbrowse.jbrequire(require('./ColourFeatures'))
  const TrackType = jbrowse.jbrequire(require('./TrackType'))

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

  /**
   * Creates the form for interacting with the track filters
   */
  const GDCQueryBuilder = observer(({ schema }) => {
    const [isValidGDCFilter, setIsValidGDCFilter] = useState(true)
    const [isValidColourBy, setIsValidColourBy] = useState(true)
    const [validationMessage, setFilterValidationMessage] = useState('')
    const [colourValidationMessage, setColourValidationMessage] = useState('')

    schema.clearFilters()
    useEffect(() => {
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
              setIsValidGDCFilter(false)
              setFilterValidationMessage(
                `The filter ${filter.content.field} is missing a type prefix and is invalid. Any changes on this panel will overwrite invalid filters.`,
              )
            }
            if (type) {
              const name = filter.content.field.replace(`${type}s.`, '')
              schema.addFilter(
                uuidv4(),
                name,
                type,
                filter.content.value.join(','),
              )
            }
          }
        }
      } catch (error) {
        setIsValidGDCFilter(false)
        setFilterValidationMessage(
          'The current filters are not in the expected format. Any changes on this panel will overwrite invalid filters.',
        )
      }
    }, [schema])
    useEffect(() => {
      try {
        const colourBy = JSON.parse(schema.target.adapter.colourBy.value)
        const expectedAttributes = [
          'name',
          'type',
          'attributeName',
          'values',
          'description',
        ]

        let matchingKeys = true
        expectedAttributes.forEach(key => {
          if (!(key in colourBy)) {
            matchingKeys = false
          }
        })
        if (matchingKeys || Object.keys(colourBy).length === 0) {
          schema.setColourBy(colourBy)
        } else {
          setIsValidColourBy(false)
          setColourValidationMessage(
            'The current colour by option is not in the expected format. Any changes on this panel will overwrite the invalid selection.',
          )
        }
      } catch (error) {
        setIsValidColourBy(false)
        setColourValidationMessage(
          'The current colour by option is not in the expected format. Any changes on this panel will overwrite the invalid selection.',
        )
      }
    }, [schema])

    const classes = useStyles()
    return (
      <>
        {!isValidGDCFilter && (
          <Alert severity="info">{validationMessage}</Alert>
        )}
        <TrackType schema={schema} />
        <Typography variant="h6" className={classes.text}>
          Filters
          <Tooltip
            title="Apply filters to the current track"
            aria-label="help"
            placement="right"
          >
            <HelpIcon />
          </Tooltip>
        </Typography>
        <FilterList schema={schema} type="case" facets={caseFacets} />
        <FilterList schema={schema} type="gene" facets={geneFacets} />
        <FilterList schema={schema} type="ssm" facets={ssmFacets} />
        {!isValidColourBy && (
          <Alert severity="info">{colourValidationMessage}</Alert>
        )}
        {schema.target.adapter.featureType.value === 'mutation' && (
          <HighlightFeature schema={schema} type="mutation" />
        )}

        {schema.target.adapter.featureType.value === 'gene' && (
          <HighlightFeature schema={schema} type="gene" />
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

  return observer(ConfigurationEditor)
}
