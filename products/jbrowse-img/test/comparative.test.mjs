import { strict as assert } from 'node:assert'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(__dirname, '../data/volvox')
const volvoxFasta = path.join(dataDir, 'volvox.fa')
const paf = path.join(dataDir, 'volvox-self.paf')

const { setupEnv, renderRegion } = await import('../src/index.ts')
setupEnv()

// The two assemblies need distinct names, so the second is a copy of volvox
// under a different filename (basename becomes the assembly name).
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jbimg-cmp-'))
const fasta2 = path.join(tmp, 'volvox2.fa')
fs.copyFileSync(volvoxFasta, fasta2)
fs.copyFileSync(`${volvoxFasta}.fai`, `${fasta2}.fai`)
const fasta3 = path.join(tmp, 'volvox3.fa')
fs.copyFileSync(volvoxFasta, fasta3)
fs.copyFileSync(`${volvoxFasta}.fai`, `${fasta3}.fai`)

test('dotplot renders two assemblies via a PAF', async () => {
  const svg = await renderRegion({
    mode: 'dotplot',
    fasta: volvoxFasta,
    fasta2,
    trackList: [['paf', [paf]]],
  })
  assert.ok(svg.includes('<svg'), 'output should be SVG')
  assert.ok(svg.includes('<image'), 'dotplot should rasterize a dots layer')
})

test('synteny renders two assemblies via a PAF', async () => {
  const svg = await renderRegion({
    mode: 'synteny',
    fasta: volvoxFasta,
    fasta2,
    trackList: [['paf', [paf]]],
  })
  assert.ok(svg.includes('<svg'), 'output should be SVG')
  assert.ok(svg.includes('<image'), 'synteny should rasterize a ribbon layer')
})

test('comparative mode without a second assembly throws', async () => {
  await assert.rejects(
    renderRegion({
      mode: 'dotplot',
      fasta: volvoxFasta,
      trackList: [['paf', [paf]]],
    }),
    /second assembly/,
  )
})

// N-way synteny is driven by a --config (assemblies + synteny tracks) plus a
// session-spec JSON, the same shape documented in urlparams.md. Mode is derived
// from the spec's view type when no subcommand is given.
test('three-assembly synteny renders from a config + session-spec JSON', async () => {
  const fastaAssembly = fasta => ({
    name: path.basename(fasta),
    sequence: {
      type: 'ReferenceSequenceTrack',
      trackId: `${path.basename(fasta)}-refseq`,
      adapter: {
        type: 'IndexedFastaAdapter',
        fastaLocation: { localPath: fasta },
        faiLocation: { localPath: `${fasta}.fai` },
      },
    },
  })
  const syntenyTrack = (trackId, assemblyNames) => ({
    type: 'SyntenyTrack',
    trackId,
    name: trackId,
    assemblyNames,
    adapter: {
      type: 'PAFAdapter',
      pafLocation: { localPath: paf },
      assemblyNames,
    },
  })
  const names = [volvoxFasta, fasta2, fasta3].map(f => path.basename(f))
  const config = {
    assemblies: [volvoxFasta, fasta2, fasta3].map(fastaAssembly),
    tracks: [
      syntenyTrack('a_b', [names[0], names[1]]),
      syntenyTrack('b_c', [names[1], names[2]]),
    ],
  }
  const spec = {
    views: [
      {
        type: 'LinearSyntenyView',
        tracks: [['a_b'], ['b_c']],
        views: names.map(name => ({ assembly: name })),
      },
    ],
  }
  const configFile = path.join(tmp, 'config.json')
  const specFile = path.join(tmp, 'spec.json')
  fs.writeFileSync(configFile, JSON.stringify(config))
  fs.writeFileSync(specFile, JSON.stringify(spec))

  const svg = await renderRegion({ config: configFile, spec: specFile })
  assert.ok(svg.includes('<svg'), 'output should be SVG')
  assert.ok(svg.includes('<image'), 'synteny should rasterize ribbon layers')
})
