import {
render
} from '@testing-library/react'
import React from 'react'
import LinearSyntenyTrack from './LinearSyntenyTrack'

test('test', () => {
const {container} = render(<LinearSyntenyTrack />)
expect(container).toMatchSnapshot()
expect(1).toBe(1)
})
