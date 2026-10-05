// What does the re-upload half of a multi-sample variant reorder cost in the
// browser: the instance buffer a block re-places today, handed to WebGL2
// whole through `bufferData` as the HAL does it, against the rows-sized
// `buildRowTable` texture the row-table gesture uploads instead?
//
//   node --experimental-transform-types plugins/variants/benches/variantReorderUpload.probe.ts
//   node --experimental-transform-types plugins/variants/benches/variantReorderUpload.probe.ts --rows=5008 --headless
//
// A PROBE: a bare WebGL2 context, no draw. Headed by default, since headless
// Chrome on this box is SwiftShader and misstates an upload; the renderer
// string is printed so one is never mistaken for the other. The harness rules
// are in agent-docs/reference/BENCHMARKING.md: the arms are interleaved,
// `buffer-control` is a second arm over the same bytes as `buffer-columns`,
// and the min and median are both reported. `issue` is the main thread's own
// share, the call returning; `done` adds a `finish()` so the GPU process has
// taken the bytes.
//
//   buffer-columns   `matrixCell`'s 12 bytes a cell, a new buffer each gesture
//   buffer-control   the same bytes through a second arm
//   buffer-genomic   `cell`'s 20 bytes a cell
//   table            the row table's RGBA8 texture, `rows` keys
import { buildRowTable } from '@jbrowse/render-core/marks'
import puppeteer from 'puppeteer'

const arg = (name: string, fallback: number) =>
  Number(
    process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1] ??
      fallback,
  )
const rows = arg('rows', 2504)
const features = arg('features', 1000)
const rounds = arg('rounds', 15)
const headless = process.argv.includes('--headless')

const numCells = rows * features
const slot = new Uint32Array(rows)
for (let r = 0; r < rows; r++) {
  slot[r] = (r * 7919) % rows
}
const table = buildRowTable(slot)

const browser = await puppeteer.launch({
  headless,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    ...(headless ? ['--use-gl=angle', '--ignore-gpu-blocklist'] : []),
  ],
})
try {
  const page = await browser.newPage()
  await page.goto('about:blank')
  const result = await page.evaluate(
    ({ numCells, rounds, tableBytes, tableW, tableH }) => {
      const canvas = document.createElement('canvas')
      canvas.width = 16
      canvas.height = 16
      const gl = canvas.getContext('webgl2', { antialias: false })
      if (!gl) {
        throw new Error('no webgl2')
      }
      const info = gl.getExtension('WEBGL_debug_renderer_info')
      const renderer = info
        ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL))
        : 'unknown'
      const fill = (words: number) => {
        const u32 = new Uint32Array(words)
        for (let i = 0; i < words; i++) {
          u32[i] = i * 2654435761
        }
        return u32
      }
      const columns = fill(numCells * 3)
      const columnsControl = fill(numCells * 3)
      const genomic = fill(numCells * 5)
      const texels = Uint8Array.from(tableBytes)

      let held: WebGLBuffer | null = null
      const uploadBuffer = (data: Uint32Array) => {
        const vbo = gl.createBuffer()
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo)
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
        const issued = performance.now()
        gl.finish()
        if (held) {
          gl.deleteBuffer(held)
        }
        held = vbo
        return issued
      }
      let heldTex: WebGLTexture | null = null
      const uploadTable = () => {
        const tex = gl.createTexture()
        gl.bindTexture(gl.TEXTURE_2D, tex)
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          tableW,
          tableH,
          0,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          texels,
        )
        const issued = performance.now()
        gl.finish()
        if (heldTex) {
          gl.deleteTexture(heldTex)
        }
        heldTex = tex
        return issued
      }
      const arms = [
        {
          name: 'buffer-columns',
          run: () => uploadBuffer(columns),
          bytes: columns.byteLength,
        },
        {
          name: 'buffer-control',
          run: () => uploadBuffer(columnsControl),
          bytes: columnsControl.byteLength,
        },
        {
          name: 'buffer-genomic',
          run: () => uploadBuffer(genomic),
          bytes: genomic.byteLength,
        },
        { name: 'table', run: uploadTable, bytes: texels.byteLength },
      ]
      const issue = new Map(arms.map(a => [a.name, [] as number[]]))
      const done = new Map(arms.map(a => [a.name, [] as number[]]))
      for (let round = 0; round < rounds; round++) {
        for (const arm of arms) {
          const t0 = performance.now()
          const issued = arm.run()
          const t1 = performance.now()
          issue.get(arm.name)!.push(issued - t0)
          done.get(arm.name)!.push(t1 - t0)
        }
      }
      return {
        renderer,
        arms: arms.map(a => ({
          name: a.name,
          bytes: a.bytes,
          issue: issue.get(a.name)!,
          done: done.get(a.name)!,
        })),
      }
    },
    {
      numCells,
      rounds,
      tableBytes: [...table.texture.bytes],
      tableW: table.texture.width,
      tableH: table.texture.height,
    },
  )
  console.log(`renderer: ${result.renderer}`)
  console.log(
    `${rows} rows x ${features} records = ${numCells.toLocaleString()} cells, ${rounds} rounds, min (median)`,
  )
  const stat = (xs: number[]) => {
    const s = xs.toSorted((a, b) => a - b)
    return `${s[0]!.toFixed(2).padStart(8)} ms (${s[Math.floor(s.length / 2)]!.toFixed(2)})`
  }
  for (const a of result.arms) {
    console.log(
      `${a.name.padEnd(16)} issue ${stat(a.issue)}  done ${stat(a.done)}  ${(a.bytes / 1e6).toFixed(2)} MB`,
    )
  }
} finally {
  await browser.close()
}
