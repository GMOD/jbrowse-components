import { getConf } from '@gmod/jbrowse-core/configuration'
import Checkbox from '@material-ui/core/Checkbox'
import FormControl from '@material-ui/core/FormControl'
import FormControlLabel from '@material-ui/core/FormControlLabel'
import FormGroup from '@material-ui/core/FormGroup'
import FormHelperText from '@material-ui/core/FormHelperText'
import FormLabel from '@material-ui/core/FormLabel'
import { withStyles } from '@material-ui/core/styles'
import Typography from '@material-ui/core/Typography'
import { reaction } from 'mobx'
import { observer, PropTypes as MxPropTypes } from 'mobx-react'
import ReactPropTypes from 'prop-types'
import React, { Component } from 'react'

const styles = theme => ({
  root: {
    background: theme.palette.background.default,
    overflow: 'auto',
    paddingTop: 0,
    paddingBottom: theme.spacing(1),
    paddingLeft: theme.spacing(1),
    paddingRight: theme.spacing(1),
    display: 'flex',
    flexWrap: 'wrap',
  },
  header: {
    width: '100%',
  },
  title: {
    // fontSize: '80%',
  },
})

function visibleValues(model, attrName) {
  const { features, filterOut } = model
  const values = new Set()
  for (const feature of features.values()) {
    values.add(feature.get(attrName))
  }
  if (filterOut.has(attrName)) {
    for (const value of filterOut.get(attrName).keys()) {
      values.add(value)
    }
  }
  return Array.from(values.values()).sort()
}

const AttributeFilter = withStyles(styles)(
  observer(({ attrName, model, classes, values }) => (
    <FormControl component="fieldset" className={classes.formControl}>
      <FormLabel component="legend">{attrName}</FormLabel>
      <FormGroup row>
        {!values.length ? (
          <FormHelperText style={{ marginRight: '1em' }}>
            no values seen yet
          </FormHelperText>
        ) : (
          values.map(value => (
            <FormControlLabel
              key={`${attrName}-${value}`}
              control={
                <Checkbox
                  checked={
                    !(
                      model.filterOut.has(attrName) &&
                      model.filterOut.get(attrName).get(String(value))
                    )
                  }
                  onChange={evt =>
                    model.toggleFilter(attrName, value, evt.target.checked)
                  }
                />
              }
              label={value}
            />
          ))
        )}
      </FormGroup>
    </FormControl>
  )),
)

AttributeFilter.propTypes = {
  attrName: ReactPropTypes.string.isRequired,
  model: MxPropTypes.objectOrObservableObject.isRequired,
  values: ReactPropTypes.arrayOf(ReactPropTypes.string).isRequired,
}

class FilterControls extends Component {
  constructor(props) {
    super(props)
    this.state = { seenAttributes: {} }
    const { model } = props
    this.autorunDisposer = reaction(
      () => {
        const newSeenAttributes = {}
        getConf(model, 'filterAttributes').forEach(attrName => {
          if (!newSeenAttributes[attrName]) newSeenAttributes[attrName] = {}
          visibleValues(model, attrName).forEach(value => {
            newSeenAttributes[attrName][value] = true
          })
        })
        return newSeenAttributes
      },
      newSeenAttributes => {
        this.setState(state => {
          const seenAttributes = {}
          Object.keys(newSeenAttributes).forEach(attrName => {
            seenAttributes[attrName] = {
              ...(state.seenAttributes[attrName] || {}),
              ...newSeenAttributes[attrName],
            }
          })
          return { seenAttributes }
        })
      },
      { delay: 400 },
    )
  }

  componentWillUnmount() {
    this.autorunDisposer()
  }

  render() {
    const { classes, style, model } = this.props
    const { seenAttributes } = this.state
    return (
      <div style={style} className={classes.root}>
        <div className={classes.header}>
          <Typography
            className={classes.title}
            variant="subtitle2"
            gutterBottom
          >
            Filters
          </Typography>
        </div>
        {Object.keys(seenAttributes)
          .sort()
          .map(attrName => (
            <AttributeFilter
              key={attrName}
              attrName={attrName}
              model={model}
              values={Object.keys(seenAttributes[attrName]).sort()}
            />
          ))}
      </div>
    )
  }
}
FilterControls.propTypes = {
  classes: ReactPropTypes.shape({
    root: ReactPropTypes.string,
    header: ReactPropTypes.string,
    title: ReactPropTypes.string,
  }).isRequired,
  style: ReactPropTypes.shape({ height: ReactPropTypes.any }),
  model: MxPropTypes.objectOrObservableObject.isRequired,
}

FilterControls.defaultProps = { style: {} }

export default withStyles(styles)(observer(FilterControls))
