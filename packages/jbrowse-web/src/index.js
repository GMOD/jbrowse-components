import React from 'react'
import ReactDOM from 'react-dom'
import { Provider } from 'mobx-react'
import './index.css'
import App from './App'
import Model from './model'
import * as serviceWorker from './serviceWorker'
import * as webWorkers from './webWorkers'

Model.addView('linear')
Model.views[0].addTrack('foo', 'Foo Track', 'tester')
Model.views[0].pushBlock('ctgA', 0, 100)

ReactDOM.render(
  <Provider rootModel={Model}>
    <App />
  </Provider>,
  document.getElementById('root'),
)

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: http://bit.ly/CRA-PWA
serviceWorker.register()
webWorkers.register()
