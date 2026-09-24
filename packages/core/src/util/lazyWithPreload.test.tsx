import { Suspense } from 'react'

import { act, render, screen } from '@testing-library/react'

import { lazyWithPreload } from './lazyWithPreload.ts'

function Loaded() {
  return <div>loaded</div>
}

test('a preloaded component renders on its first pass, without the fallback', async () => {
  const Component = lazyWithPreload(async () => ({ default: Loaded }))
  await Component.preload()
  render(
    <Suspense fallback={<div>fallback</div>}>
      <Component />
    </Suspense>,
  )
  expect(screen.getByText('loaded')).toBeTruthy()
  expect(screen.queryByText('fallback')).toBeNull()
})

test('a component rendered before its import lands shows the fallback, then itself', async () => {
  let resolve: (m: { default: typeof Loaded }) => void = () => {}
  const Component = lazyWithPreload(
    () =>
      new Promise<{ default: typeof Loaded }>(r => {
        resolve = r
      }),
  )
  render(
    <Suspense fallback={<div>fallback</div>}>
      <Component />
    </Suspense>,
  )
  expect(screen.getByText('fallback')).toBeTruthy()
  await act(async () => {
    resolve({ default: Loaded })
  })
  expect(await screen.findByText('loaded')).toBeTruthy()
})
