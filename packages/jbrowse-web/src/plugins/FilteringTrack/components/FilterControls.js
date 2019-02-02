import React from 'react'
import ReactPropTypes from 'prop-types'
import { withStyles, FormControlLabel, Checkbox } from '@material-ui/core'
import { observer, PropTypes as MxPropTypes } from 'mobx-react'
import { getConf } from '../../../configuration'

const styles = theme => ({
  root: {
    background: theme.palette.background.default,
    overflow: 'auto',
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

function FilterControls({ classes, style, model }) {
  return (
    <div style={style} className={classes.root}>
      {getConf(model, 'filterAttributes').map(attrName => (
        <React.Fragment key={attrName}>
          <div>{attrName}</div>
          {visibleValues(model, attrName).map(value => (
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
        </React.Fragment>
      ))}
    </div>
  )
}
FilterControls.propTypes = {
  classes: ReactPropTypes.shape({ root: ReactPropTypes.string }).isRequired,
  style: ReactPropTypes.shape({ height: ReactPropTypes.any }),
  model: MxPropTypes.objectOrObservableObject.isRequired,
}
FilterControls.defaultProps = { style: {} }

export default withStyles(styles)(observer(FilterControls))
