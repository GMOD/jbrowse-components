import PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import { ThemeProvider } from '@mui/material'
import { fireEvent, render } from '@testing-library/react'

import AssemblyInfoPanel from './AssemblyInfoPanel.tsx'

import type { AboutConfig } from './util.ts'
import type { AbstractSessionModel } from '@jbrowse/core/util'

const pluginManager = new PluginManager([]).createPluggableElements()
pluginManager.configure()

const AssemblyConfigSchema = ConfigurationSchema(
  'Assembly',
  {
    aliases: { type: 'stringArray', defaultValue: [] },
    refNameAliases: ConfigurationSchema('RefNameAliases', {
      adapter: ConfigurationSchema('FromConfigAdapter', {
        // a real adapter config is a pluggable union member and carries its
        // `type` in the snapshot; a hand-built schema has to say so
        type: { type: 'string', defaultValue: '' },
        adapterId: { type: 'string', defaultValue: '' },
        features: { type: 'frozen', defaultValue: [] },
      }),
    }),
    sequence: ConfigurationSchema('ReferenceSequenceTrack', {
      trackId: { type: 'string', defaultValue: '' },
      adapter: ConfigurationSchema('TwoBitAdapter', {
        twoBitLocation: {
          type: 'fileLocation',
          defaultValue: { uri: '', locationType: 'UriLocation' },
        },
      }),
    }),
  },
  { explicitIdentifier: 'name' },
)

function makeAssemblyConf() {
  return AssemblyConfigSchema.create(
    {
      name: 'volvox',
      aliases: ['vvx'],
      refNameAliases: {
        adapter: {
          type: 'FromConfigAdapter',
          adapterId: 'W6DyPGJ0UU',
          features: [
            { refName: 'ctgA', uniqueId: 'alias1', aliases: ['A', 'contigA'] },
            { refName: 'ctgB', uniqueId: 'alias2', aliases: ['B', 'contigB'] },
          ],
        },
      },
      sequence: {
        trackId: 'volvox_refseq',
        adapter: {
          twoBitLocation: {
            uri: 'http://example.com/volvox.2bit',
            locationType: 'UriLocation',
          },
        },
      },
    },
    { pluginManager },
  )
}

const names = new Map([
  ['ctgA', ['ctgA', 'A', 'contigA']],
  ['ctgB', ['ctgB', 'B', 'contigB']],
])

interface FakeAssembly {
  namesByCanonicalRefName?: Map<string, string[]>
  error?: unknown
}

function makeSession(assembly: FakeAssembly | undefined) {
  return {
    assemblyManager: { get: () => assembly },
  } as unknown as AbstractSessionModel
}

function renderPanel(
  config: AboutConfig,
  {
    hideUris = false,
    // null, not undefined: an omitted key defaults to the loaded assembly, so
    // "the manager has no model for this name" needs a value of its own
    assembly = { namesByCanonicalRefName: names },
  }: { hideUris?: boolean; assembly?: FakeAssembly | null } = {},
) {
  return render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <AssemblyInfoPanel
        config={config}
        session={makeSession(assembly ?? undefined)}
        hideUris={hideUris}
      />
    </ThemeProvider>,
  )
}

test('shows the assembly a reference sequence track hangs off', () => {
  const { getByText } = renderPanel(makeAssemblyConf().sequence)
  expect(getByText('Assembly')).toBeTruthy()
  expect(getByText('volvox')).toBeTruthy()
  expect(getByText('vvx')).toBeTruthy()
  expect(getByText('Copy assembly config')).toBeTruthy()
})

// the card is the assembly's, so the sequence track's own config — the card
// above it in the dialog — is not repeated inside it
test('omits the sequence track config it would duplicate', () => {
  const { queryByText } = renderPanel(makeAssemblyConf().sequence)
  expect(queryByText('volvox_refseq')).toBeNull()
})

// an assembly whose aliases are written into the config carries the whole table
// in an adapter slot, which rendered as a spreadsheet over the four lines the
// card exists for. The same data, resolved, is one button away
test('omits an inline adapter payload but keeps the adapter itself', () => {
  const { getByText, queryByText } = renderPanel(makeAssemblyConf().sequence)
  expect(getByText('FromConfigAdapter')).toBeTruthy()
  expect(queryByText('alias1')).toBeNull()
  expect(queryByText('W6DyPGJ0UU')).toBeNull()
})

test('renders nothing for a track that is not an assembly sequence', () => {
  const { queryByText } = renderPanel({
    trackId: 't1',
    type: 'AlignmentsTrack',
    assemblyNames: ['volvox'],
  })
  expect(queryByText('Assembly')).toBeNull()
})

// the assembly config carries the sequence, alias and cytoband file locations,
// so it follows the same deployment switch the track card's Copy config does
test('hideUris hides the copy button', () => {
  const { queryByText, getByText } = renderPanel(makeAssemblyConf().sequence, {
    hideUris: true,
  })
  expect(queryByText('Copy assembly config')).toBeNull()
  // exposes no locations, so it stays
  expect(getByText('Show ref name aliases')).toBeTruthy()
})

test('lists every name for a refName, and filters by any of them', () => {
  // the listing is one <pre> of space-aligned rows rather than per-row nodes,
  // so it is read as text: getByText would normalize the alignment away
  const { baseElement, getByText, getByLabelText } = renderPanel(
    makeAssemblyConf().sequence,
  )
  const rows = () => baseElement.querySelector('pre')?.textContent
  fireEvent.click(getByText('Show ref name aliases'))
  expect(rows()).toBe('ctgA  A, contigA\nctgB  B, contigB')

  // filtering on an alias keeps the row that alias belongs to
  fireEvent.change(getByLabelText('Filter'), { target: { value: 'contigA' } })
  expect(rows()).toBe('ctgA  A, contigA')
})

// a spinner with nothing behind it is the failure the track's own "Show ref
// names" dialog was fixed for: an assembly the manager has no model for is an
// answer, not a load still in flight
test('says so when the session has no model for the assembly', () => {
  const { getByText } = renderPanel(makeAssemblyConf().sequence, {
    assembly: null,
  })
  fireEvent.click(getByText('Show ref name aliases'))
  expect(getByText(/No assembly named volvox is loaded/)).toBeTruthy()
})

test('waits on an assembly whose aliases have not loaded', () => {
  const { getByText } = renderPanel(makeAssemblyConf().sequence, {
    assembly: {},
  })
  fireEvent.click(getByText('Show ref name aliases'))
  expect(getByText('Loading assembly')).toBeTruthy()
})
