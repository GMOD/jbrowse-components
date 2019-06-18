import Paper from '@material-ui/core/Paper'
import { withStyles } from '@material-ui/core/styles'
import Divider from '@material-ui/core/Divider'
import CardHeader from '@material-ui/core/CardHeader'
import CardContent from '@material-ui/core/CardContent'
import Card from '@material-ui/core/Card'
import Table from '@material-ui/core/Table'
import TableBody from '@material-ui/core/TableBody'
import TableCell from '@material-ui/core/TableCell'
import TableHead from '@material-ui/core/TableHead'
import TableRow from '@material-ui/core/TableRow'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import PropTypes from 'prop-types'
import React from 'react'

const styles = theme => ({
  table: {
    padding: 0,
  },
  valueCell: {
    wordWrap: 'break-word',
    padding: theme.spacing.unit,
  },
  fieldName: {
    display: 'inline-block',
    minWidth: '90px',
    fontSize: '0.9em',
    borderBottom: '1px solid #0003',
    backgroundColor: '#ddd',
    marginRight: theme.spacing.unit,
    padding: 0.5 * theme.spacing.unit,
  },
  fieldValue: {
    display: 'inline-block',
    fontSize: '0.8em',
  },
  header: {
    padding: 0.5 * theme.spacing.unit,
    backgroundColor: '#ddd',
  },
  title: {
    fontSize: '1em',
  },
})

const coreRenderedDetails = [
  'Position',
  'Description',
  'Name',
  'Length',
  'Type',
]

const VariantCard = props => {
  const { children, classes, title } = props
  return (
    <Card>
      <CardHeader
        classes={{ root: classes.header, title: classes.title }}
        title={title}
      />

      <CardContent>{children}</CardContent>
    </Card>
  )
}

const VariantCoreDetails = props => {
  const { feature, classes } = props
  const { refName, start, end } = feature
  feature.position = `${refName}:${start}..${end}`
  feature.length = end - start
  return (
    <VariantCard {...props} title="Primary data">
      {coreRenderedDetails.map(key => {
        const value = feature[key.toLowerCase()]
        return (
          value && (
            <div className={classes.fieldRow} key={key}>
              <div className={classes.fieldName}>{key}</div>
              <div className={classes.fieldValue}>
                {String(value.values || value)}
              </div>
            </div>
          )
        )
      })}
    </VariantCard>
  )
}

const VariantAttributes = props => {
  const { feature, classes } = props

  // get everything in INFO plus the REF, ALT, and QUAL fields
  const attributes = Object.entries(feature.INFO).concat(
    ['REF', 'ALT', 'QUAL'].map(s => [s, feature[s]]),
  )
  return (
    <VariantCard {...props} title="Attributes">
      {attributes.map(
        ([key, value]) =>
          value && (
            <div className={classes.fieldRow} key={key}>
              <div className={classes.fieldName}>{key}</div>
              <div className={classes.fieldValue}>
                {String(
                  typeof value.values !== 'function' && value.values
                    ? value.values
                    : value,
                )}
              </div>
            </div>
          ),
      )}
    </VariantCard>
  )
}

const VariantSamples = props => {
  const { feature, classes } = props
  if (!feature.samples) {
    return null
  }
  const ret = Object.keys(feature.samples)
  const infoFields = Object.keys(feature.samples[ret[0]])

  return (
    <VariantCard {...props} title="Samples">
      <Table className={classes.table}>
        <TableHead>
          <TableRow>
            <TableCell>Sample</TableCell>
            {infoFields.map(f => (
              <TableCell key={f}>{f}</TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {Object.entries(feature.samples).map(
            ([key, value]) =>
              value && (
                <TableRow key={key}>
                  <TableCell component="th" scope="row">
                    {key}
                  </TableCell>
                  {infoFields.map(f => (
                    <TableCell className={classes.valueCell} key={f}>
                      {value[f]}
                    </TableCell>
                  ))}
                </TableRow>
              ),
          )}
        </TableBody>
      </Table>
    </VariantCard>
  )
}

function VariantFeatureDetails(props) {
  const { classes, model } = props
  const feat = JSON.parse(JSON.stringify(model.featureData))
  return (
    <Paper className={classes.root} data-testid="variant-side-drawer">
      <VariantCoreDetails feature={feat} {...props} />
      <Divider />
      <VariantAttributes feature={feat} {...props} />
      <Divider />
      <VariantSamples feature={feat} {...props} />
    </Paper>
  )
}

VariantFeatureDetails.propTypes = {
  model: MobxPropTypes.observableObject.isRequired,
  classes: PropTypes.objectOf(PropTypes.string).isRequired,
}

export default withStyles(styles)(observer(VariantFeatureDetails))
