import * as uiBarrel from '../ui/index.ts'
import * as utilBarrel from '../util/index.ts'
import * as tracksBarrel from '../util/tracks.ts'
import { BARREL_ONLY_NAMES } from './barrelOnlyNames.ts'
import * as publicTracks from './publicTracks.ts'
import * as publicUi from './publicUi.tsx'
import * as publicUtil from './publicUtil.ts'

// The other half of the public*.ts split. Those files stop a barrel *removal*
// from narrowing the ABI behind your back; this stops a barrel *addition* from
// being invisibly absent from it, which the split is what introduced. Both
// failures look identical to a plugin author -- the import type-checks against
// the barrel and reads undefined off JBrowseExports.
const pairs = [
  ['@jbrowse/core/ui', uiBarrel, publicUi],
  ['@jbrowse/core/util/tracks', tracksBarrel, publicTracks],
  ['@jbrowse/core/util', utilBarrel, publicUtil],
] as const

test.each(pairs)(
  '%s serves its barrel, minus a named list',
  (name, barrel, abi) => {
    const served = new Set(Object.keys(abi))
    const unserved = Object.keys(barrel)
      .filter(n => !served.has(n))
      .sort()
    // to fix: re-export it from the public*.ts file, or name it in
    // barrelOnlyNames.ts -- whichever the new export is actually for
    expect(unserved).toEqual([...BARREL_ONLY_NAMES[name]].sort())
  },
)
