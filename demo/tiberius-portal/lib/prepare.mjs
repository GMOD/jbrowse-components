// Turn the caller's files into a static data directory JBrowse can read over
// plain HTTP, and write the config.json that names them.
import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'

const run = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], ...opts })

function have(cmd) {
  try {
    run('sh', ['-c', `command -v ${cmd}`])
    return true
  } catch {
    return false
  }
}

export function checkTools({ needsBam }) {
  const missing = ['bgzip', 'tabix', 'samtools'].filter(c => !have(c))
  if (needsBam && !have('samtools')) missing.push('samtools')
  if (missing.length) {
    throw new Error(
      `missing required tools: ${[...new Set(missing)].join(', ')}. ` +
        'Install htslib and samtools, or pass --no-prepare if your inputs are already bgzipped and indexed.',
    )
  }
}

const isGz = f => f.endsWith('.gz')

// A GFF has to be sorted by contig then start before tabix will index it, and
// the header lines have to stay on top.
function sortGff(input, output) {
  const script = `(grep '^#' ${JSON.stringify(input)} || true; grep -v '^#' ${JSON.stringify(input)} | sort -k1,1 -k4,4n) > ${JSON.stringify(output)}`
  run('sh', ['-c', script])
}

export function prepareGff(input, outDir, name) {
  fs.mkdirSync(outDir, { recursive: true })
  const target = path.join(outDir, `${name}.gff.gz`)
  if (isGz(input)) {
    fs.copyFileSync(input, target)
    for (const ext of ['.tbi', '.csi']) {
      if (fs.existsSync(input + ext)) fs.copyFileSync(input + ext, target + ext)
    }
  } else {
    const sorted = path.join(outDir, `${name}.sorted.gff`)
    sortGff(input, sorted)
    run('sh', ['-c', `bgzip -c ${JSON.stringify(sorted)} > ${JSON.stringify(target)}`])
    fs.unlinkSync(sorted)
  }
  if (!fs.existsSync(target + '.tbi') && !fs.existsSync(target + '.csi')) {
    run('tabix', ['-p', 'gff', target])
  }
  return path.basename(target)
}

export function prepareFasta(input, outDir, name) {
  fs.mkdirSync(outDir, { recursive: true })
  const target = path.join(outDir, `${name}.fa.gz`)
  if (isGz(input)) {
    fs.copyFileSync(input, target)
    for (const ext of ['.fai', '.gzi']) {
      if (fs.existsSync(input + ext)) fs.copyFileSync(input + ext, target + ext)
    }
  } else {
    // bgzip, not gzip: JBrowse needs block compression to seek into it
    run('sh', ['-c', `bgzip -c ${JSON.stringify(input)} > ${JSON.stringify(target)}`])
  }
  if (!fs.existsSync(target + '.fai') || !fs.existsSync(target + '.gzi')) {
    run('samtools', ['faidx', target])
  }
  return path.basename(target)
}

export function prepareBam(input, outDir) {
  fs.mkdirSync(outDir, { recursive: true })
  const target = path.join(outDir, path.basename(input))
  fs.copyFileSync(input, target)
  const idx = fs.existsSync(input + '.bai')
    ? input + '.bai'
    : fs.existsSync(input.replace(/\.bam$/, '.bai'))
      ? input.replace(/\.bam$/, '.bai')
      : null
  if (idx) fs.copyFileSync(idx, target + '.bai')
  else run('samtools', ['index', target])
  return path.basename(target)
}

const isUrl = s => /^https?:\/\//.test(s)

export function buildConfig({ assembly, fastaRef, predictionRef, referenceRef, rnaRefs, predictionName, referenceName }) {
  const uri = f => (isUrl(f) ? f : `data/${f}`)
  const tracks = [
    {
      type: 'FeatureTrack',
      trackId: 'prediction',
      name: predictionName || 'Prediction',
      category: ['Review'],
      assemblyNames: [assembly],
      adapter: { type: 'Gff3TabixAdapter', uri: uri(predictionRef) },
    },
  ]
  if (referenceRef) {
    tracks.push({
      type: 'FeatureTrack',
      trackId: 'reference_annotation',
      name: referenceName || 'Reference annotation',
      category: ['Review'],
      assemblyNames: [assembly],
      adapter: { type: 'Gff3TabixAdapter', uri: uri(referenceRef) },
    })
  }
  rnaRefs.forEach((r, i) => {
    tracks.push({
      type: 'AlignmentsTrack',
      trackId: `rnaseq_${i + 1}`,
      name: rnaRefs.length > 1 ? `RNA-seq ${i + 1}` : 'RNA-seq',
      category: ['Evidence'],
      assemblyNames: [assembly],
      adapter: { type: 'BamAdapter', uri: uri(r) },
    })
  })

  return {
    assemblies: [
      {
        name: assembly,
        sequence: {
          type: 'ReferenceSequenceTrack',
          trackId: `${assembly}-ref`,
          adapter: { type: 'BgzipFastaAdapter', uri: uri(fastaRef) },
        },
      },
    ],
    tracks,
    defaultSession: {
      name: 'Review',
      views: [{ id: 'review', type: 'LinearGenomeView', tracks: [] }],
    },
  }
}

// The track list every capture and every live link opens, in this order.
export function recipeTrackIds(config) {
  return config.tracks.map(t => t.trackId)
}
