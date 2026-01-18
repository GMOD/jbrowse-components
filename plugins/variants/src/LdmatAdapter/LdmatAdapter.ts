import { BaseAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { isUriLocation, updateStatus } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'

import type { PlinkLDHeader, PlinkLDRecord } from '../PlinkLDAdapter/types.ts'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { NoAssemblyRegion } from '@jbrowse/core/util/types'

// ldmat HDF5 format constants
const LD_DATASET = 'LD_values'
const POSITION_DATASET = 'positions'
const NAME_DATASET = 'names'
const CHUNK_NAME = 'chunk_'
const START_ATTR = 'start_locus'
const END_ATTR = 'end_locus'
const CHROMOSOME_ATTR = 'chromosome'

interface ChunkInfo {
  name: string
  startLocus: number
  endLocus: number
}

interface LdmatConfig {
  file: any
  chunks: ChunkInfo[]
  chromosome: string
  refNames: string[]
}

export default class LdmatAdapter extends BaseAdapter {
  private configured?: Promise<LdmatConfig>
  private h5wasmReady?: Promise<typeof import('h5wasm')>

  private async getH5wasm() {
    if (!this.h5wasmReady) {
      this.h5wasmReady = import('h5wasm').then(async h5wasm => {
        await h5wasm.ready
        return h5wasm
      })
    }
    return this.h5wasmReady
  }

  private async configurePre() {
    const ldmatLocation = this.getConf('ldmatLocation')
    const filehandle = openLocation(ldmatLocation, this.pluginManager)

    const buffer = await filehandle.readFile()
    const uri = isUriLocation(ldmatLocation) ? ldmatLocation.uri : 'data.h5'
    const filename = uri.split('/').pop() || 'data.h5'

    console.log('[LdmatAdapter] Loading HDF5 file, size:', buffer.length)

    const h5wasm = await this.getH5wasm()

    // Write buffer to virtual filesystem
    h5wasm.FS!.writeFile(filename, new Uint8Array(buffer))

    // Open the HDF5 file
    const file = new h5wasm.File(filename, 'r')

    console.log('[LdmatAdapter] File opened, keys:', file.keys())

    // Get chromosome from root attributes
    const chromosome = file.attrs.chromosome?.value?.toString() || ''
    console.log('[LdmatAdapter] Chromosome:', chromosome)

    // Find all chunks and their position ranges
    const chunks: ChunkInfo[] = []
    for (const key of file.keys()) {
      if (key.startsWith(CHUNK_NAME)) {
        const group = file.get(key) as any
        if (group) {
          // Attributes may be BigInt, convert to Number
          const startLocusRaw = group.attrs?.[START_ATTR]?.value
          const endLocusRaw = group.attrs?.[END_ATTR]?.value
          const startLocus =
            typeof startLocusRaw === 'bigint'
              ? Number(startLocusRaw)
              : (startLocusRaw as number)
          const endLocus =
            typeof endLocusRaw === 'bigint'
              ? Number(endLocusRaw)
              : (endLocusRaw as number)
          chunks.push({
            name: key,
            startLocus,
            endLocus,
          })
          console.log(
            `[LdmatAdapter] Found chunk ${key}: ${startLocus}-${endLocus}`,
          )
        }
      }
    }

    // Sort chunks by start position
    chunks.sort((a, b) => a.startLocus - b.startLocus)

    const refNames = chromosome ? [chromosome] : []
    console.log('[LdmatAdapter] RefNames:', refNames)

    return { h5: h5wasm.FS, file, chunks, chromosome, refNames }
  }

  protected async configurePre2() {
    if (!this.configured) {
      this.configured = this.configurePre().catch((e: unknown) => {
        this.configured = undefined
        throw e
      })
    }
    return this.configured
  }

  async configure(opts?: BaseOptions) {
    const { statusCallback = () => {} } = opts || {}
    return updateStatus('Loading ldmat file', statusCallback, () =>
      this.configurePre2(),
    )
  }

  public async getRefNames(opts: BaseOptions = {}) {
    const { refNames } = await this.configure(opts)
    return refNames
  }

  async getHeader(opts?: BaseOptions): Promise<PlinkLDHeader> {
    await this.configure(opts)
    // ldmat doesn't have the same header structure as PLINK
    // Return a compatible header
    return {
      columns: ['CHR_A', 'BP_A', 'SNP_A', 'CHR_B', 'BP_B', 'SNP_B', 'R2'],
      hasR2: true,
      hasDprime: false,
      hasMafA: false,
      hasMafB: false,
      chrAIdx: 0,
      bpAIdx: 1,
      snpAIdx: 2,
      chrBIdx: 3,
      bpBIdx: 4,
      snpBIdx: 5,
      r2Idx: 6,
      dprimeIdx: -1,
      mafAIdx: -1,
      mafBIdx: -1,
    }
  }

  /**
   * Get LD records where the first SNP (A) falls within the query region.
   */
  public async getLDRecords(
    query: NoAssemblyRegion,
    opts: BaseOptions = {},
  ): Promise<PlinkLDRecord[]> {
    const { refName, start, end } = query
    const { file, chunks, chromosome } = await this.configure(opts)

    console.log('[LdmatAdapter] getLDRecords query:', { refName, start, end })
    console.log(
      '[LdmatAdapter] Available chunks:',
      chunks.map(c => `${c.name}: ${c.startLocus}-${c.endLocus}`),
    )
    console.log(
      '[LdmatAdapter] Chromosome in file:',
      chromosome,
      'query refName:',
      refName,
    )

    // Check chromosome match - be flexible with chr prefix
    const chrMatch =
      !chromosome ||
      refName === chromosome ||
      refName === `chr${chromosome}` ||
      refName === chromosome.replace(/^chr/i, '') ||
      `chr${refName}` === chromosome

    if (!chrMatch) {
      console.log(
        '[LdmatAdapter] Chromosome mismatch:',
        refName,
        'vs',
        chromosome,
      )
      return []
    }

    const records: PlinkLDRecord[] = []

    // Find chunks that overlap with the query region
    for (const chunk of chunks) {
      console.log(
        `[LdmatAdapter] Checking chunk ${chunk.name}: ${chunk.startLocus}-${chunk.endLocus} vs query ${start}-${end}`,
      )
      if (chunk.endLocus < start || chunk.startLocus > end) {
        console.log('[LdmatAdapter] Chunk does not overlap, skipping')
        continue
      }

      console.log('[LdmatAdapter] Processing chunk:', chunk.name)

      const group = file.get(chunk.name)
      if (!group) {
        continue
      }

      // Get positions and names
      const positionsDataset = group.get(POSITION_DATASET)
      const namesDataset = group.get(NAME_DATASET)
      const ldDataset = group.get(LD_DATASET)

      if (!positionsDataset || !ldDataset) {
        console.log('[LdmatAdapter] Missing datasets in chunk')
        continue
      }

      // HDF5 int64 comes as BigInt64Array, need to convert to Number[]
      const positionsRaw = positionsDataset.value
      console.log(
        '[LdmatAdapter] positionsRaw type:',
        positionsRaw?.constructor?.name,
        'length:',
        positionsRaw?.length,
        'first elem type:',
        positionsRaw?.[0] !== undefined ? typeof positionsRaw[0] : 'N/A',
      )

      const positions: number[] = []
      if (positionsRaw && typeof positionsRaw.length === 'number') {
        for (const p of positionsRaw) {
          positions.push(typeof p === 'bigint' ? Number(p) : Number(p))
        }
      }

      const namesRaw = namesDataset?.value
      // Names may be byte arrays or typed array
      const names: string[] = []
      if (namesRaw && typeof namesRaw.length === 'number') {
        for (const n of namesRaw) {
          if (n instanceof Uint8Array) {
            names.push(new TextDecoder().decode(n))
          } else {
            names.push(String(n))
          }
        }
      }

      const ldMatrixRaw = ldDataset.value as Float32Array | number[][]
      const numSnps = positions.length
      const isFlat =
        ldMatrixRaw instanceof Float32Array || !Array.isArray(ldMatrixRaw[0])

      console.log(
        '[LdmatAdapter] ldMatrix type:',
        ldMatrixRaw?.constructor?.name,
        'length:',
        ldMatrixRaw?.length,
        'isFlat:',
        isFlat,
        'numSnps:',
        numSnps,
      )

      // Debug: check some actual values
      if (isFlat && ldMatrixRaw.length > 0) {
        const flat = ldMatrixRaw as Float32Array
        console.log(
          '[LdmatAdapter] ldMatrix flat[0]:',
          flat[0],
          'flat[1]:',
          flat[1],
          'flat[numSnps]:',
          flat[numSnps],
          'flat[numSnps+1]:',
          flat[numSnps + 1],
        )
      }

      // Helper to get LD value - handles both flat and 2D arrays
      const getLDValue = (row: number, col: number): number => {
        if (isFlat) {
          // Flat array: index = row * numCols + col
          const flat = ldMatrixRaw as Float32Array
          return flat[row * numSnps + col] ?? 0
        } else {
          // 2D array
          const matrix = ldMatrixRaw
          return matrix[row]?.[col] ?? 0
        }
      }

      console.log(
        '[LdmatAdapter] Chunk has',
        positions.length,
        'positions, first:',
        positions[0],
        'last:',
        positions[positions.length - 1],
      )

      // Find indices within query range
      const queryIndices: number[] = []
      for (const [i, pos] of positions.entries()) {
        if (pos !== undefined && pos >= start && pos <= end) {
          queryIndices.push(i)
        }
      }

      console.log(
        '[LdmatAdapter] Found',
        queryIndices.length,
        'positions in range',
      )

      // Extract LD values for pairs within the query region
      // The ldmat format stores full symmetric matrix
      let sampleCount = 0
      for (let ii = 0; ii < queryIndices.length; ii++) {
        const i = queryIndices[ii]!
        const posA = positions[i]!
        const nameA = names[i] || `${refName}:${posA}`

        for (let jj = ii + 1; jj < queryIndices.length; jj++) {
          const j = queryIndices[jj]!
          const posB = positions[j]!
          const nameB = names[j] || `${refName}:${posB}`

          // Get LD value from matrix using helper
          const r2 = getLDValue(i, j)

          // Log first few extractions
          if (sampleCount < 5) {
            console.log(`[LdmatAdapter] Extracting LD[${i}][${j}]: r2=${r2}`)
            sampleCount++
          }

          records.push({
            chrA: refName,
            bpA: posA,
            snpA: nameA,
            chrB: refName,
            bpB: posB,
            snpB: nameB,
            r2,
          })
        }
      }
    }

    console.log('[LdmatAdapter] Total records:', records.length)
    return records
  }

  /**
   * Get LD records where BOTH SNPs fall within the query region.
   */
  public async getLDRecordsInRegion(
    query: NoAssemblyRegion,
    opts: BaseOptions = {},
  ): Promise<PlinkLDRecord[]> {
    // For ldmat, getLDRecords already filters both positions
    return this.getLDRecords(query, opts)
  }

  public freeResources(): void {
    // Could close the HDF5 file here if needed
  }
}
