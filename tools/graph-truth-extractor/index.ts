import { chunkixBackend } from './backends/chunkix.ts'
import { naiveBackend } from './backends/naive.ts'
import { odgiBackend } from './backends/odgi.ts'
import { vgFindBackend } from './backends/vg.ts'
import { canonicalize } from './canonicalize.ts'

import type { ExtractRequest, ExtractResult } from './backends/types.ts'

export type {
  ExtractRequest,
  ExtractResult,
  TruthBackend,
} from './backends/types.ts'
export {
  canonicalize,
  canonicalizeParsed,
  summarizeDiff,
} from './canonicalize.ts'
export { parseGfa } from './parseGfa.ts'

export async function extractTruthSubgraph(
  req: ExtractRequest,
): Promise<ExtractResult> {
  switch (req.backend) {
    case 'vg':
      return vgFindBackend(req)
    case 'odgi':
      return odgiBackend(req)
    case 'chunkix':
      return chunkixBackend(req)
    case 'naive':
      return naiveBackend(req)
    default:
      throw new Error(
        `Unknown backend: ${(req as { backend: string }).backend}`,
      )
  }
}

export async function extractCanonical(
  req: ExtractRequest,
  opts: { useSequence?: boolean } = {},
): Promise<ExtractResult & { canonicalGfa: string }> {
  const result = await extractTruthSubgraph(req)
  return {
    ...result,
    canonicalGfa: canonicalize(result.gfa, opts),
  }
}
