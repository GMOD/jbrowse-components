import AddIcon from '@material-ui/icons/Add'
import RemoveIcon from '@material-ui/icons/Remove'
import { getGeneProjectsAsync, getMutationProjectsAsync } from './Utility'

export default jbrowse => {
  const {
    Divider,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Chip,
    Tooltip,
    Link,
  } = jbrowse.jbrequire('@material-ui/core')

  const { makeStyles } = jbrowse.jbrequire('@material-ui/core/styles')

  const { observer, PropTypes: MobxPropTypes } = jbrowse.jbrequire('mobx-react')
  const PropTypes = jbrowse.jbrequire('prop-types')
  const React = jbrowse.jbrequire('react')
  const { useState, useEffect } = React

  const { BaseFeatureDetails, BaseCard } = jbrowse.jbrequire(
    '@gmod/jbrowse-core/BaseFeatureDrawerWidget/BaseFeatureDetail',
  )

  const useStyles = makeStyles(() => ({
    table: {
      padding: 0,
    },
    link: {
      color: 'rgb(0, 0, 238)',
    },
  }))

  /**
   * Render the consequence table for a simple somatic mutation
   * @param {*} props
   */
  function Consequence(props) {
    const classes = useStyles()
    const { feature } = props
    if (!feature.consequence) {
      return null
    }

    const consequences = feature.consequence.hits.edges

    return (
      <BaseCard title="Consequence">
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
                      <TableCell>
                        <Link
                          className={classes.link}
                          target="_blank"
                          rel="noopener"
                          href={`https://portal.gdc.cancer.gov/genes/${value.node.transcript.gene.gene_id}`}
                          underline="always"
                        >
                          {value.node.transcript.gene.symbol}
                        </Link>
                      </TableCell>
                      <TableCell>{value.node.transcript.aa_change}</TableCell>
                      <TableCell>
                        {value.node.transcript.consequence_type}
                      </TableCell>
                      <TableCell>
                        {value.node.transcript.annotation.hgvsc}
                      </TableCell>
                      <TableCell>
                        {value.node.transcript.annotation.vep_impact && (
                          <Tooltip
                            title={`VEP ${value.node.transcript.annotation.vep_impact}`}
                            aria-label="help"
                            placement="left"
                          >
                            <Chip
                              label={
                                value.node.transcript.annotation.vep_impact
                              }
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
                              label={
                                value.node.transcript.annotation.sift_impact
                              }
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
                      <TableCell>
                        {value.node.transcript.gene.gene_strand === 1 ? (
                          <AddIcon />
                        ) : (
                          <RemoveIcon />
                        )}
                      </TableCell>
                      <TableCell>
                        <Link
                          className={classes.link}
                          target="_blank"
                          rel="noopener"
                          href={`http://may2015.archive.ensembl.org/Homo_sapiens/Gene/Summary?db=core;g=${value.node.transcript.transcript_id}`}
                          underline="always"
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
   * Render a single table row for an external link
   */
  const ExternalLink = observer(props => {
    const classes = useStyles()
    const { id, name, link } = props
    return (
      <>
        <TableRow key={`${id}-${name}`}>
          <TableCell>{name}</TableCell>
          <TableCell>
            <Link
              className={classes.link}
              target="_blank"
              rel="noopener"
              href={`${link}${id}`}
              underline="always"
            >
              {id}
            </Link>
          </TableCell>
        </TableRow>
      </>
    )
  })

  /**
   * Render a section for external gene links
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
      <BaseCard title="External Links">
        <div style={{ width: '100%', maxHeight: 600, overflow: 'auto' }}>
          <Table className={classes.table}>
            <TableBody>
              {externalLinkArray.map((externalLink, key) => (
                <ExternalLink {...externalLink} key={key} />
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
   * Render a row with cosmic links for a mutation
   */
  const CosmicLinks = observer(props => {
    const classes = useStyles()
    const { cosmicId } = props
    return (
      <>
        <TableRow key="0">
          <TableCell>Cosmic</TableCell>
          <TableCell>
            {cosmicId &&
              cosmicId.map(value => (
                <Link
                  className={classes.link}
                  target="_blank"
                  rel="noopener"
                  href={`https://cancer.sanger.ac.uk/cosmic/mutation/overview?id=${removeCosmicPrefix(
                    value,
                  )}`}
                  key={value}
                  underline="always"
                >
                  {value}
                </Link>
              ))}
          </TableCell>
        </TableRow>
      </>
    )
  })

  CosmicLinks.propTypes = {
    cosmicId: PropTypes.array.isRequired,
  }

  /**
   * Render a section for external mutation links
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
      <BaseCard title="External Links">
        <div style={{ width: '100%', maxHeight: 600, overflow: 'auto' }}>
          <Table className={classes.table}>
            <TableBody>
              {externalLinkArray.map((externalLink, key) => (
                <ExternalLink {...externalLink} key={key} />
              ))}
              {feature.cosmicId && <CosmicLinks cosmicId={feature.cosmicId} />}
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
   * Render a table row for a project related to the mutation
   * @param {*} props
   */
  function SSMProject(props) {
    const classes = useStyles()
    const {
      projectId,
      docCount,
      projectsInformation,
      gdcProjectsCounts,
    } = props
    const projectInfo = projectsInformation.find(
      x => x.node.project_id === projectId,
    )
    const gdcProjectCount = gdcProjectsCounts.find(
      x => x.projectId === projectId,
    )

    return (
      <>
        <TableRow key={projectId}>
          <TableCell>
            <Link
              className={classes.link}
              target="_blank"
              rel="noopener"
              href={`https://portal.gdc.cancer.gov/projects/${projectId}`}
              underline="always"
            >
              {projectId}
            </Link>
          </TableCell>
          <TableCell>{projectInfo.node.disease_type.join(', ')}</TableCell>
          <TableCell>{projectInfo.node.primary_site.join(', ')}</TableCell>
          <TableCell>
            {docCount} / {gdcProjectCount.docCount}
          </TableCell>
        </TableRow>
      </>
    )
  }

  SSMProject.propTypes = {
    projectId: PropTypes.string.isRequired,
    docCount: PropTypes.number.isRequired,
    projectsInformation: PropTypes.array.isRequired,
    gdcProjectsCounts: PropTypes.array.isRequired,
  }

  /**
   * Render a table of projects based on the selected mutation feature
   * @param {*} props
   */
  function SSMProjects(props) {
    const classes = useStyles()
    const { featureId } = props

    const [mutationProjectsCounts, setMutationProjectsCounts] = useState([]) // Case counts for projects associated with the given mutation
    const [projectsInformation, setProjectsInformation] = useState([]) // General information regarding all projects
    const [gdcProjectsCounts, setGdcProjectsCounts] = useState([]) // Case counts for projects across the GDC

    useEffect(() => {
      getMutationProjectsAsync(featureId).then(data => {
        setProjectsInformation(data.data.projects.hits.edges)
        setGdcProjectsCounts(
          data.data.viewer.explore.cases.total.project__project_id.buckets,
        )
        setMutationProjectsCounts(
          data.data.viewer.explore.cases.filtered.project__project_id.buckets,
        )
      })
    }, [featureId])

    return (
      <BaseCard title="Projects">
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
              {mutationProjectsCounts &&
                projectsInformation &&
                gdcProjectsCounts &&
                mutationProjectsCounts.map((project, key) => (
                  <SSMProject
                    projectsInformation={projectsInformation}
                    gdcProjectsCounts={gdcProjectsCounts}
                    key={`${key}-${project.projectId}`}
                    {...project}
                  />
                ))}
            </TableBody>
          </Table>
        </div>
      </BaseCard>
    )
  }

  SSMProjects.propTypes = {
    featureId: PropTypes.string.isRequired,
  }

  /**
   * Render a table row for a project related to the gene
   * @param {*} props
   */
  function GeneProject(props) {
    const classes = useStyles()
    const { projectId, docCount, projectsInformation, cases } = props

    const projectInfo = projectsInformation.find(
      x => x.node.project_id === projectId,
    )
    const totalProjectCaseCount = cases.total.project__project_id.buckets.find(
      x => x.projectId === projectId,
    )
    const cnvGainCaseCount = cases.gain.project__project_id.buckets.find(
      x => x.projectId === projectId,
    )
    const cnvLossCaseCount = cases.loss.project__project_id.buckets.find(
      x => x.projectId === projectId,
    )
    const cnvTotalCaseCount = cases.cnvTotal.project__project_id.buckets.find(
      x => x.projectId === projectId,
    )

    return (
      <>
        <TableRow key={projectId}>
          <TableCell>
            <Link
              className={classes.link}
              target="_blank"
              rel="noopener"
              href={`https://portal.gdc.cancer.gov/projects/${projectId}`}
              underline="always"
            >
              {projectId}
            </Link>
          </TableCell>
          <TableCell>{projectInfo.node.disease_type.join(', ')}</TableCell>
          <TableCell>{projectInfo.node.primary_site.join(', ')}</TableCell>
          <TableCell>
            {docCount} / {totalProjectCaseCount.docCount}
          </TableCell>
          <TableCell>
            {cnvGainCaseCount ? cnvGainCaseCount.docCount : '0'} /{' '}
            {cnvTotalCaseCount.docCount}
          </TableCell>
          <TableCell>
            {cnvLossCaseCount ? cnvLossCaseCount.docCount : '0'} /{' '}
            {cnvTotalCaseCount.docCount}
          </TableCell>
        </TableRow>
      </>
    )
  }

  GeneProject.propTypes = {
    projectId: PropTypes.string.isRequired,
    docCount: PropTypes.number.isRequired,
    projectsInformation: PropTypes.array.isRequired,
    cases: PropTypes.object.isRequired,
  }

  /**
   * Render a table of projects based on the selected gene feature
   * @param {*} props
   */
  function GeneProjects(props) {
    const classes = useStyles()
    const { featureId } = props

    const [projectsInformation, setProjectsInformation] = useState([]) // General information regarding all projects
    const [geneProjectsCounts, setGeneProjectsCounts] = useState([]) // Case counts for projects associated with the given gene
    const [cases, setCases] = useState([]) // Case counts for various projects and filters

    useEffect(() => {
      getGeneProjectsAsync(featureId).then(data => {
        setProjectsInformation(data.data.projects.hits.edges)
        setCases(data.data.viewer.explore.cases)
        setGeneProjectsCounts(
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
                projectsInformation &&
                geneProjectsCounts &&
                geneProjectsCounts.map((project, key) => (
                  <GeneProject
                    cases={cases}
                    projectsInformation={projectsInformation}
                    key={`${key}-${project.projectId}`}
                    {...project}
                  />
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
   * Extended feature detail drawer for GDC features
   * @param {*} props
   */
  function GDCFeatureDetails(props) {
    const classes = useStyles()
    const { model } = props
    const feat = JSON.parse(JSON.stringify(model.featureData))
    const {
      consequence,
      geneId,
      ssmId,
      cosmicId,
      canonicalTranscriptId,
      externalDbIds,
      percentage,
      numOfCasesInCohort,
      ...rest
    } = feat
    return (
      <Paper className={classes.root} data-testid="variant-side-drawer">
        <BaseFeatureDetails feature={rest} {...props} />
        <Divider />
        {feat.geneId && <GeneExternalLinks feature={feat} />}
        {feat.ssmId && <SSMExternalLinks feature={feat} />}
        <Divider />
        {feat.ssmId && <Consequence feature={feat} />}
        <Divider />
        {feat.geneId && <GeneProjects featureId={feat.geneId} />}
        {feat.ssmId && <SSMProjects featureId={feat.ssmId} />}
      </Paper>
    )
  }

  GDCFeatureDetails.propTypes = {
    model: MobxPropTypes.observableObject.isRequired,
  }

  return observer(GDCFeatureDetails)
}
