#!/usr/bin/env node
/* eslint-disable */
const url = require('url')
const express = require('express')
const fetch = require('cross-fetch')

// const entrezGene = 3845

function fetchGeneInfo(entrezGene) {
  return fetch(`http://mygene.info/v3/gene/${entrezGene}`)
    .then(res => res.text())
    .then(text => JSON.parse(text))
}

function fetchDomains(entrezGene) {
  function parseText(text) {
    const lines = text.split(/\s*\n\s*/).filter(line => /\S/.test(line))
    return lines.map(line => {
      const fields = line.split('\t')
      const data = {}
      attributes.forEach(a => {
        data[a] = fields.shift()
      })
      return data
    })
  }

  const attributes = [
    'ensembl_gene_id',
    'uniprotswissprot',
    'entrezgene',
    'refseq_mrna',
    'description',
    'chromosome_name',
    'start_position',
    'end_position',
    'external_gene_name',
    'ensembl_transcript_id',
    'family',
    'family_description',
    'interpro',
    'interpro_short_description',
    'interpro_description',
    'interpro_start',
    'interpro_end',
  ]

  const query = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE Query>
<Query  virtualSchemaName = "default" formatter = "TSV" header = "0" uniqueRows = "0" count = "" datasetConfigVersion = "0.6" >

	<Dataset name = "hsapiens_gene_ensembl" interface = "default" >
    <Filter name = "entrezgene" value = "${entrezGene}"/>
  ${attributes.map(a => `<Attribute name = "${a}" />\n`)}
	</Dataset>
</Query>
`
  const bioMartQueryUrl = url.format({
    protocol: 'http',
    host: 'uswest.ensembl.org',
    // host: 'localhost:2999',
    pathname: '/biomart/martservice',
    query: { query },
  })
  // console.log('query url is', bioMartQueryUrl)
  return fetch(bioMartQueryUrl)
    .then(r => r.text())
    .then(parseText)
}

const app = express()
const port = 2999

app.get('/:entrezGeneId', async (req, res, next) => {
  const { entrezGeneId } = req.params
  const geneFetch = fetchGeneInfo(entrezGeneId)
  const domainFetch = fetchDomains(entrezGeneId)
  Promise.all([geneFetch, domainFetch]).then(
    ([geneInfo, domains]) => {
      res.status(200).send({
        gene: geneInfo,
        domains,
      })
    },
    error => next(error),
  )
})

app.listen(port, () =>
  console.log(
    `Demo data service listening on port ${port}. \n\nTry it out with\n     curl http://localhost:${port}/3845`,
  ),
)
