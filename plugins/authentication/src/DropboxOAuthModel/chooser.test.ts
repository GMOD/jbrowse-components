import configSchema from './configSchema.ts'
import stateModelFactory from './model.tsx'

function makeAccount(extra: { chooser?: boolean } = { chooser: true }) {
  return stateModelFactory(configSchema).create({
    type: 'DropboxOAuthInternetAccount',
    configuration: {
      type: 'DropboxOAuthInternetAccount',
      internetAccountId: 'testDropbox',
      clientId: 'test-app-key',
      ...extra,
    },
  })
}

function stubChooser(files: { name: string; link: string }[] | undefined) {
  const calls: { linkType: string }[] = []
  window.Dropbox = {
    choose: options => {
      calls.push({ linkType: options.linkType })
      if (files) {
        options.success(files)
      } else {
        options.cancel()
      }
    },
  }
  return calls
}

afterEach(() => {
  window.Dropbox = undefined
})

// the Chooser only works for a site listed in the app's Chooser domains, so an
// existing Dropbox account must not grow a button that opens an error
test('no browse button until the chooser is turned on', () => {
  expect(makeAccount({}).browseLabel).toBeUndefined()
  expect(makeAccount().browseLabel).toBe('Browse Dropbox')
})

test('a chosen file becomes its shared link, which the fetcher reads', async () => {
  const link = 'https://www.dropbox.com/scl/fi/abc123/reads.bam?rlkey=xyz&dl=0'
  const calls = stubChooser([{ name: 'reads.bam', link }])
  const location = await makeAccount().chooseLocation()
  expect(calls).toEqual([{ linkType: 'preview' }])
  expect(location).toEqual({ locationType: 'UriLocation', uri: link })
})

test('cancelling the Chooser resolves to no location', async () => {
  stubChooser(undefined)
  expect(await makeAccount().chooseLocation()).toBeUndefined()
})
