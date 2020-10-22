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
              Ask a question on our discussion board at{' '}
              <a
                href="https://github.com/GMOD/jbrowse-components/discussions"
                rel="noopener noreferrer"
                target="_blank"
              >
                https://github.com/GMOD/jbrowse-components/discussions
              </a>
            </li>
            <li>
              Report a bug or request a feature at{' '}
              <a
                href="https://github.com/GMOD/jbrowse-components/issues/new/choose"
                rel="noopener noreferrer"
                target="_blank"
              >
                https://github.com/GMOD/jbrowse-components/issues/new/choose
              </a>
            </li>
            <li>
              Join our chat at{' '}
              <a
                href="https://gitter.im/GMOD/jbrowse"
                rel="noopener noreferrer"
                target="_blank"
              >
                https://github.com/GMOD/jbrowse
              </a>
            </li>
            <li>
              Send an email to our mailing list at{' '}
              <a
                href="mailto:gmod-ajax@lists.sourceforge.net"
                rel="noopener noreferrer"
                target="_blank"
              >
                gmod-ajax@lists.sourceforge.net
              </a>
            </li>
          </ul>
        </div>
      </main>
    </Layout>
  )
}

export default Contact
