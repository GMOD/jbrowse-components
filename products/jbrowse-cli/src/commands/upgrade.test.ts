/**
 * @jest-environment node
 */

import fs, { mkdirSync } from 'node:fs'
import path from 'node:path'

import { mockFetch, runCommand, runInTmpDir } from '../testUtil.ts'

jest.mock('../cliFetch')

const { readdir, readFile, writeFile } = fs.promises

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

// no localPath: upgrades the install in the current directory
test('upgrades the current directory', async () => {
  await runInTmpDir(async ctx => {
    mockFetch(url => {
      if (new URL(url).host === 'api.github.com') {
        return { json: releaseArray }
      }
      return {
        headers: { 'content-type': 'application/zip' },
        arrayBuffer: readZipAsArrayBuffer(),
      }
    })
    await writeFile('manifest.json', '{"name":"JBrowse"}')
    const { error } = await runCommand(['upgrade'])
    if (error) {
      throw error
    }
    expect(await readdir(ctx.dir)).toContain('manifest.json')
    // the archive's manifest.json replaced the placeholder written above
    const manifest = await readFile(path.join(ctx.dir, 'manifest.json'), 'utf8')
    expect(JSON.parse(manifest).theme_color).toBe('#396494')
  })
})

test('upgrades a directory with a specific version', async () => {
  await runInTmpDir(async ctx => {
    mockFetch(url => {
      if (new URL(url).host === 'api.github.com') {
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

// push.yml deploys a branch build under a slash-free prefix, so the URL built
// here has to collapse the slashes the same way or the request 404s against a
// build that exists. --nightly is the same code path with a name that has no
// slash to collapse, which is why this never showed up.
test('--branch asks for the prefix the branch was actually deployed under', async () => {
  await runInTmpDir(async () => {
    const requested: string[] = []
    mockFetch(url => {
      requested.push(url)
      return {
        headers: { 'content-type': 'application/zip' },
        arrayBuffer: readZipAsArrayBuffer(),
      }
    })
    await writeFile('manifest.json', '{"name":"JBrowse"}')

    await runCommand(['upgrade', '--branch', 'port/some-feature'])
    expect(requested).toEqual([
      'https://s3.amazonaws.com/jbrowse.org/code/jb2/port-some-feature/jbrowse-web-port-some-feature.zip',
    ])

    requested.length = 0
    await runCommand(['upgrade', '--nightly'])
    expect(requested).toEqual([
      'https://s3.amazonaws.com/jbrowse.org/code/jb2/main/jbrowse-web-main.zip',
    ])
  })
})

test('fails to upgrade if version does not exist', async () => {
  await runInTmpDir(async () => {
    mockFetch({ ok: false, status: 404, statusText: 'Not Found' })
    await writeFile('manifest.json', '{"name":"JBrowse"}')
    const { stderr } = await runCommand(['upgrade', '--tag', 'v999.999.999'])
    expect(stderr).toMatchSnapshot()
  })
})
test('fails if the fetch does not return the right file', async () => {
  await runInTmpDir(async () => {
    mockFetch({ headers: { 'content-type': 'application/json' } })
    await writeFile('manifest.json', '{"name":"JBrowse"}')
    const { stderr } = await runCommand([
      'upgrade',
      '--url',
      'https://example.com/JBrowse2-0.0.1.json',
    ])
    expect(stderr).toMatchSnapshot()
  })
})
