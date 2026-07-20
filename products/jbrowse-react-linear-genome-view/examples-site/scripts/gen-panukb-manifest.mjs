// Regenerates panukbPhenotypes.json from the official Pan-UKBB phenotype
// manifest. The manifest lists every per-phenotype flat file (id,
// description, category, cohort sizes, populations analyzed). We trim it to
// the fields the example's phenotype picker needs so the demo can browse the
// whole catalog without fetching the ~1.4MB manifest at runtime.
//
// The trimmed output is too large to track in git, so it's hosted at
// s3://jbrowse.org/demos/panukbb/panukbPhenotypes.json (fetched by
// PanUKBGWAS.tsx) instead of living in public/. After running this script,
// upload the result with:
//   aws s3 cp panukbPhenotypes.json \
//     s3://jbrowse.org/demos/panukbb/panukbPhenotypes.json \
//     --content-type application/json
//
// Usage: node scripts/gen-panukb-manifest.mjs
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'

const MANIFEST_URL =
  'https://pan-ukb-us-east-1.s3.amazonaws.com/sumstats_release/phenotype_manifest.tsv.bgz'

const out = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'panukbPhenotypes.json',
)

const splitPops = v => (v === 'NA' ? [] : v.split(',').filter(Boolean))

const res = await fetch(MANIFEST_URL)
if (!res.ok) {
  throw new Error(`failed to fetch manifest: ${res.status} ${res.statusText}`)
}
// bgzip output is valid gzip (concatenated members), so a single gunzip reads it
const text = gunzipSync(Buffer.from(await res.arrayBuffer())).toString('utf8')

const lines = text.split('\n').filter(Boolean)
const header = lines[0].split('\t')
const col = name => header.indexOf(name)
const c = {
  trait_type: col('trait_type'),
  description: col('description'),
  coding_description: col('coding_description'),
  category: col('category'),
  n: col('n_cases_full_cohort_both_sexes'),
  pops: col('pops'),
  popsQc: col('pops_pass_qc'),
  filename: col('filename'),
}

const phenotypes = lines
  .slice(1)
  .map(line => {
    const f = line.split('\t')
    const filename = f[c.filename]
    const description = f[c.description] || f[c.coding_description] || filename
    return {
      id: filename.replace(/\.tsv\.bgz$/, ''),
      traitType: f[c.trait_type],
      description,
      category: f[c.category] === 'NA' ? '' : f[c.category],
      n: Number(f[c.n]) || 0,
      pops: splitPops(f[c.pops]),
      popsQc: splitPops(f[c.popsQc]),
    }
  })
  .filter(p => p.id)
  // largest cohorts first: best-powered phenotypes surface at the top
  .sort((a, b) => b.n - a.n)

writeFileSync(out, JSON.stringify(phenotypes))
console.log(`wrote ${phenotypes.length} phenotypes to ${out}`)
