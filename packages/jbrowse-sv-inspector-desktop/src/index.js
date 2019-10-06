import React from 'react'
import ReactDOM from 'react-dom'
import JBrowse from './JBrowse'

const app = <JBrowse config={{ uri: 'test_data/config.json' }} />

ReactDOM.render(app, document.getElementById('root'))
