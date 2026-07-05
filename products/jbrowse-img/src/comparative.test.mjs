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

// Comparative assemblies + per-level synteny are built from the parsed CLI
// entries (argv order): each --fasta/--chromSizes opens an assembly, each synteny
// file binds to the gap it sits in.
test('dotplot renders two assemblies via a PAF', async () => {
  const svg = await renderRegion({
    mode: 'dotplot',
    argv: [
      ['fasta', [volvoxFasta]],
      ['paf', [paf]],
      ['fasta', [fasta2]],
    ],
  })
  assert.ok(svg.includes('<svg'), 'output should be SVG')
  assert.ok(svg.includes('<image'), 'dotplot should rasterize a dots layer')
})

test('synteny renders two assemblies via a PAF', async () => {
  const svg = await renderRegion({
    mode: 'synteny',
    argv: [
      ['fasta', [volvoxFasta]],
      ['paf', [paf]],
      ['fasta', [fasta2]],
    ],
  })
  assert.ok(svg.includes('<svg'), 'output should be SVG')
  assert.ok(svg.includes('<image'), 'synteny should rasterize a ribbon layer')
})

test('three-assembly synteny renders from interleaved CLI args', async () => {
  const svg = await renderRegion({
    mode: 'synteny',
    argv: [
      ['fasta', [volvoxFasta]],
      ['paf', [paf]],
      ['fasta', [fasta2]],
      ['paf', [paf]],
      ['fasta', [fasta3]],
    ],
  })
  assert.ok(svg.includes('<svg'), 'output should be SVG')
  assert.ok(svg.includes('<image'), 'synteny should rasterize ribbon layers')
})

test('comparative mode without a second assembly throws', async () => {
  await assert.rejects(
    renderRegion({
      mode: 'dotplot',
      argv: [
        ['fasta', [volvoxFasta]],
        ['paf', [paf]],
      ],
    }),
    /second assembly/,
  )
})

// A self-init view (synteny) keeps its `init` snapshot on failure for
// interactive recovery, so waiting on `!init` alone would hang headlessly. The
// init error is exposed as observable view state, which renderRegion rethrows —
// so a bad assembly fails fast with the real cause instead of hanging.
test('synteny with an unreadable assembly rejects instead of hanging', async () => {
  await assert.rejects(
    renderRegion({
      mode: 'synteny',
      argv: [
        ['fasta', ['/nonexistent/a.fa']],
        ['paf', ['/nonexistent/x.paf']],
        ['fasta', ['/nonexistent/b.fa']],
      ],
    }),
    /ENOENT|no such file/,
  )
})

// autoDiagonalize reorders the lower axis to follow the upper one. A PAF that
// cross-maps ctgA<->ctgB between the two assemblies forces the lower axis to
// flip from [ctgA,ctgB] to [ctgB,ctgA], so the diagonalized render differs from
// the undiagonalized one (rendering is otherwise deterministic, so the flag is
// the only variable). Also exercises the DiagonalizeSynteny RPC headlessly on
// the main-thread driver — a missing RPC registration would hang to the init
// timeout instead of returning.
test('synteny --autoDiagonalize reorders the lower axis', async () => {
  const crossPaf = path.join(tmp, 'cross.paf')
  fs.writeFileSync(
    crossPaf,
    [
      'ctgA\t50001\t1000\t6000\t+\tctgB\t6079\t100\t5100\t5000\t5000\t60',
      'ctgB\t6079\t100\t5100\t+\tctgA\t50001\t1000\t6000\t5000\t5000\t60',
    ].join('\n') + '\n',
  )
  const argv = [
    ['fasta', [volvoxFasta]],
    ['paf', [crossPaf]],
    ['fasta', [fasta2]],
  ]
  const plain = await renderRegion({ mode: 'synteny', argv })
  const diagonalized = await renderRegion({
    mode: 'synteny',
    argv,
    autoDiagonalize: true,
  })
  assert.ok(diagonalized.includes('<svg'), 'diagonalized output should be SVG')
  assert.notEqual(
    diagonalized,
    plain,
    'autoDiagonalize should reorder the axis, changing the render',
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
