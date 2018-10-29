import React from 'react'
import ReactDOM from 'react-dom'
import { getSnapshot } from 'mobx-state-tree'
import { Provider } from 'mobx-react'

import './index.css'

import App from './App'
import RootModel from './model'
import * as serviceWorker from './serviceWorker'
import * as webWorkers from './webWorkers'

const model = RootModel.create({})
model.addView('linear')
model.views[0].addTrack('foo', 'Foo Track', 'tester')
model.views[0].addTrack('bar', 'Bar Track', 'tester')
model.views[0].addTrack('baz', 'Baz Track', 'tester')
model.views[0].pushBlock('ctgA', 0, 100)
model.addView('linear')
model.views[1].addTrack('bee', 'Bee Track', 'tester')
model.views[1].addTrack('bonk', 'Bonk Track', 'tester')
model.views[1].pushBlock('ctgA', 0, 100)

ReactDOM.render(
  <Provider rootModel={model}>
    <App />
  </Provider>,
  document.getElementById('root'),
)

console.log(JSON.stringify(getSnapshot(model)))

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: http://bit.ly/CRA-PWA
serviceWorker.register()
webWorkers.register()
