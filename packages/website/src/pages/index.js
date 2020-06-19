import React from 'react';
import classnames from 'classnames';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import useBaseUrl from '@docusaurus/useBaseUrl';
import styles from './styles.module.css';


function Home() {
  const context = useDocusaurusContext();
  const {siteConfig = {}} = context;
  return (
    <Layout
      title={`Hello from ${siteConfig.title}`}
      description="Description will go into a meta tag in <head />">
      <header className={classnames('hero hero--primary', styles.heroBanner)}>
        <div className="container">
          <h1 className="hero__title">{siteConfig.title}</h1>
          <p className="hero__subtitle">{siteConfig.tagline}</p>
          <div className={styles.buttons}>
            <Link
              className={classnames(
                'button button--outline button--secondary button--lg',
                styles.getStarted,
              )}
              style={{background: 'white'}}
              to={useBaseUrl('docs/')}>
              Get Started
            </Link>
          </div>
        </div>
      </header>
      <main>
        <div className="container">
         <h1>JBrowse 2</h1>
    Features
    <ul>
    <li>Multiple views in a single page</li>
    <li>Built with ReactJS</li>
    <li>Renders large datasets with web workers</li>
    <li>New integrated view types including circular, dotplot, and stacked linear views</li>
    <li>GUI configuration editor</li>
    <li>Highly extensible via plugins</li>
    <li>New features for structural variant visualization</li>
    </ul>

        </div>
      </main>
    </Layout>
  );
}

export default Home;
