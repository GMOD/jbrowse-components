import React from 'react'
import clsx from 'clsx'
import Layout from '@theme/Layout'
import Link from '@docusaurus/Link'
import useDocusaurusContext from '@docusaurus/useDocusaurusContext'
import useBaseUrl from '@docusaurus/useBaseUrl'
import styles from './styles.module.css'

function Home() {
  const context = useDocusaurusContext()
  const { siteConfig = {} } = context
  return (
    <Layout
      title={`${siteConfig.title}`}
      description="Description will go into a meta tag in <head />"
    >
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div style={{ flexBasis: '50%', margin: '5em' }}>
          <h1>JBrowse 2</h1>
          <p>
            A pluggable open-source platform for visualizing and integrating
            biological data
          </p>
          <button>Download latest release</button>
        </div>
        <div style={{ flexBasis: '50%' }}>
          <img src="img/dell.png" />
        </div>
      </div>
      <table style={{ width: '100%' }}>
        <thead>
          <td>JBrowse 2</td>
          <td>JBrowse 1</td>
        </thead>
        <tbody>
          <tr>
            <td>Runs on desktop or web</td>
            <td>Runs on desktop or web</td>
          </tr>
          <tr>
            <td>Supports many different view types</td>
            <td>Traditional linear view only</td>
          </tr>
        </tbody>
      </table>
    </Layout>
  )
}

export default Home
