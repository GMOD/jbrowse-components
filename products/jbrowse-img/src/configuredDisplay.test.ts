/**
 * @jest-environment jsdom
 *
 * jsdom and the fetch shim for the reasons renderSessionInit.test.ts gives.
 */
/**
 * What `--track <id> <modifiers>` draws and says for a track whose config
 * already sets its display up: the modifiers arrive the way `main.ts` hands
 * them over, as the entries `parseArgv` makes of the command line.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { enableStaticRendering } from 'mobx-react'

import { parseArgv } from './parseArgv.ts'
import { renderRegion } from './renderRegion.ts'

enableStaticRendering(true)

global.fetch = (async (input: RequestInfo | URL) => {
  const url = String(input)
  const payload = url.slice(url.indexOf(',') + 1)
  const buf = Buffer.from(
    url.includes(';base64,') ? payload : decodeURIComponent(payload),
    url.includes(';base64,') ? 'base64' : 'utf8',
  )
  return {
    arrayBuffer: async () =>
      buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
  }
}) as unknown as typeof fetch

const volvox = path.join(__dirname, '..', 'data', 'volvox')
const loc = 'ctgA:1-25000'

function configWith(display: Record<string, unknown>) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jb2export-configured-'))
  const file = path.join(dir, 'config.json')
  fs.writeFileSync(
    file,
    JSON.stringify({
      assemblies: [
        {
          name: 'volvox',
          sequence: {
            type: 'ReferenceSequenceTrack',
            trackId: 'volvox_refseq',
            adapter: {
              type: 'TwoBitAdapter',
              twoBitLocation: { localPath: path.join(volvox, 'volvox.2bit') },
            },
          },
        },
      ],
      tracks: [
        {
          type: 'FeatureTrack',
          trackId: 'genes',
          assemblyNames: ['volvox'],
          adapter: {
            type: 'BedTabixAdapter',
            bedGzLocation: {
              localPath: path.join(volvox, 'volvox-bed12.bed.gz'),
            },
            index: {
              location: {
                localPath: path.join(volvox, 'volvox-bed12.bed.gz.tbi'),
              },
            },
          },
          displays: [{ displayId: 'genes-display', ...display }],
        },
      ],
    }),
  )
  return file
}

function exportTrack(config: string, modifiers: string[] = [], locs = [loc]) {
  const argv = parseArgv([
    '--config',
    config,
    ...locs.flatMap(l => ['--loc', l]),
    '--track',
    'genes',
    ...modifiers,
  ])
  return renderRegion({
    config,
    loc: locs[0],
    argv,
    mode: locs.length > 1 ? 'breakpoint' : 'linear',
    showTracks: argv.filter(([key]) => key === 'track'),
    noRasterize: true,
    width: 800,
  })
}

const basic = { type: 'LinearBasicDisplay' }
const byName = { field: 'name', domain: ['EDEN.1', 'EDEN.2'] }
const byStrand = { field: 'strand', domain: ['1'] }

describe('a path write into a setting the config already writes', () => {
  test('changes that member and keeps the rest, as the config saying it would', async () => {
    const written = await exportTrack(
      configWith({ ...basic, color: byName, facet: byStrand }),
      ['color.domain=EDEN.2,EDEN.1', 'facet.domain=-1,1'],
    )
    const stated = await exportTrack(
      configWith({
        ...basic,
        color: { ...byName, domain: ['EDEN.2', 'EDEN.1'] },
        facet: { ...byStrand, domain: ['-1', '1'] },
      }),
    )
    expect(written).toBe(stated)
  }, 60000)

  test('reaches every panel of a breakpoint view the same way', async () => {
    const panels = ['ctgA:1-12000', 'ctgA:15000-25000']
    const written = await exportTrack(
      configWith({ ...basic, color: byName, facet: byStrand }),
      ['color.domain=EDEN.2,EDEN.1', 'facet.domain=-1,1'],
      panels,
    )
    const stated = await exportTrack(
      configWith({
        ...basic,
        color: { ...byName, domain: ['EDEN.2', 'EDEN.1'] },
        facet: { ...byStrand, domain: ['-1', '1'] },
      }),
      [],
      panels,
    )
    expect(written).toBe(stated)
  }, 60000)

  test('lands on a named modifier the same way in either order', async () => {
    const config = configWith(basic)
    const pathFirst = await exportTrack(config, [
      'color.domain=EDEN.2,EDEN.1',
      'color:red',
    ])
    const namedFirst = await exportTrack(config, [
      'color:red',
      'color.domain=EDEN.2,EDEN.1',
    ])
    expect(pathFirst).toBe(namedFirst)
    expect(pathFirst).toContain('fill="rgb(255,0,0)"')
  }, 60000)
})

// `group:` writes `facet`, the one object the feature, variant and alignments
// displays share, so it draws the same labelled sections a config asking for
// the facet draws.
describe('group: on a feature track', () => {
  // The section label is what a dropped modifier would cost, so it is asserted
  // as well as the equality: an ignored `group:` renders an unstacked track,
  // which carries no chip at all.
  test('stacks the same sections the config stating the facet does', async () => {
    const written = await exportTrack(configWith(basic), ['group:strand'])
    const stated = await exportTrack(configWith({ ...basic, facet: 'strand' }))
    expect(written).toBe(stated)
    expect(written).toContain('Forward strand')
  }, 60000)
})

describe('a mark display the rule list finds a problem in', () => {
  const marks = (...list: Record<string, unknown>[]) =>
    configWith({ type: 'LinearMarkDisplay', marks: list })

  test.each([
    ['a bar naming no y', marks({ mark: 'bar', encoding: {} })],
    [
      'a y its aggregate does not write',
      marks({
        mark: 'bar',
        transform: [
          { type: 'bin', step: 'auto' },
          {
            type: 'aggregate',
            groupby: ['start', 'end'],
            ops: [{ op: 'count' }],
          },
        ],
        encoding: { y: 'score' },
      }),
    ],
  ])(
    'fails on an error, %s, naming the track and the slot',
    async (_, config) => {
      await expect(exportTrack(config)).rejects.toThrow(
        /track "genes" mark 0 encoding\.y: /,
      )
    },
    60000,
  )

  test('puts an error ahead of the render failure it causes', async () => {
    await expect(
      exportTrack(
        marks({
          mark: 'bar',
          transform: [{ type: 'filter', expr: 'score>5' }],
          encoding: { y: 'score' },
        }),
      ),
    ).rejects.toThrow(/track "genes" mark 0 transform\.0\.expr: /)
  }, 60000)

  test("names the display's own step under no mark", async () => {
    await expect(
      exportTrack(
        configWith({
          type: 'LinearMarkDisplay',
          transform: [{ type: 'filter', expr: 'score>5' }],
          marks: [{ mark: 'bar', encoding: { y: 'score' } }],
        }),
      ),
    ).rejects.toThrow(/track "genes" transform\.0\.expr: /)
  }, 60000)

  test('says a warning and draws', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const svg = await exportTrack(
      marks({ mark: 'span', encoding: { y: 'score' } }),
    )
    expect(svg).toContain('<svg')
    expect(warn).toHaveBeenCalledWith(
      expect.stringMatching(/^Warning: track "genes" mark 0 encoding\.y: /),
    )
    warn.mockRestore()
  }, 60000)
})

describe('a jexl: value in a path write', () => {
  const nameIs = "jexl:get(feature,'name')=='EDEN.1'"

  test('keeps the commas of its own call, and a trailing comma makes a list of one', async () => {
    const written = await exportTrack(configWith(basic), [
      `jexlFilters=${nameIs},`,
    ])
    const stated = await exportTrack(
      configWith({ ...basic, jexlFilters: [nameIs] }),
    )
    expect(written).toBe(stated)
    expect(written).not.toContain('EDEN.2')
  }, 60000)

  test('writes one expression into a member', async () => {
    const callback = "jexl:get(feature,'start')>=0?'red':'blue'"
    const written = await exportTrack(configWith(basic), [
      `color.value=${callback}`,
    ])
    const stated = await exportTrack(
      configWith({ ...basic, color: { value: callback } }),
    )
    expect(written).toBe(stated)
    expect(written).toContain('fill="rgb(255,0,0)"')
  }, 60000)
})

describe('a jexl: colour field', () => {
  test('exports the track', async () => {
    const svg = await exportTrack(
      configWith({
        ...basic,
        color: { field: "jexl:get(feature,'name')", domain: ['EDEN.1'] },
      }),
    )
    expect(svg).toContain('<svg')
    expect(svg).toContain('EDEN.1')
  }, 60000)
})
