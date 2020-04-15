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
import React, { useState, useEffect } from 'react'
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
  const { id, name, link } = props.props
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
            {id}
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
      link: 'https://portal.gdc.cancer.gov/genes/',
    },
    {
      id: feature.geneId,
      name: 'ENSEMBL',
      link: 'http://www.ensembl.org/id/',
    },
    {
      id: feature.canonicalTranscriptId,
      name: 'Canonical Transcript ID',
      link: 'http://www.ensembl.org/id/',
    },
    {
      id: feature.externalDbIds.hgnc[0],
      name: 'HGNC',
      link: 'https://www.genenames.org/data/gene-symbol-report/#!/hgnc_id/',
    },
    {
      id: feature.externalDbIds.uniprotkbSwissprot[0],
      name: 'UniProtKB Swiss-Prot',
      link: 'http://www.uniprot.org/uniprot/',
    },
    {
      id: feature.externalDbIds.entrezGene[0],
      name: 'NCBI',
      link: 'http://www.ncbi.nlm.nih.gov/gene/',
    },
    {
      id: feature.externalDbIds.omimGene[0],
      name: 'OMIM',
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
            props.props.map(value => (
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

/**
 * A table row for a project related to the mutation
 * @param {*} props
 */
function SSMProject(props) {
  const classes = useStyles()
  const { projectId, docCount, allProjects, totalProjects } = props
  const projectInfo = allProjects.find(x => x.node.project_id === projectId)
  const totalProject = totalProjects.find(x => x.projectId === projectId)

  return (
    <>
      <TableRow key={projectId}>
        <TableCell component="th" scope="row">
          <Link
            className={classes.link}
            target="_blank"
            rel="noopener"
            href={`https://portal.gdc.cancer.gov/projects/${projectId}`}
          >
            {projectId}
          </Link>
        </TableCell>
        <TableCell component="th" scope="row">
          {projectInfo.node.disease_type.join(', ')}
        </TableCell>
        <TableCell component="th" scope="row">
          {projectInfo.node.primary_site.join(', ')}
        </TableCell>
        <TableCell component="th" scope="row">
          {docCount} / {totalProject.docCount}
        </TableCell>
      </TableRow>
    </>
  )
}

SSMProject.propTypes = {
  projectId: PropTypes.string.isRequired,
  docCount: PropTypes.number.isRequired,
  allProjects: PropTypes.array.isRequired,
  totalProjects: PropTypes.array.isRequired,
}

/**
 * Create a table of projects based on the selected mutation feature
 * @param {*} props
 */
function SSMProjects(props) {
  const classes = useStyles()
  const { featureId } = props

  const [filteredProjects, setFilteredProjects] = useState([])
  const [allProjects, setAllProjects] = useState([])
  const [totalProjects, setTotalProjects] = useState([])

  useEffect(() => {
    getSSMProjectsAsync(featureId).then(data => {
      setAllProjects(data.data.projects.hits.edges)
      setTotalProjects(
        data.data.viewer.explore.cases.total.project__project_id.buckets,
      )
      setFilteredProjects(
        data.data.viewer.explore.cases.filtered.project__project_id.buckets,
      )
    })
  }, [featureId])

  return (
    <BaseCard {...props} title="Projects">
      <div style={{ width: '100%', maxHeight: 600, overflow: 'auto' }}>
        <Table className={classes.table}>
          <TableHead>
            <TableRow>
              <TableCell>Project</TableCell>
              <TableCell>Disease Type</TableCell>
              <TableCell>Site</TableCell>
              <TableCell># Mutation Affected Cases</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredProjects &&
              allProjects &&
              totalProjects &&
              filteredProjects.map((project, key) => (
                <SSMProject
                  allProjects={allProjects}
                  totalProjects={totalProjects}
                  key={`${key}-${project.projectId}`}
                  {...project}
                ></SSMProject>
              ))}
          </TableBody>
        </Table>
      </div>
    </BaseCard>
  )
}

/**
 * Query the GDC API for project information related to the given mutation
 * @param {String} featureId Mutation ID
 */
async function getSSMProjectsAsync(featureId) {
  const query = {
    query: `query projectsTable($ssmTested: FiltersArgument, $caseAggsFilter: FiltersArgument, $projectCount: Int) { viewer { explore { cases { filtered: aggregations(filters: $caseAggsFilter) { project__project_id { buckets { docCount: doc_count projectId: key } } } total: aggregations(filters: $ssmTested) { project__project_id { buckets { docCount: doc_count projectId: key } } } } } } projects { hits(first: $projectCount) { edges { node { primary_site disease_type project_id id } } } } }`,
    variables: {
      ssmTested: {
        op: 'and',
        content: [
          {
            op: 'in',
            content: {
              field: 'cases.available_variation_data',
              value: ['ssm'],
            },
          },
        ],
      },
      caseAggsFilter: {
        op: 'and',
        content: [
          { op: 'in', content: { field: 'ssms.ssm_id', value: [featureId] } },
          {
            op: 'in',
            content: {
              field: 'cases.available_variation_data',
              value: ['ssm'],
            },
          },
        ],
      },
      projectCount: 100,
    },
  }

  const response = await fetch('https://api.gdc.cancer.gov/v0/graphql', {
    method: 'POST',
    body: JSON.stringify(query),
  })
  const result = await response.json()
  return result
}

SSMProjects.propTypes = {
  featureId: PropTypes.string.isRequired,
}

/**
 * A table row for a project related to the gene
 * @param {*} props
 */
function GeneProject(props) {
  const classes = useStyles()
  const { projectId, docCount, allProjects, cases } = props

  const projectInfo = allProjects.find(x => x.node.project_id === projectId)
  const totalProject = cases.total.project__project_id.buckets.find(
    x => x.projectId === projectId,
  )
  const cnvGain = cases.gain.project__project_id.buckets.find(
    x => x.projectId === projectId,
  )
  const cnvLoss = cases.loss.project__project_id.buckets.find(
    x => x.projectId === projectId,
  )
  const cnvTotal = cases.cnvTotal.project__project_id.buckets.find(
    x => x.projectId === projectId,
  )

  return (
    <>
      <TableRow key={projectId}>
        <TableCell component="th" scope="row">
          <Link
            className={classes.link}
            target="_blank"
            rel="noopener"
            href={`https://portal.gdc.cancer.gov/projects/${projectId}`}
          >
            {projectId}
          </Link>
        </TableCell>
        <TableCell component="th" scope="row">
          {projectInfo.node.disease_type.join(', ')}
        </TableCell>
        <TableCell component="th" scope="row">
          {projectInfo.node.primary_site.join(', ')}
        </TableCell>
        <TableCell component="th" scope="row">
          {docCount} / {totalProject.docCount}
        </TableCell>
        <TableCell component="th" scope="row">
          {cnvGain ? cnvGain.docCount : '0'} / {cnvTotal.docCount}
        </TableCell>
        <TableCell component="th" scope="row">
          {cnvLoss ? cnvLoss.docCount : '0'} / {cnvTotal.docCount}
        </TableCell>
      </TableRow>
    </>
  )
}

GeneProject.propTypes = {
  projectId: PropTypes.string.isRequired,
  docCount: PropTypes.number.isRequired,
  allProjects: PropTypes.array.isRequired,
  cases: PropTypes.object.isRequired,
}

/**
 * Create a table of projects based on the selected gene feature
 * @param {*} props
 */
function GeneProjects(props) {
  const classes = useStyles()
  const { featureId } = props

  const [allProjects, setAllProjects] = useState([])
  const [filteredProjects, setFilteredProjects] = useState([])
  const [cases, setCases] = useState([])

  useEffect(() => {
    getGeneProjectsAsync(featureId).then(data => {
      setAllProjects(data.data.projects.hits.edges)
      setCases(data.data.viewer.explore.cases)
      setFilteredProjects(
        data.data.viewer.explore.cases.filtered.project__project_id.buckets,
      )
    })
  }, [featureId])

  return (
    <BaseCard {...props} title="Projects">
      <div style={{ width: '100%', maxHeight: 600, overflow: 'auto' }}>
        <Table className={classes.table}>
          <TableHead>
            <TableRow>
              <TableCell>Project</TableCell>
              <TableCell>Disease Type</TableCell>
              <TableCell>Site</TableCell>
              <TableCell># Mutation Affected Cases</TableCell>
              <TableCell># CNV Gains</TableCell>
              <TableCell># CNV Losses</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {cases &&
              allProjects &&
              filteredProjects &&
              filteredProjects.map((project, key) => (
                <GeneProject
                  cases={cases}
                  allProjects={allProjects}
                  key={`${key}-${project.projectId}`}
                  {...project}
                ></GeneProject>
              ))}
          </TableBody>
        </Table>
      </div>
    </BaseCard>
  )
}

GeneProjects.propTypes = {
  featureId: PropTypes.string.isRequired,
}

/**
 * Query the GDC API for project information related to the given gene
 * @param {String} featureId Gene ID
 */
async function getGeneProjectsAsync(featureId) {
  const query = {
    query: `query ProjectTable( $caseAggsFilters: FiltersArgument $ssmTested: FiltersArgument $cnvGain: FiltersArgument $cnvLoss: FiltersArgument $cnvTested: FiltersArgument $projectCount: Int ) { viewer { explore { cases { gain: aggregations(filters: $cnvGain) { project__project_id { buckets { docCount: doc_count projectId: key } } } loss: aggregations(filters: $cnvLoss) { project__project_id { buckets { docCount: doc_count projectId: key } } } cnvTotal: aggregations(filters: $cnvTested) { project__project_id { buckets { docCount: doc_count projectId: key } } } filtered: aggregations(filters: $caseAggsFilters) { project__project_id { buckets { docCount: doc_count projectId: key } } } total: aggregations(filters: $ssmTested) { project__project_id { buckets { docCount: doc_count projectId: key } } } } } } projects { hits(first: $projectCount) { edges { node { primary_site disease_type project_id id } } } } }`,
    variables: {
      caseAggsFilters: {
        op: 'and',
        content: [
          {
            op: 'in',
            content: {
              field: 'cases.available_variation_data',
              value: ['ssm'],
            },
          },
          {
            op: 'NOT',
            content: {
              field: 'cases.gene.ssm.observation.observation_id',
              value: 'MISSING',
            },
          },
          { op: 'in', content: { field: 'genes.gene_id', value: [featureId] } },
        ],
      },
      ssmTested: {
        op: 'and',
        content: [
          {
            op: 'in',
            content: {
              field: 'cases.available_variation_data',
              value: ['ssm'],
            },
          },
        ],
      },
      cnvGain: {
        op: 'and',
        content: [
          {
            op: 'in',
            content: {
              field: 'cases.available_variation_data',
              value: ['cnv'],
            },
          },
          { op: 'in', content: { field: 'cnvs.cnv_change', value: ['Gain'] } },
          { op: 'in', content: { field: 'genes.gene_id', value: [featureId] } },
        ],
      },
      cnvLoss: {
        op: 'and',
        content: [
          {
            op: 'in',
            content: {
              field: 'cases.available_variation_data',
              value: ['cnv'],
            },
          },
          { op: 'in', content: { field: 'cnvs.cnv_change', value: ['Loss'] } },
          { op: 'in', content: { field: 'genes.gene_id', value: [featureId] } },
        ],
      },
      cnvTested: {
        op: 'and',
        content: [
          {
            op: 'in',
            content: {
              field: 'cases.available_variation_data',
              value: ['cnv'],
            },
          },
        ],
      },
      projectCount: 100,
    },
  }

  const response = await fetch('https://api.gdc.cancer.gov/v0/graphql', {
    method: 'POST',
    body: JSON.stringify(query),
  })
  const result = await response.json()
  return result
}

/**
 * Extended feature detail drawer for GDC features
 * @param {*} props
 */
function GDCFeatureDetails(props) {
  const classes = useStyles()
  const { model } = props
  const feat = JSON.parse(JSON.stringify(model.featureData))
  /* eslint-disable @typescript-eslint/no-unused-vars*/
  const {
    consequence,
    geneId,
    ssmId,
    cosmicId,
    canonicalTranscriptId,
    externalDbIds,
    ...rest
  } = feat
  /* eslint-disable @typescript-eslint/no-unused-vars*/
  return (
    <Paper className={classes.root} data-testid="variant-side-drawer">
      <BaseFeatureDetail feature={rest} {...props} />
      <Divider />
      {feat.geneId && <GeneExternalLinks feature={feat} {...props} />}
      {feat.ssmId && <SSMExternalLinks feature={feat} {...props} />}
      <Divider />
      {feat.ssmId && <Consequence feature={feat} {...props} />}
      <Divider />
      {feat.geneId && <GeneProjects featureId={feat.geneId} />}
      {feat.ssmId && <SSMProjects featureId={feat.ssmId} />}
    </Paper>
  )
}

GDCFeatureDetails.propTypes = {
  model: MobxPropTypes.observableObject.isRequired,
}

export default observer(GDCFeatureDetails)
