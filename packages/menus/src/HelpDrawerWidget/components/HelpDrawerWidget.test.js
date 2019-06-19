import { createShallow } from '@material-ui/core/test-utils'
import React from 'react'
import HelpDrawerWidget from './HelpDrawerWidget'

describe('<HelpDrawerWidget />', () => {
  let shallow

  beforeAll(() => {
    shallow = createShallow()
  })

  it('renders', () => {
    const wrapper = shallow(<HelpDrawerWidget />)
    expect(wrapper).toMatchSnapshot()
  })
})
