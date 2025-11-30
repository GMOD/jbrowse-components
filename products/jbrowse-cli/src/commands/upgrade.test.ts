import fs, { mkdirSync } from 'fs'
import path from 'path'

import { expect, test, vi } from 'vitest'

import { mockFetch, runCommand, runInTmpDir } from '../testUtil'

vi.mock('../fetchWithProxy')

const { readdir, writeFile } = fs.promises

const testZipPath = path.join(
  __dirname,
  '..',
  '..',
  'test',
  'data',
  'JBrowse2.zip',
)

function readZipAsArrayBuffer() {
  const buf = fs.readFileSync(testZipPath)
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
}

const releaseArray = [
  {
    tag_name: 'v0.0.2',
    prerelease: false,
    assets: [
      {
        browser_download_url: 'https://example.com/JBrowse2-0.0.2.zip',
        name: 'jbrowse-web-v0.0.2.zip',
      },
    ],
  },
  {
    tag_name: 'v0.0.1',
    prerelease: false,
    assets: [
      {
        browser_download_url: 'https://example.com/JBrowse2-0.0.1.zip',
        name: 'jbrowse-web-v0.0.1.zip',
      },
    ],
  },
]

test('fails if user selects a directory that does not have a installation', async () => {
  await runInTmpDir(async () => {
    mkdirSync('jbrowse')
    const { stderr } = await runCommand(['upgrade', 'jbrowse'])
    expect(stderr).toMatchSnapshot()
  })
})

test('fails if user selects a directory that does not exist', async () => {
  const { stderr } = await runCommand(['upgrade', 'jbrowse'])
  expect(stderr).toMatchSnapshot()
})

// xtest('upgrades a directory', async () => {
//   await runInTmpDir(async ctx => {
//     mockFetch(url => {
//       if (url.includes('api.github.com')) {
//         return { json: releaseArray }
//       }
//       return {
//         headers: { 'content-type': 'application/zip' },
//         arrayBuffer: readZipAsArrayBuffer(),
//       }
//     })
//     await writeFile('manifest.json', '{"name":"JBrowse"}')
//     const prevStat = await stat(path.join(ctx.dir, 'manifest.json'))
//     await runCommand(['upgrade'])
//     expect(await readdir(ctx.dir)).toContain('manifest.json')
//     // upgrade successful if it updates stats of manifest json
//     expect(await stat('manifest.json')).not.toEqual(prevStat)
//   })
// })

test('upgrades a directory with a specific version', async () => {
  await runInTmpDir(async ctx => {
    mockFetch(url => {
      if (url.includes('api.github.com')) {
        return { json: releaseArray[1] }
      }
      return {
        headers: { 'content-type': 'application/zip' },
        arrayBuffer: readZipAsArrayBuffer(),
      }
    })

    await writeFile('manifest.json', '{"name":"JBrowse"}')
    await runCommand(['upgrade', '--tag', 'v0.0.1'])
    expect(await readdir(ctx.dir)).toContain('manifest.json')
  })
})

test('upgrades a directory from a url', async () => {
  await runInTmpDir(async ctx => {
    mockFetch({
      headers: { 'content-type': 'application/zip' },
      arrayBuffer: readZipAsArrayBuffer(),
    })
    await writeFile('manifest.json', '{"name":"JBrowse"}')
    await runCommand([
      'upgrade',
      '--url',
      'https://example.com/JBrowse2-0.0.1.zip',
    ])
    expect(await readdir(ctx.dir)).toContain('manifest.json')
  })
})

test('fails to upgrade if version does not exist', async () => {
  mockFetch({ ok: false, status: 404, statusText: 'Not Found' })
  const { stderr } = await runCommand(['upgrade', '--tag', 'v999.999.999'])
  expect(stderr).toMatchSnapshot()
})
test('fails if the fetch does not return the right file', async () => {
  mockFetch({ headers: { 'content-type': 'application/json' } })
  const { stderr } = await runCommand([
    'upgrade',
    '--url',
    'https://example.com/JBrowse2-0.0.1.json',
  ])
  expect(stderr).toMatchSnapshot()
})
