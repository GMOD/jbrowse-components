import './hostGlobals.ts'

import { alignmentColors, createTablesEngine } from './index.ts'
import { toWire } from './wire.ts'

// The bundle's interface to a bare host: `jbrowse.<table>(argsJson)` resolves
// to the tables as `toWire` writes them.

const send = (value: unknown) => JSON.stringify(toWire(value))

const engine = createTablesEngine()

;(globalThis as Record<string, unknown>).jbrowse = {
  alignments: async (args: string) =>
    send(await engine.alignments(JSON.parse(args))),
  features: async (args: string) =>
    send(await engine.features(JSON.parse(args))),
  wiggle: async (args: string) => send(await engine.wiggle(JSON.parse(args))),
  variants: async (args: string) =>
    send(await engine.variants(JSON.parse(args))),
  variantDensityAlpha: async (args: string) =>
    send(engine.variantDensityAlpha(JSON.parse(args))),
  synteny: async (args: string) => send(await engine.synteny(JSON.parse(args))),
  dotplot: async (args: string) => send(await engine.dotplot(JSON.parse(args))),
  contigs: async (args: string) => send(await engine.contigs(JSON.parse(args))),
  multiway: async (args: string) =>
    send(await engine.multiway(JSON.parse(args))),
  sequence: async (args: string) => engine.sequence(JSON.parse(args)),
  regions: async (args: string) => send(await engine.regions(JSON.parse(args))),
  alignmentColors: () => send(alignmentColors()),
}
