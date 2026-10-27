/**
 * @jest-environment node
 */
import * as esbuild from 'esbuild'

import { hostShim, shimSource } from './hostShim.ts'

import type { HostNames } from './hostShim.ts'

const KEY = '@jbrowse/display-kit/DisplayChrome'

function onHost(served: unknown, names: string[]) {
  const body = shimSource(KEY, names, 'Example')
    .replaceAll(/^export const (\w+) =/gm, 'out.$1 =')
    .replace('export default', 'out.default =')
  const out: Record<string, unknown> = {}
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  new Function('JBrowseExports', 'out', body)({ [KEY]: served }, out)
  return out
}

async function bundle(source: string, names?: HostNames) {
  const result = await esbuild.build({
    stdin: { contents: source, loader: 'js', resolveDir: __dirname },
    bundle: true,
    write: false,
    format: 'esm',
    logLevel: 'silent',
    plugins: [hostShim({ pluginName: 'Example', names, host: 'that host' })],
  })
  return result.outputFiles[0]!.text
}

async function buildError(source: string, names?: HostNames) {
  try {
    await bundle(source, names)
  } catch (e) {
    return (e as { errors: { text: string }[] }).errors
      .map(err => err.text)
      .join('\n')
  }
  throw new Error('the build succeeded')
}

describe('shimSource', () => {
  const Chrome = () => null
  const Status = () => null
  const names = ['DisplayStatusChrome', 'default']

  test('reads names and the default off a namespace marked __esModule', () => {
    const out = onHost(
      { __esModule: true, default: Chrome, DisplayStatusChrome: Status },
      names,
    )
    expect(out.default).toBe(Chrome)
    expect(out.DisplayStatusChrome).toBe(Status)
  })

  test('names the export a host serves the module without', () => {
    const out = onHost(Chrome, names)
    expect(out.default).toBe(Chrome)
    expect(out.DisplayStatusChrome).toHaveProperty(
      'jbrowseHostMissing',
      'DisplayStatusChrome',
    )
    expect(out.DisplayStatusChrome).toThrow(
      "This JBrowse does not provide 'DisplayStatusChrome' from '@jbrowse/display-kit/DisplayChrome' to plugins: Example was built for a different JBrowse version",
    )
  })

  test('serves a key with no names whole', () => {
    expect(shimSource('@mui/material/Checkbox', [], 'X')).toBe(
      'module.exports = JBrowseExports["@mui/material/Checkbox"]',
    )
  })
})

describe('hostShim', () => {
  test('binds a served import to the host instead of bundling it', async () => {
    const text = await bundle(
      `import { getSession } from '@jbrowse/core/util'; console.log(getSession)`,
    )
    expect(text).toContain('JBrowseExports["@jbrowse/core/util"]')
    expect(text).not.toContain('function getSession')
  })

  test('fails the build on a name the host does not serve', async () => {
    expect(
      await buildError(
        `import { notServed } from '@jbrowse/core/util'; console.log(notServed)`,
      ),
    ).toContain('No matching export')
  })

  test('fails the build on a namespace read of a name the host does not serve', async () => {
    expect(
      await buildError(
        `import * as util from '@jbrowse/core/util'; console.log(util.notServed)`,
      ),
    ).toContain('notServed')
  })

  test('fails the build on a module another host does not serve', async () => {
    expect(
      await buildError(`import '@jbrowse/core/util'`, { react: [] }),
    ).toContain("that host does not serve '@jbrowse/core/util' to plugins")
  })
})
