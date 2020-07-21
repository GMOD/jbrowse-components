import React from 'react'
// eslint-disable-next-line import/no-unresolved
import Layout from '@theme/Layout'
// eslint-disable-next-line import/no-unresolved
import useDocusaurusContext from '@docusaurus/useDocusaurusContext'

function Contact() {
  const context = useDocusaurusContext()
  const { siteConfig = {} } = context
  return (
    <Layout title={`${siteConfig.title}`} description="Contact us">
      <header>
        <div className="container">
          <h1 className="hero_title">Demos</h1>
        </div>
      </header>
      <main>
        <div className="container">
          <p>
            Here are some live demos and screenshots showing capabilities and
            features of JBrowse 2
          </p>
          <ul>
            <li>
              Demos presented at{' '}
              <a href="http://jbrowse.org/demos/itcr2020/">ITCR2020</a>
            </li>
            <li>
              Demos presented at{' '}
              <a href="http://jbrowse.org/demos/bog2020/">BOG2020</a>
            </li>
          </ul>
        </div>
      </main>
    </Layout>
  )
}

export default Contact
