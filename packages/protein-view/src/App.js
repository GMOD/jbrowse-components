import React from 'react'
import ProteinView from './components/ProteinView'

function App(props) {
  return (
    <div className="App">
      <h1>ProteinView testing</h1>
      <ProteinView {...props} />
    </div>
  )
}

export default App
