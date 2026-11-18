import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const root = path.resolve(__dirname, '../../../..')

const CALLS_PER_SHADER = {
  'packages/render-core/src/shaders/spanMark': 2,
  'plugins/alignments/src/shaders/slang/clip': 2,
  'plugins/alignments/src/shaders/slang/gap': 2,
  'plugins/alignments/src/shaders/slang/insertion': 2,
  'plugins/alignments/src/shaders/slang/mismatch': 2,
  'plugins/alignments/src/shaders/slang/overlap': 2,
  'plugins/alignments/src/shaders/slang/packedColorQuad': 2,
  'plugins/alignments/src/shaders/slang/read': 2,
  'plugins/features/src/LinearBasicDisplay/passes/shaders/line': 2,
  'plugins/features/src/LinearBasicDisplay/passes/shaders/rect': 2,
  'plugins/sequence/src/LinearReferenceSequenceDisplay/components/shaders/sequenceCell': 2,
  'plugins/wiggle/src/shared/shaders/wiggle': 2,
  'plugins/wiggle/src/shared/shaders/wiggleBand': 2,
  'plugins/wiggle/src/shared/shaders/wiggleDensity': 2,
  'plugins/wiggle/src/shared/shaders/wiggleLine': 2,
}

function callsPerShader(target: 'wgsl' | 'glsl') {
  const suffix = `.${target}.generated.ts`
  const counts: Record<string, number> = {}
  for (const rel of execFileSync('git', ['ls-files', `*${suffix}`], {
    cwd: root,
    encoding: 'utf8',
  })
    .split('\n')
    .filter(Boolean)) {
    const calls = readFileSync(path.join(root, rel), 'utf8').match(
      /(?<!fn |float )\bguardBandClipX_\d+\(/g,
    )
    if (calls) {
      counts[rel.slice(0, -suffix.length)] = calls.length
    }
  }
  return counts
}

test.each(['wgsl', 'glsl'] as const)(
  'every %s span shader pulls each end in to the guard band',
  target => {
    expect(callsPerShader(target)).toEqual(CALLS_PER_SHADER)
  },
)
