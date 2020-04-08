import Divider from '@material-ui/core/Divider'
import Paper from '@material-ui/core/Paper'
import { makeStyles } from '@material-ui/core/styles'
import Table from '@material-ui/core/Table'
import TableBody from '@material-ui/core/TableBody'
import TableCell from '@material-ui/core/TableCell'
import TableHead from '@material-ui/core/TableHead'
import TableRow from '@material-ui/core/TableRow'
import Chip from '@material-ui/core/Chip'
import Tooltip from '@material-ui/core/Tooltip'
import Link from '@material-ui/core/Link'
import Icon from '@material-ui/core/Icon'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import PropTypes from 'prop-types'
import React from 'react'
import BaseFeatureDetail, {
  BaseCard,
} from '@gmod/jbrowse-core/BaseFeatureDrawerWidget/BaseFeatureDetail'

const useStyles = makeStyles(() => ({
  table: {
    padding: 0,
  },
  title: {
    fontSize: '1em',
  },
  link: {
    color: 'rgb(0, 0, 238)',
    'text-decoration': 'underline',
  },
}))

/**
 * Render the consequence table for a simple somatic mutation
 * @param {*} props Properties
 */
function Consequence(props) {
  const classes = useStyles()
  const { feature } = props
  if (!feature.consequence) {
    return null
  }

  const consequences = feature.consequence.hits.edges

  return (
    <BaseCard {...props} title="Consequence">
      <div style={{ width: '100%', maxHeight: 600, overflow: 'auto' }}>
        <Table className={classes.table}>
          <TableHead>
            <TableRow>
              <TableCell>Gene</TableCell>
              <TableCell>AA Change</TableCell>
              <TableCell>Consequence</TableCell>
              <TableCell>Coding DNA Change</TableCell>
              <TableCell>Impact</TableCell>
              <TableCell>Gene Strand</TableCell>
              <TableCell>Transcript</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {Object.entries(consequences).map(
              ([key, value]) =>
                value && (
                  <TableRow key={key}>
                    <TableCell component="th" scope="row">
                      <Link
                        className={classes.link}
                        target="_blank"
                        rel="noopener"
                        href={`https://portal.gdc.cancer.gov/genes/${value.node.transcript.gene.gene_id}`}
                      >
                        {value.node.transcript.gene.symbol}
                      </Link>
                    </TableCell>
                    <TableCell component="th" scope="row">
                      {value.node.transcript.aa_change}
                    </TableCell>
                    <TableCell component="th" scope="row">
                      {value.node.transcript.consequence_type}
                    </TableCell>
                    <TableCell component="th" scope="row">
                      {value.node.transcript.annotation.hgvsc}
                    </TableCell>
                    <TableCell component="th" scope="row">
                      {value.node.transcript.annotation.vep_impact && (
                        <Tooltip
                          title={`VEP ${value.node.transcript.annotation.vep_impact}`}
                          aria-label="help"
                          placement="left"
                        >
                          <Chip
                            label={value.node.transcript.annotation.vep_impact}
                          />
                        </Tooltip>
                      )}
                      {value.node.transcript.annotation.sift_impact && (
                        <Tooltip
                          title={`SIFT ${value.node.transcript.annotation.sift_impact} (${value.node.transcript.annotation.sift_score})`}
                          aria-label="help"
                          placement="left"
                        >
                          <Chip
                            label={value.node.transcript.annotation.sift_impact}
                          />
                        </Tooltip>
                      )}
                      {value.node.transcript.annotation.polyphen_impact && (
                        <Tooltip
                          title={`PolyPhen ${value.node.transcript.annotation.polyphen_impact} (${value.node.transcript.annotation.polyphen_score})`}
                          aria-label="help"
                          placement="left"
                        >
                          <Chip
                            label={
                              value.node.transcript.annotation.polyphen_impact
                            }
                          />
                        </Tooltip>
                      )}
                    </TableCell>
                    <TableCell component="th" scope="row">
                      {value.node.transcript.gene.gene_strand === 1 ? (
                        <Icon>add</Icon>
                      ) : (
                        <Icon>remove</Icon>
                      )}
                    </TableCell>
                    <TableCell component="th" scope="row">
                      <Link
                        className={classes.link}
                        target="_blank"
                        rel="noopener"
                        href={`http://may2015.archive.ensembl.org/Homo_sapiens/Gene/Summary?db=core;g=${value.node.transcript.transcript_id}`}
                      >
                        {value.node.transcript.transcript_id}
                      </Link>
                      {value.node.transcript.is_canonical && (
                        <Tooltip
                          title="Canonical transcript"
                          aria-label="help"
                          placement="right"
                        >
                          <Chip label="C" />
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                ),
            )}
          </TableBody>
        </Table>
      </div>
    </BaseCard>
  )
}

Consequence.propTypes = {
  feature: PropTypes.shape().isRequired,
}

/**
 * A single table row for an external link
 */
const ExternalLink = observer(props => {
  const classes = useStyles()
  const { id, prettyId, name, link } = props.props
  return (
    <>
      <TableRow key={`${id}-${name}`}>
        <TableCell component="th" scope="row">
          {name}
        </TableCell>
        <TableCell component="th" scope="row">
          <Link
            className={classes.link}
            target="_blank"
            rel="noopener"
            href={`${link}${id}`}
          >
            {prettyId}
          </Link>
        </TableCell>
      </TableRow>
    </>
  )
})

/**
 * Create a section for external gene links
 * @param {*} props
 */
function GeneExternalLinks(props) {
  const classes = useStyles()
  const { feature } = props

  const externalLinkArray = [
    {
      id: feature.geneId,
      name: 'GDC',
      prettyId: feature.geneId,
      link: 'https://portal.gdc.cancer.gov/genes/',
    },
    {
      id: feature.geneId,
      name: 'ENSEMBL',
      prettyId: feature.geneId,
      link: 'http://www.ensembl.org/id/',
    },
    {
      id: feature.canonicalTranscriptId,
      name: 'Canonical Transcript ID',
      prettyId: feature.canonicalTranscriptId,
      link: 'http://www.ensembl.org/id/',
    },
    {
      id: feature.externalDbIds.hgnc[0],
      name: 'HGNC',
      prettyId: feature.externalDbIds.hgnc[0],
      link: 'https://www.genenames.org/data/gene-symbol-report/#!/hgnc_id/',
    },
    {
      id: feature.externalDbIds.uniprotkbSwissprot[0],
      name: 'UniProtKB Swiss-Prot',
      prettyId: feature.externalDbIds.uniprotkbSwissprot[0],
      link: 'http://www.uniprot.org/uniprot/',
    },
    {
      id: feature.externalDbIds.entrezGene[0],
      name: 'NCBI',
      prettyId: feature.externalDbIds.entrezGene[0],
      link: 'http://www.ncbi.nlm.nih.gov/gene/',
    },
    {
      id: feature.externalDbIds.omimGene[0],
      name: 'OMIM',
      prettyId: feature.externalDbIds.omimGene[0],
      link: 'https://www.omim.org/entry/',
    },
  ]

  return (
    <BaseCard {...props} title="External Links">
      <div style={{ width: '100%', maxHeight: 600, overflow: 'auto' }}>
        <Table className={classes.table}>
          <TableBody>
            {externalLinkArray.map((externalLink, key) => (
              <ExternalLink props={externalLink} key={key}></ExternalLink>
            ))}
          </TableBody>
        </Table>
      </div>
    </BaseCard>
  )
}

GeneExternalLinks.propTypes = {
  feature: PropTypes.shape().isRequired,
}

/**
 * Removes prefix from cosmic ID
 * @param {*} cosmicId Cosmic ID for a mutation
 */
function removeCosmicPrefix(cosmicId) {
  let cosmicIdNoPrefix = cosmicId.replace('COSM', '')
  cosmicIdNoPrefix = cosmicIdNoPrefix.replace('COSN', '')
  return cosmicIdNoPrefix
}

/**
 * Creates a row with cosmic links for a mutation
 */
const CosmicLinks = observer(props => {
  const classes = useStyles()
  return (
    <>
      <TableRow key="0">
        <TableCell component="th" scope="row">
          Cosmic
        </TableCell>
        <TableCell component="th" scope="row">
          {props.props &&
            props.props.map((value, key) => (
              <Link
                className={classes.link}
                target="_blank"
                rel="noopener"
                href={`https://cancer.sanger.ac.uk/cosmic/mutation/overview?id=${removeCosmicPrefix(
                  value,
                )}`}
                key={value}
              >
                {value}
              </Link>
            ))}
        </TableCell>
      </TableRow>
    </>
  )
})

/**
 * Create a section for external mutation links
 * @param {*} props
 */
function SSMExternalLinks(props) {
  const classes = useStyles()
  const { feature } = props

  const externalLinkArray = [
    {
      id: feature.ssmId,
      name: 'GDC',
      prettyId: feature.ssmId,
      link: 'https://portal.gdc.cancer.gov/ssms/',
    },
  ]

  return (
    <BaseCard {...props} title="External Links">
      <div style={{ width: '100%', maxHeight: 600, overflow: 'auto' }}>
        <Table className={classes.table}>
          <TableBody>
            {externalLinkArray.map((externalLink, key) => (
              <ExternalLink props={externalLink} key={key}></ExternalLink>
            ))}
            {feature.cosmicId && (
              <CosmicLinks props={feature.cosmicId}></CosmicLinks>
            )}
          </TableBody>
        </Table>
      </div>
    </BaseCard>
  )
}

SSMExternalLinks.propTypes = {
  feature: PropTypes.shape().isRequired,
}

function VariantFeatureDetails(props) {
  const classes = useStyles()
  const { model } = props
  const feat = JSON.parse(JSON.stringify(model.featureData))
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const {
    consequence,
    geneId,
    ssmId,
    cosmicId,
    canonicalTranscriptId,
    externalDbIds,
    ...rest
  } = feat
  return (
    <Paper className={classes.root} data-testid="variant-side-drawer">
      <BaseFeatureDetail feature={rest} {...props} />
      <Divider />
      {feat.geneId && <GeneExternalLinks feature={feat} {...props} />}
      {feat.ssmId && <SSMExternalLinks feature={feat} {...props} />}
      <Divider />
      {feat.ssmId && <Consequence feature={feat} {...props} />}
    </Paper>
  )
}

VariantFeatureDetails.propTypes = {
  model: MobxPropTypes.observableObject.isRequired,
}

export default observer(VariantFeatureDetails)
