import { createShallow } from '@material-ui/core/test-utils'
import React from 'react'
import AboutDrawerWidget from './AboutDrawerWidget'

describe('<AboutDrawerWidget />', () => {
  let shallow

  beforeAll(() => {
    shallow = createShallow()
  })

  it('renders', () => {
    const wrapper = shallow(<AboutDrawerWidget />)
    expect(wrapper).toMatchSnapshot()
  })
})
