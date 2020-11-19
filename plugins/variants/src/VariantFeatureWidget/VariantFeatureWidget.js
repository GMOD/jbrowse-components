import Divider from '@material-ui/core/Divider'
import Paper from '@material-ui/core/Paper'
import { makeStyles } from '@material-ui/core/styles'
import Table from '@material-ui/core/Table'
import TableBody from '@material-ui/core/TableBody'
import TableCell from '@material-ui/core/TableCell'
import TableHead from '@material-ui/core/TableHead'
import TableRow from '@material-ui/core/TableRow'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import PropTypes from 'prop-types'
import React from 'react'
import {
  BaseFeatureDetails,
  BaseCard,
} from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail'

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

function VariantSamples(props) {
  const classes = useStyles()
  const { feature } = props
  if (!feature.samples) {
    return null
  }
  const ret = Object.keys(feature.samples)
  if (!ret.length) {
    return null
  }
  const infoFields = Object.keys(feature.samples[ret[0]])

  return (
    <BaseCard {...props} title="Samples">
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
                        {value === null ? '.' : String(value[f])}
                      </TableCell>
                    ))}
                  </TableRow>
                ),
            )}
          </TableBody>
        </Table>
      </div>
    </BaseCard>
  )
}

VariantSamples.propTypes = {
  feature: PropTypes.shape().isRequired,
}

function VariantFeatureDetails(props) {
  const classes = useStyles()
  const { model } = props
  const feat = JSON.parse(JSON.stringify(model.featureData))
  const { samples, ...rest } = feat
  const descriptions = {
    CHROM: 'chromosome: An identifier from the reference genome',
    POS:
      'position: The reference position, with the 1st base having position 1',
    ID:
      'identifier: Semi-colon separated list of unique identifiers where available',
    REF:
      'reference base(s): Each base must be one of A,C,G,T,N (case insensitive).',
    ALT:
      ' alternate base(s): Comma-separated list of alternate non-reference alleles',
    QUAL: 'quality: Phred-scaled quality score for the assertion made in ALT',
    FILTER:
      'filter status: PASS if this position has passed all filters, otherwise a semicolon-separated list of codes for filters that fail',
  }

  return (
    <Paper className={classes.root} data-testid="variant-side-drawer">
      <BaseFeatureDetails
        feature={rest}
        descriptions={descriptions}
        {...props}
      />
      <Divider />
      <VariantSamples feature={feat} {...props} />
    </Paper>
  )
}

VariantFeatureDetails.propTypes = {
  model: MobxPropTypes.observableObject.isRequired,
}

export default observer(VariantFeatureDetails)
