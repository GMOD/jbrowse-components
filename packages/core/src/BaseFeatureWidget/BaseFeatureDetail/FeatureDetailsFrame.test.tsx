import { useState } from 'react'

import { act, render } from '@testing-library/react'
import { observable, runInAction } from 'mobx'

import FeatureDetailsFrame from './FeatureDetailsFrame.tsx'

test('a formatDetails error with no feature replaces the panel', () => {
  const { getByText, queryByText } = render(
    <FeatureDetailsFrame model={{ error: new Error('bad callback') }}>
      body
    </FeatureDetailsFrame>,
  )
  expect(getByText(/bad callback/)).toBeTruthy()
  expect(queryByText('body')).toBeNull()
})

test('a formatDetails error shows above the feature it fell back to', () => {
  const { getByText } = render(
    <FeatureDetailsFrame
      model={{
        error: new Error('bad callback'),
        featureData: { uniqueId: 'f', refName: 'ctgA', start: 0, end: 1 },
      }}
    >
      body
    </FeatureDetailsFrame>,
  )
  expect(getByText(/bad callback/)).toBeTruthy()
  expect(getByText('body')).toBeTruthy()
})

test('no feature says so rather than drawing an empty panel', () => {
  const { getByText, queryByText } = render(
    <FeatureDetailsFrame model={{}}>body</FeatureDetailsFrame>,
  )
  expect(getByText(/No feature loaded/)).toBeTruthy()
  expect(queryByText('body')).toBeNull()
})

test('a feature draws the body', () => {
  const { getByText } = render(
    <FeatureDetailsFrame
      model={{
        featureData: { uniqueId: 'f', refName: 'ctgA', start: 0, end: 1 },
      }}
    >
      body
    </FeatureDetailsFrame>,
  )
  expect(getByText('body')).toBeTruthy()
})

let mounts = 0

function Mounted() {
  const [mount] = useState(() => ++mounts)
  return <span>{`mount ${mount}`}</span>
}

function swapIn(trackId: string) {
  const featureData = { uniqueId: 'chr1-12', refName: 'chr1', start: 0, end: 1 }
  const model = observable({ trackId: 'gencode', featureData })
  const { getByText, queryByTestId } = render(
    <FeatureDetailsFrame model={model}>
      <Mounted />
    </FeatureDetailsFrame>,
  )
  const before = getByText(/mount/).textContent
  act(() => {
    runInAction(() => {
      model.trackId = trackId
      model.featureData = { ...featureData }
    })
  })
  return {
    remounted: getByText(/mount/).textContent !== before,
    washed: !!queryByTestId('feature-details-wash'),
  }
}

test('the same feature id from another track is a new feature', () => {
  expect(swapIn('refseq')).toEqual({ remounted: true, washed: true })
})

test('a re-format of the feature on screen keeps its UI state', () => {
  expect(swapIn('gencode')).toEqual({ remounted: false, washed: false })
})
