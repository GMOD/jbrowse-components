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

  const response = await fetch(
    'https://api.gdc.cancer.gov/v0/graphql/geneProjects',
    {
      method: 'POST',
      body: JSON.stringify(query),
    },
  )
  const result = await response.json()
  return result
}

module.exports.getGeneProjectsAsync = getGeneProjectsAsync

/**
 * Query the GDC API for project information related to the given mutation
 * @param {String} featureId Mutation ID
 */
async function getMutationProjectsAsync(featureId) {
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

  const response = await fetch(
    'https://api.gdc.cancer.gov/v0/graphql/mutationProjects',
    {
      method: 'POST',
      body: JSON.stringify(query),
    },
  )
  const result = await response.json()
  return result
}

module.exports.getMutationProjectsAsync = getMutationProjectsAsync
