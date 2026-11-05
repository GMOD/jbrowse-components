import { fireEvent, render } from '@testing-library/react'

import { contigs, openHg38View } from '../wholeGenome.fixture.ts'
import ShowWholeGenomeButton from './ShowWholeGenomeButton.tsx'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

async function renderButton({
  withReport,
  disabled = false,
}: {
  withReport: boolean
  disabled?: boolean
}) {
  const { view } = await openHg38View({ withReport })
  const utils = render(
    <ShowWholeGenomeButton
      model={view}
      assemblyName="hg38"
      disabled={disabled}
      className=""
    />,
  )
  return { view, ...utils }
}

test('the dropdown at its end shows every region the chromosomes leave out', async () => {
  const { view, getByText, getByTestId, findByText } = await renderButton({
    withReport: true,
  })
  getByText('Show all chromosomes')
  fireEvent.click(getByTestId('show-whole-genome-more'))
  fireEvent.click(await findByText('Show all 6 regions'))
  expect(view.displayedRegions.map(r => r.refName)).toEqual(contigs)
})

test('the button itself shows the chromosomes', async () => {
  const { view, getByText } = await renderButton({ withReport: true })
  fireEvent.click(getByText('Show all chromosomes'))
  expect(view.displayedRegions.map(r => r.refName)).toEqual(['chr1', 'chr2'])
})

test('a disabled button disables its dropdown too', async () => {
  const { getByText, getByTestId } = await renderButton({
    withReport: true,
    disabled: true,
  })
  expect(getByText('Show all chromosomes')).toHaveProperty('disabled', true)
  expect(getByTestId('show-whole-genome-more')).toHaveProperty('disabled', true)
})

test('an assembly stating no roles gets a plain button with no dropdown', async () => {
  const { getByText, queryByTestId } = await renderButton({ withReport: false })
  getByText('Show all regions in assembly')
  expect(queryByTestId('show-whole-genome-more')).toBeNull()
})
