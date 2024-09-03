import React from 'react'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import clsx from 'clsx'
import Link from '@docusaurus/Link'
import useDocusaurusContext from '@docusaurus/useDocusaurusContext'
import Layout from '@theme/Layout'
import MiniFeatures from '@site/src/components/MiniFeatures'

// locals
import MiniPlugins from '../components/MiniPlugins'
import styles from './styles.module.css'

function Header() {
  const { siteConfig } = useDocusaurusContext()

  return (
    <header
      className={clsx('hero hero--primary', styles.heroBanner)}
      style={{ backgroundColor: '#135560' }}
    >
      <div className="container">
        <h1 className="hero__title">JBrowse 2 Cancer Resources</h1>
        <p className="hero__subtitle">
          A hub of tutorials, plugins, and information regarding cancer data and
          JBrowse 2
        </p>
        <div className={styles.buttons}>
          <Link
            className="button button--secondary button--lg"
            href={`https://jbrowse.org/code/jb2/${
              /* @ts-expect-error */ siteConfig.customFields.currentVersion
            }/?config=test_data/config_demo.json&session=share-oTyYRpz9fN&password=fYAbt`}
          >
            Browse a cancer annotations demo web instance
          </Link>
        </div>
      </div>
    </header>
  )
}

export default function Home() {
  const { siteConfig } = useDocusaurusContext()
  return (
    <Layout title={`${siteConfig.title}`} description={`${siteConfig.tagline}`}>
      <Header />
      <main>
        <MiniFeatures />
        <div style={{ marginLeft: '5em', marginRight: '5em' }}>
          <h2>JBrowse 2 plugins to connect cancer annotation datasets</h2>
          <p>
            This is a hub of plugins that provide an instance of JBrowse 2
            access to cancer-associated annotation datasets.
          </p>
          <MiniPlugins />
          <Alert severity="info">
            <AlertTitle>Don't see your dataset here?</AlertTitle>
            <strong>
              {/* eslint-disable-next-line react/jsx-no-target-blank*/}
              <a
                href="https://github.com/GMOD/jbrowse-components/issues/new/choose"
                target="_blank"
              >
                Make a request
              </a>
            </strong>{' '}
            for a new plugin to connect the resource, or{' '}
            <strong>
              {/* eslint-disable-next-line react/jsx-no-target-blank*/}
              <a
                href="https://jbrowse.org/jb2/docs/developer_guide/"
                target="_blank"
              >
                design your own plugin
              </a>
            </strong>
            .
          </Alert>
          <br />
        </div>
      </main>
    </Layout>
  )
}
