import React, { Component } from 'react'
import ReactPropTypes from 'prop-types'
import {
  withStyles,
  FormControlLabel,
  Checkbox,
  FormLabel,
  FormControl,
  FormGroup,
} from '@material-ui/core'
import { observer, PropTypes as MxPropTypes } from 'mobx-react'
import { reaction } from 'mobx'

import { getConf } from '../../../configuration'

const styles = theme => ({
  root: {
    background: theme.palette.background.default,
    overflow: 'auto',
    padding: theme.spacing.unit,
    display: 'flex',
    flexWrap: 'wrap',
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
        {values.map(value => (
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
        ))}
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
  static propTypes = {
    classes: ReactPropTypes.shape({ root: ReactPropTypes.string }).isRequired,
    style: ReactPropTypes.shape({ height: ReactPropTypes.any }),
    model: MxPropTypes.objectOrObservableObject.isRequired,
  }

  static defaultProps = { style: {} }

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

export default withStyles(styles)(observer(FilterControls))
