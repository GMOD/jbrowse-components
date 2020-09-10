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
          <h1 className="hero_title">Contact us</h1>
        </div>
      </header>
      <main>
        <div className="container">
          <ul>
            <li>
              File an issue at{' '}
              <a href="https://github.com/gmod/jbrowse-components">
                https://github.com/gmod/jbrowse-components
              </a>
            </li>
            <li>
              Join our chat at{' '}
              <a href="https://gitter.im/GMOD/jbrowse">
                https://github.com/GMOD/jbrowse
              </a>
            </li>
            <li>
              Send an email to our mailing list at
              gmod-ajax@lists.sourceforge.net
            </li>
          </ul>
        </div>
      </main>
    </Layout>
  )
}

export default Contact
