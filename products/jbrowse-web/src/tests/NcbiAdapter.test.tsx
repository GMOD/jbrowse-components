// locals
import { setup, doBeforeEach, createView } from './util'
import config from '../../test_data/cfam2/config.json'

setup()

beforeEach(() => {
  doBeforeEach(url => require.resolve(`../../test_data/cfam2/${url}`))
})

const delay = { timeout: 30000 }
const opts = [{}, delay]

async function doSetup(val?: unknown) {
  const args = await createView(val)
  const { findByTestId, findByPlaceholderText } = args

  const autocomplete = await findByTestId('autocomplete', ...opts)
  const input = (await findByPlaceholderText(
    'Search for location',
  )) as HTMLInputElement

  autocomplete.focus()
  input.focus()

  return { autocomplete, input, ...args }
}

test('ncbi config', async () => {
  const { findByTestId } = await doSetup(config)
  const features = await findByTestId('svgfeatures', ...opts)
  expect(features).toMatchSnapshot()
}, 30000)
