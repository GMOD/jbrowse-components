import { makeStyles } from '@material-ui/core'
import Card from '@material-ui/core/Card'
import CardContent from '@material-ui/core/CardContent'
import CardHeader from '@material-ui/core/CardHeader'
import Divider from '@material-ui/core/Divider'
import Paper from '@material-ui/core/Paper'
import Table from '@material-ui/core/Table'
import TableBody from '@material-ui/core/TableBody'
import TableCell from '@material-ui/core/TableCell'
import TableHead from '@material-ui/core/TableHead'
import TableRow from '@material-ui/core/TableRow'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import PropTypes from 'prop-types'
import React from 'react'

const useStyles = makeStyles(theme => ({
  table: {
    padding: 0,
  },
  valueCell: {
    wordWrap: 'break-word',
    padding: theme.spacing(1),
  },
  fieldName: {
    display: 'inline-block',
    minWidth: '90px',
    fontSize: '0.9em',
    borderBottom: '1px solid #0003',
    backgroundColor: '#ddd',
    marginRight: theme.spacing(1),
    padding: theme.spacing(0.5),
  },
  fieldValue: {
    display: 'inline-block',
    fontSize: '0.8em',
  },
  header: {
    padding: theme.spacing(0.5),
    backgroundColor: '#ddd',
  },
  title: {
    fontSize: '1em',
  },

  valbox: {
    border: '1px solid #bbb',
  },
}))

const coreRenderedDetails = [
  'Position',
  'Description',
  'Name',
  'Length',
  'Type',
]

function VariantCard({ children, title }) {
  const classes = useStyles()
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

VariantCard.propTypes = {
  children: PropTypes.node.isRequired,
  title: PropTypes.string.isRequired,
}

function VariantCoreDetails(props) {
  const classes = useStyles()
  const { feature } = props
  const { refName, start, end } = feature
  feature.length = end - start
  feature.position = `${refName}:${start + 1}..${end}`
  return (
    <VariantCard {...props} title="Primary data">
      {coreRenderedDetails.map(key => {
        const value = feature[key.toLowerCase()]
        return (
          value && (
            <div className={classes.fieldRow} key={key}>
              <div className={classes.fieldName}>{key}</div>
              <div className={classes.fieldValue}>{String(value)}</div>
            </div>
          )
        )
      })}
    </VariantCard>
  )
}

VariantCoreDetails.propTypes = {
  feature: PropTypes.shape().isRequired,
}

function VariantAttributes(props) {
  const classes = useStyles()
  const { feature } = props

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
              <div className={classes.fieldValue}>{String(value)}</div>
            </div>
          ),
      )}
    </VariantCard>
  )
}

VariantAttributes.propTypes = {
  feature: PropTypes.shape().isRequired,
}

function VariantSamples(props) {
  const classes = useStyles()
  const { feature } = props
  if (!feature.samples) {
    return null
  }
  const ret = Object.keys(feature.samples)
  const infoFields = Object.keys(feature.samples[ret[0]])

  return (
    <VariantCard {...props} title="Samples">
      <div style={{ width: '100%', maxHeight: 600, overflow: 'auto' }}>
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
                        {String(value[f])}
                      </TableCell>
                    ))}
                  </TableRow>
                ),
            )}
          </TableBody>
        </Table>
      </div>
    </VariantCard>
  )
}

VariantSamples.propTypes = {
  feature: PropTypes.shape().isRequired,
}

function VariantFeatureDetails(props) {
  const classes = useStyles()
  const { model } = props
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
}

export default observer(VariantFeatureDetails)
