import PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import { ThemeProvider } from '@mui/material'
import { render, waitForElementToBeRemoved } from '@testing-library/react'

import RefNameInfoDialog from './RefNameInfoDialog.tsx'

import type { AboutConfig } from './util.ts'
import type { AbstractSessionModel } from '@jbrowse/core/util'

interface CallArgs {
  assemblyName: string
}
type Call = (a: unknown, b: unknown, args: CallArgs) => Promise<unknown>

function makeSession(call: Call) {
  return { rpcManager: { call } } as unknown as AbstractSessionModel
}

function renderConfig(config: AboutConfig, call: Call) {
  return render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <RefNameInfoDialog
        config={config}
        session={makeSession(call)}
        onClose={() => {}}
      />
    </ThemeProvider>,
  )
}

function renderDialog(assemblyNames: string[], call: Call) {
  return renderConfig(
    { trackId: 'track1', assemblyNames, adapter: { type: 'TestAdapter' } },
    call,
  )
}

test('renders ref names grouped by assembly', async () => {
  const { findByText, queryByText } = renderDialog(['volvox'], async () => [
    'ctgA',
    'ctgB',
  ])
  await waitForElementToBeRemoved(() => queryByText('Loading refNames'))
  expect(await findByText(/--- volvox ---/)).toBeTruthy()
  expect(await findByText(/ctgA/)).toBeTruthy()
})

test('dedups repeated assembly names into a single fetch', async () => {
  const call = jest.fn<Promise<unknown>, [unknown, unknown, CallArgs]>(
    async () => ['ctgA'],
  )
  const { findByText } = renderDialog(['volvox', 'volvox'], call)
  await findByText(/ctgA/)
  expect(call.mock.calls.length).toBe(1)
})

test('truncates long ref name lists with a copy hint', async () => {
  const names = Array.from({ length: 10_001 }, (_, i) => `ctg${i}`)
  const { findByText } = renderDialog(['big'], async () => names)
  expect(await findByText(/Too many refNames to show/)).toBeTruthy()
})

test('shows an error banner when the rpc rejects', async () => {
  const { findByText } = renderDialog(['volvox'], () =>
    Promise.reject(new Error('refnames boom')),
  )
  expect(await findByText(/refnames boom/)).toBeTruthy()
})

// regression: a ReferenceSequenceTrack config declares no `assemblyNames` slot,
// so reading one gave undefined, which useFetch reads as "key incomplete, don't
// fetch" — the dialog said "Loading refNames" forever, on every assembly's
// sequence track. The name comes from the assembly config holding it.
const corePluginManager = new PluginManager([]).createPluggableElements()
corePluginManager.configure()
const SeqTrackConf = ConfigurationSchema(
  'ReferenceSequenceTrack',
  { adapter: ConfigurationSchema('TestAdapter', {}) },
  { explicitIdentifier: 'trackId', explicitlyTyped: true },
)
const AssemblyConf = ConfigurationSchema(
  'Assembly',
  { sequence: SeqTrackConf },
  { explicitIdentifier: 'name' },
)

test('resolves a reference sequence track to its assembly', async () => {
  const assembly = AssemblyConf.create(
    { name: 'volvox', sequence: { trackId: 'volvox_refseq' } },
    { pluginManager: corePluginManager },
  )
  const call = jest.fn<Promise<unknown>, [unknown, unknown, CallArgs]>(
    async () => ['ctgA'],
  )
  const { findByText } = renderConfig(assembly.sequence, call)
  expect(await findByText(/--- volvox ---/)).toBeTruthy()
  expect(await findByText(/ctgA/)).toBeTruthy()
  expect(call.mock.calls[0]![2].assemblyName).toBe('volvox')
})

test('settles to an empty list when no assembly resolves, rather than spinning', async () => {
  const { findByText, queryByText } = renderConfig(
    // no assemblyNames, and a plain object has no parent to resolve one from
    { trackId: 'track1', adapter: { type: 'TestAdapter' } },
    async () => [],
  )
  await waitForElementToBeRemoved(() => queryByText('Loading refNames'))
  expect(await findByText('Copy ref names')).toBeTruthy()
})
