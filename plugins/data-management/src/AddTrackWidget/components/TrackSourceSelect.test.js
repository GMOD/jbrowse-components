import React from 'react'
import { cleanup, fireEvent, render } from '@testing-library/react'
import TrackSourceSelect from './TrackSourceSelect'

describe('<TrackSourceSelect />', () => {
  afterEach(cleanup)

  it('renders', () => {
    const setTrackSource = jest.fn(() => {})
    const setTrackData = jest.fn(() => {})
    const { container, getByTestId } = render(
      <TrackSourceSelect
        trackSource="fromFile"
        setTrackSource={setTrackSource}
        trackData={{ uri: '' }}
        setTrackData={setTrackData}
      />,
    )
    expect(container.firstChild).toMatchSnapshot()
    fireEvent.click(getByTestId('addTrackFromConfigRadio'))
    expect(setTrackSource.mock.calls.length).toBe(1)
    expect(setTrackData.mock.calls.length).toBe(1)
  })
})
