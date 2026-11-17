import { render } from '@testing-library/react'

import TrackNameText, { splitNameEnd } from './TrackNameText.tsx'

test('the end kept whole is the longest run of words within half the name', () => {
  expect(splitNameEnd('Fiber-seq Compendium - THP-1 CpG Hap1/2')).toEqual({
    start: 'Fiber-seq Compendium',
    end: ' - THP-1 CpG Hap1/2',
  })
  expect(splitNameEnd('Unusually Conserved - UCNE Paralogs')).toEqual({
    start: 'Unusually Conserved',
    end: ' - UCNE Paralogs',
  })
})

test('a name with no word short enough to keep is not split', () => {
  expect(splitNameEnd('GENCODE')).toBeUndefined()
  expect(splitNameEnd('ab cdefghijklmnop')).toBeUndefined()
  expect(splitNameEnd(' leading')).toBeUndefined()
})

test('the split name reads as the whole name, and markup is left whole', () => {
  const { container, rerender } = render(
    <TrackNameText name="Fiber-seq Compendium - THP-1 CpG diff" />,
  )
  expect(container.textContent).toBe('Fiber-seq Compendium - THP-1 CpG diff')
  expect(container.querySelectorAll('span span')).toHaveLength(2)

  rerender(<TrackNameText name="<i>italic</i> and some more words" />)
  expect(container.querySelectorAll('span span')).toHaveLength(1)
})
