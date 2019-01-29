import React from 'react'
import ReactDOM from 'react-dom'
import './index.css'
import url from 'url'
import App from './App'

const entrezGene = 3845

const geneFetch = fetch(
  /* 'http://mygene.info/v3/gene/3845' */ '/test_data/kras.gene.json',
)
  .then(res => res.text())
  .then(text => JSON.parse(text))

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

const domainFetch = fetch(
  url.format({
    // host: 'uswest.ensembl.org',
    host: 'localhost:2999',
    pathname: '/biomart/martservice',
    query: { query },
  }),
)
  .then(res => res.text())
  .then(parseText)

Promise.all([geneFetch, domainFetch]).then(([geneInfo, domains]) => {
  ReactDOM.render(
    <App gene={geneInfo} domains={domains} />,
    document.getElementById('root'),
  )
})
