// Turn the caller's files into a static data directory JBrowse can read over
// plain HTTP, and write the config.json that names them.
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

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
  if (needsBam && !have('samtools')) {missing.push('samtools')}
  if (missing.length) {
    throw new Error(
      `missing required tools: ${[...new Set(missing)].join(', ')}. ` +
        'Install htslib and samtools, or pass --no-prepare if your inputs are already bgzipped and indexed.',
    )
  }
}

const isGz = f => f.endsWith('.gz')

export const isUrl = s => /^https?:\/\//.test(s)

// Pull just the regions the portal covers out of a remote tabix-indexed file,
// so an example over a published genome costs a few hundred kB rather than the
// whole annotation.
//
// Runs from the output directory on purpose: tabix caches a remote .tbi into
// the process's working directory, so calling it from wherever the user
// happened to be drops a stray index file beside their shell.
export function fetchRegions(url, regions, outFile) {
  const cwd = path.dirname(outFile)
  fs.mkdirSync(cwd, { recursive: true })
  const out = JSON.stringify(path.resolve(outFile))
  run('sh', ['-c', `tabix -H ${JSON.stringify(url)} > ${out} || true`], { cwd })
  for (const r of regions) {
    run(
      'sh',
      ['-c', `tabix ${JSON.stringify(url)} ${JSON.stringify(r)} >> ${out}`],
      { cwd },
    )
  }
  return outFile
}

// A GFF has to be sorted by contig then start before tabix will index it, and
// the header lines have to stay on top.
function sortGff(input, output) {
  const script = `(grep '^#' ${JSON.stringify(input)} || true; grep -v '^#' ${JSON.stringify(input)} | sort -k1,1 -k4,4n) > ${JSON.stringify(output)}`
  run('sh', ['-c', script])
}

export function prepareGff(input, outDir, name) {
  if (isUrl(input)) {
    return input
  }
  fs.mkdirSync(outDir, { recursive: true })
  const target = path.join(outDir, `${name}.gff.gz`)
  if (isGz(input)) {
    fs.copyFileSync(input, target)
    for (const ext of ['.tbi', '.csi']) {
      if (fs.existsSync(input + ext)) {fs.copyFileSync(input + ext, target + ext)}
    }
  } else {
    const sorted = path.join(outDir, `${name}.sorted.gff`)
    sortGff(input, sorted)
    run('sh', ['-c', `bgzip -c ${JSON.stringify(sorted)} > ${JSON.stringify(target)}`])
    fs.unlinkSync(sorted)
  }
  if (!fs.existsSync(`${target  }.tbi`) && !fs.existsSync(`${target  }.csi`)) {
    run('tabix', ['-p', 'gff', target])
  }
  return path.basename(target)
}

export function prepareFasta(input, outDir, name) {
  if (isUrl(input)) {
    return input
  }
  fs.mkdirSync(outDir, { recursive: true })
  const target = path.join(outDir, `${name}.fa.gz`)
  if (isGz(input)) {
    fs.copyFileSync(input, target)
    for (const ext of ['.fai', '.gzi']) {
      if (fs.existsSync(input + ext)) {fs.copyFileSync(input + ext, target + ext)}
    }
  } else {
    // bgzip, not gzip: JBrowse needs block compression to seek into it
    run('sh', ['-c', `bgzip -c ${JSON.stringify(input)} > ${JSON.stringify(target)}`])
  }
  if (!fs.existsSync(`${target  }.fai`) || !fs.existsSync(`${target  }.gzi`)) {
    run('samtools', ['faidx', target])
  }
  return path.basename(target)
}

// The conflicts BED is written by the portal rather than handed to it, so it
// lands twice: plain, because "where are the disagreements" should be a file
// anyone can open, and bgzipped for the track that puts the answer in the
// picture.
export function prepareBed(text, outDir, name) {
  fs.mkdirSync(outDir, { recursive: true })
  const plain = path.join(outDir, `${name}.bed`)
  const target = path.join(outDir, `${name}.bed.gz`)
  fs.writeFileSync(plain, text)
  run('sh', ['-c', `bgzip -f -c ${JSON.stringify(plain)} > ${JSON.stringify(target)}`])
  run('tabix', ['-f', '-p', 'bed', target])
  return path.basename(target)
}

export function prepareBam(input, outDir) {
  if (isUrl(input)) {
    return input
  }
  fs.mkdirSync(outDir, { recursive: true })
  const target = path.join(outDir, path.basename(input))
  fs.copyFileSync(input, target)
  const idx = fs.existsSync(`${input  }.bai`)
    ? `${input  }.bai`
    : fs.existsSync(input.replace(/\.bam$/, '.bai'))
      ? input.replace(/\.bam$/, '.bai')
      : null
  if (idx) {fs.copyFileSync(idx, `${target  }.bai`)}
  else {run('samtools', ['index', target])}
  return path.basename(target)
}

export function buildConfig({ assembly, fastaRef, aliasesRef, predictionRef, conflictsRef, referenceRef, rnaRefs, rnaNames = [], rnaHeight, predictionName, referenceName }) {
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
  // Directly under the prediction, because the whole complaint about a capture
  // of a disagreement is that the eye cannot find it among the reference's
  // isoforms. This lane is one short box per disagreement, labelled with what
  // moved.
  if (conflictsRef) {
    tracks.push({
      type: 'FeatureTrack',
      trackId: 'conflicts',
      name: 'Disagreements',
      category: ['Review'],
      assemblyNames: [assembly],
      adapter: { type: 'BedTabixAdapter', uri: uri(conflictsRef) },
      // A handful of short boxes on one row. Left at the default it takes as
      // much of the frame as the alignments below it.
      displays: [
        {
          type: 'LinearBasicDisplay',
          displayId: 'conflicts-LinearBasicDisplay',
          height: 60,
        },
      ],
    })
  }
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
    const trackId = `rnaseq_${i + 1}`
    const track = {
      type: 'AlignmentsTrack',
      trackId,
      name: rnaNames[i] || (rnaRefs.length > 1 ? `RNA-seq ${i + 1}` : 'RNA-seq'),
      category: ['Evidence'],
      assemblyNames: [assembly],
      adapter: { type: 'BamAdapter', uri: uri(r) },
    }
    // A display block in the TRACK CONFIG is the one way to stage a lane that
    // both halves of a card obey, because both read this file. Neither of the
    // other two routes works on a released JBrowse: `displayDefaults` postdates
    // it, and a session spec's tracks are ids, so a track written as an object
    // to hang settings off resolves to nothing at all.
    if (rnaHeight) {
      track.displays = [
        {
          type: 'LinearAlignmentsDisplay',
          displayId: `${trackId}-LinearAlignmentsDisplay`,
          height: rnaHeight,
        },
      ]
    }
    tracks.push(track)
  })

  const asm = {
    name: assembly,
    sequence: {
      type: 'ReferenceSequenceTrack',
      trackId: `${assembly}-ref`,
      adapter: { type: 'BgzipFastaAdapter', uri: uri(fastaRef) },
    },
  }
  // A prediction GFF says chr22 where a reference FASTA often says 22, and
  // JBrowse reports the mismatch as "unknown reference sequence name" with the
  // assembly otherwise loading fine.
  if (aliasesRef) {
    asm.refNameAliases = {
      adapter: { type: 'RefNameAliasAdapter', uri: uri(aliasesRef) },
    }
  }

  return {
    assemblies: [asm],
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
