import { useState } from 'react'

// The heavy lifting is server-side: scripts/gen-nextstrain-demos.mjs reconstructs
// a gap-free, reference-coordinate MSA (reference + each tip's mutations) and a
// matching pruned newick tree, hosted on jbrowse.org/demos. Here we just point
// the hosted react-msaview app (JBrowseMSA) at those two files via its `?data=`
// snapshot param — the tree + alignment render with no local MSA dependency.
const PATHOGENS = [
  { slug: 'covid', label: 'SARS-CoV-2' },
  { slug: 'zika', label: 'Zika' },
  { slug: 'ebola', label: 'Ebola' },
  { slug: 'measles', label: 'Measles' },
  { slug: 'rsv-a', label: 'RSV-A' },
]

function msaViewerUrl(slug: string) {
  const base = `https://jbrowse.org/demos/nextstrain/${slug}`
  const data = {
    msaview: {
      type: 'MsaView',
      treeFilehandle: { uri: `${base}/${slug}.nwk` },
      msaFilehandle: { uri: `${base}/${slug}_msa.fasta` },
      colorSchemeName: 'nucleotide',
      treeAreaWidth: 300,
    },
  }
  return `https://gmod.org/JBrowseMSA/demo/?data=${encodeURIComponent(JSON.stringify(data))}`
}

export default function NextstrainMsa() {
  const [slug, setSlug] = useState('zika')
  return (
    <div>
      <label>
        Pathogen{' '}
        <select value={slug} onChange={event => setSlug(event.target.value)}>
          {PATHOGENS.map(p => (
            <option key={p.slug} value={p.slug}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
      <iframe
        key={slug}
        title="Nextstrain MSA and tree"
        src={msaViewerUrl(slug)}
        style={{ width: '100%', height: 600, border: '1px solid #ccc' }}
      />
    </div>
  )
}
