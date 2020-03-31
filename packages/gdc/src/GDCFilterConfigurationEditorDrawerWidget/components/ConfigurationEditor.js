import { makeStyles } from '@material-ui/core/styles'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import React from 'react'
import Typography from '@material-ui/core/Typography'
import MenuItem from '@material-ui/core/MenuItem'
import FormControl from '@material-ui/core/FormControl'
import FormLabel from '@material-ui/core/FormLabel'
import Select from '@material-ui/core/Select'
import Input from '@material-ui/core/Input'
import Checkbox from '@material-ui/core/Checkbox'
import ListItemText from '@material-ui/core/ListItemText'
import AddIcon from '@material-ui/icons/Add'
import ClearIcon from '@material-ui/icons/Clear'
import HelpIcon from '@material-ui/icons/Help'
import IconButton from '@material-ui/core/IconButton'
import { v4 as uuidv4 } from 'uuid'
import List from '@material-ui/core/List'
import ListItem from '@material-ui/core/ListItem'
import Tooltip from '@material-ui/core/Tooltip'

// TODO: Convert these to use the GDC API
const ssmFacets = [
  {
    name: 'consequence.transcript.annotation.polyphen_impact',
    prettyName: 'polyphen impact',
    values: ['', 'benign', 'probably_damaging', 'possibly_damaging', 'unknown'],
  },
  {
    name: 'consequence.transcript.annotation.sift_impact',
    prettyName: 'sift impact',
    values: [
      '',
      'deleterious',
      'tolerated',
      'deleterious_low_confidence',
      'tolerated_low_confidence',
    ],
  },
  {
    name: 'consequence.transcript.annotation.vep_impact',
    prettyName: 'vep impact',
    values: ['modifier', 'moderate', 'low', 'high'],
  },
  {
    name: 'consequence.transcript.consequence_type',
    prettyName: 'consequence type',
    values: [
      'missense_variant',
      'downstream_gene_variant',
      'non_coding_transcript_exon_variant',
      'synonymous_variant',
      'intron_variant',
      'upstream_gene_variant',
      '3_prime_UTR_variant',
      'stop_gained',
      'frameshift_variant',
      '5_prime_UTR_variant',
      'splice_region_variant',
      'splice_acceptor_variant',
      'splice_donor_variant',
      'inframe_deletion',
      'inframe_insertion',
      'start_lost',
      'protein_altering_variant',
      'stop_lost',
      'stop_retained_variant',
      'coding_sequence_variant',
      'incomplete_terminal_codon_variant',
      'mature_miRNA_variant',
    ],
  },
  {
    name: 'mutation_subtype',
    prettyName: 'mutation subtype',
    values: ['single base substitution', 'small deletion', 'small insertion'],
  },
  {
    name: 'occurrence.case.observation.variant_calling.variant_caller',
    prettyName: 'variant caller',
    values: ['mutect2', 'varscan', 'muse', 'somaticsniper'],
  },
]
const geneFacets = [
  {
    name: 'biotype',
    prettyName: 'biotype',
    values: [
      'protein_coding',
      'lincRNA',
      'miRNA',
      'transcribed_unprocessed_pseudogene',
      'processed_pseudogene',
      'antisense',
      'unprocessed_pseudogene',
      'snoRNA',
      'IG_V_gene',
      'processed_transcript',
      'transcribed_processed_pseudogene',
      'TR_V_gene',
      'TR_J_gene',
      'unitary_pseudogene',
      'misc_RNA',
      'snRNA',
      'IG_V_pseudogene',
      'polymorphic_pseudogene',
      'IG_D_gene',
      'sense_overlapping',
      'sense_intronic',
      'IG_C_gene',
      'TEC',
      'IG_J_gene',
      'rRNA',
      'TR_C_gene',
      'TR_D_gene',
      'TR_V_pseudogene',
      'macro_lncRNA',
      'transcribed_unitary_pseudogene',
      'translated_unprocessed_pseudogene',
      'vaultRNA',
    ],
  },
  {
    name: 'is_cancer_gene_census',
    prettyName: 'is cancer gene census',
    values: ['1'],
  },
]
const caseFacets = [
  {
    name: 'demographic.ethnicity',
    prettyName: 'ethnicity',
    values: [
      'not hispanic or latino',
      'not reported',
      'hispanic or latino',
      'unknown',
    ],
  },
  {
    name: 'demographic.gender',
    prettyName: 'gender',
    values: ['female', 'male', 'unknown', 'not reported', 'unspecified'],
  },
  {
    name: 'demographic.race',
    prettyName: 'race',
    values: [
      'white',
      'not reported',
      'unknown',
      'black or african american',
      'asian',
      'other',
      'american indian or alaska native',
      'native hawaiian or other pacific islander',
      'not allowed to collect',
    ],
  },
  {
    name: 'disease_type',
    prettyName: 'disease type',
    values: [
      'adenomas and adenocarcinomas',
      'ductal and lobular neoplasms',
      'epithelial neoplasms, nos',
      'gliomas',
      'squamous cell neoplasms',
      'myeloid leukemias',
      'cystic, mucinous and serous neoplasms',
      'nevi and melanomas',
      'lymphoid leukemias',
      'transitional cell papillomas and carcinomas',
      'complex mixed and stromal neoplasms',
      'neuroepitheliomatous neoplasms',
      'neoplasms, nos',
      'plasma cell tumors',
      'germ cell neoplasms',
      'mesothelial neoplasms',
      'myomatous neoplasms',
      'osseous and chondromatous neoplasms',
      'mature b-cell lymphomas',
      'chronic myeloproliferative disorders',
      'lymphoid neoplasm diffuse large b-cell lymphoma',
      'myelodysplastic syndromes',
      'lipomatous neoplasms',
      'fibromatous neoplasms',
      'acinar cell neoplasms',
      'meningiomas',
      'soft tissue tumors and sarcomas, nos',
      'not reported',
      'thymic epithelial neoplasms',
      'complex epithelial neoplasms',
      'paragangliomas and glomus tumors',
      'leukemias, nos',
      'blood vessel tumors',
      'miscellaneous bone tumors',
      'specialized gonadal neoplasms',
      'nerve sheath tumors',
      'synovial-like neoplasms',
      'mature t- and nk-cell lymphomas',
      'not applicable',
      'miscellaneous tumors',
      'other leukemias',
      'neoplasms of histiocytes and accessory lymphoid cells',
      'mucoepidermoid neoplasms',
      'adnexal and skin appendage neoplasms',
      'basal cell neoplasms',
      'unknown',
      'malignant lymphomas, nos or diffuse',
      'fibroepithelial neoplasms',
      'granular cell tumors and alveolar soft part sarcomas',
      'hodgkin lymphoma',
      'trophoblastic neoplasms',
      'myxomatous neoplasms',
      'precursor cell lymphoblastic lymphoma',
      'mast cell tumors',
      'mesonephromas',
      'immunoproliferative diseases',
      'giant cell tumors',
      'odontogenic tumors',
      'lymphatic vessel tumors',
      'other hematologic disorders',
    ],
  },
  {
    name: 'primary_site',
    prettyName: 'primary site',
    values: [
      'bronchus and lung',
      'hematopoietic and reticuloendothelial systems',
      'breast',
      'colon',
      'spinal cord, cranial nerves, and other parts of central nervous system',
      'ovary',
      'kidney',
      'unknown',
      'skin',
      'pancreas',
      'prostate gland',
      'uterus, nos',
      'bladder',
      'liver and intrahepatic bile ducts',
      'connective, subcutaneous and other soft tissues',
      'thyroid gland',
      'brain',
      'esophagus',
      'stomach',
      'rectum',
      'other and ill-defined sites',
      'adrenal gland',
      'corpus uteri',
      'other and ill-defined digestive organs',
      'heart, mediastinum, and pleura',
      'cervix uteri',
      'other and unspecified major salivary glands',
      'lymph nodes',
      'testis',
      'bones, joints and articular cartilage of other and unspecified sites',
      'retroperitoneum and peritoneum',
      'other and ill-defined sites in lip, oral cavity and pharynx',
      'not reported',
      'thymus',
      'peripheral nerves and autonomic nervous system',
      'bones, joints and articular cartilage of limbs',
      'small intestine',
      'gallbladder',
      'meninges',
      'anus and anal canal',
      'eye and adnexa',
      'other and unspecified parts of biliary tract',
      'other and unspecified urinary organs',
      'oropharynx',
      'other endocrine glands and related structures',
      'larynx',
      'other and unspecified female genital organs',
      'other and unspecified parts of tongue',
      'nasopharynx',
      'rectosigmoid junction',
      'vagina',
      'floor of mouth',
      'tonsil',
      'other and unspecified parts of mouth',
      'nasal cavity and middle ear',
      'penis',
      'hypopharynx',
      'base of tongue',
      'ureter',
      'gum',
      'vulva',
      'lip',
      'trachea',
      'palate',
      'blood',
      'other and unspecified male genital organs',
      'renal pelvis',
    ],
  },
  {
    name: 'project.program.name',
    prettyName: 'program name',
    values: [
      'GENIE',
      'FM',
      'TCGA',
      'TARGET',
      'MMRF',
      'CPTAC',
      'BEATAML1.0',
      'NCICCR',
      'OHSU',
      'CGCI',
      'WCDT',
      'ORGANOID',
      'CTSP',
      'HCMI',
      'VAREPOP',
    ],
  },
  {
    name: 'project.project_id',
    prettyName: 'project id',
    values: [
      'FM-AD',
      'GENIE-MSK',
      'GENIE-DFCI',
      'GENIE-MDA',
      'GENIE-JHU',
      'GENIE-UHN',
      'TARGET-AML',
      'GENIE-VICC',
      'TARGET-ALL-P2',
      'TARGET-NBL',
      'TCGA-BRCA',
      'GENIE-GRCC',
      'MMRF-COMMPASS',
      'GENIE-NKI',
      'TARGET-WT',
      'TCGA-GBM',
      'TCGA-OV',
      'TCGA-LUAD',
      'BEATAML1.0-COHORT',
      'TCGA-UCEC',
      'TCGA-KIRC',
      'TCGA-HNSC',
      'TCGA-LGG',
      'TCGA-THCA',
      'TCGA-LUSC',
      'TCGA-PRAD',
      'NCICCR-DLBCL',
      'TCGA-SKCM',
      'TCGA-COAD',
      'TCGA-STAD',
      'CPTAC-3',
      'TCGA-BLCA',
      'TARGET-OS',
      'TCGA-LIHC',
      'CPTAC-2',
      'TCGA-CESC',
      'TCGA-KIRP',
      'TCGA-SARC',
      'TCGA-LAML',
      'TARGET-ALL-P3',
      'TCGA-ESCA',
      'TCGA-PAAD',
      'TCGA-PCPG',
      'OHSU-CNL',
      'TCGA-READ',
      'TCGA-TGCT',
      'TCGA-THYM',
      'CGCI-BLGSP',
      'TCGA-KICH',
      'WCDT-MCRPC',
      'TCGA-ACC',
      'TCGA-MESO',
      'TCGA-UVM',
      'ORGANOID-PANCREATIC',
      'TARGET-RT',
      'TCGA-DLBC',
      'TCGA-UCS',
      'BEATAML1.0-CRENOLANIB',
      'TCGA-CHOL',
      'CTSP-DLBCL1',
      'TARGET-ALL-P1',
      'HCMI-CMDC',
      'TARGET-CCSK',
      'VAREPOP-APOLLO',
    ],
  },
  {
    name: 'samples.sample_type',
    prettyName: 'sample type',
    values: [
      'primary tumor',
      'metastatic',
      'blood derived normal',
      'primary blood derived cancer - bone marrow',
      'solid tissue normal',
      'tumor',
      'not reported',
      'bone marrow normal',
      'primary blood derived cancer - peripheral blood',
      'recurrent blood derived cancer - bone marrow',
      'recurrent blood derived cancer - peripheral blood',
      'blood derived cancer - peripheral blood',
      'recurrent tumor',
      'next generation cancer model',
      'blood derived cancer - bone marrow, post-treatment',
      'granulocytes',
      'fibroblasts from bone marrow normal',
      'primary xenograft tissue',
      'buccal cell normal',
      'blood derived cancer - bone marrow',
      'unknown',
      'additional - new primary',
      'mononuclear cells from bone marrow normal',
      'blood derived cancer - peripheral blood, post-treatment',
      'cell lines',
      'ffpe scrolls',
      'expanded next generation cancer model',
      'additional metastatic',
      'lymphoid normal',
      'post neo-adjuvant therapy',
      'control analyte',
      'slides',
    ],
  },
  {
    name: 'summary.experimental_strategies.experimental_strategy',
    prettyName: 'experimental strategy',
    values: [
      'Targeted Sequencing',
      'WXS',
      'RNA-Seq',
      'miRNA-Seq',
      'Genotyping Array',
      'Methylation Array',
      'Tissue Slide',
      'Diagnostic Slide',
      'WGS',
      'ATAC-Seq',
    ],
  },
]

const useStyles = makeStyles(theme => ({
  root: {
    padding: theme.spacing(1, 3, 1, 1),
    background: theme.palette.background.default,
    overflowX: 'hidden',
  },
  formControl: {
    margin: theme.spacing(1),
    minWidth: 150,
  },
  filterCard: {
    margin: theme.spacing(1),
  },
  text: {
    display: 'flex',
    alignItems: 'center',
  },
}))

/**
 * A component for changing the track type
 */
const TrackType = observer(props => {
  const classes = useStyles()
  const [trackType, setTrackType] = React.useState(
    props.adapter.featureType.value,
  )

  const handleChange = event => {
    setTrackType(event.target.value)
    props.adapter.featureType.set(event.target.value)
  }
  return (
    <>
      <Typography variant="h6" className={classes.text}>
        Track Type
        <Tooltip
          title="Set the type of features to grab from the GDC portal"
          aria-label="help"
          placement="right"
        >
          <HelpIcon color="disabled" />
        </Tooltip>
      </Typography>
      <List>
        <ListItem>
          <FormControl className={classes.formControl}>
            <Select
              labelId="track-type-select-label"
              id="track-type-select"
              value={trackType}
              onChange={handleChange}
              displayEmpty
            >
              <MenuItem disabled value="">
                <em>Track type</em>
              </MenuItem>
              <MenuItem value={'mutation'}>Mutation</MenuItem>
              <MenuItem value={'gene'}>Gene</MenuItem>
            </Select>
          </FormControl>
        </ListItem>
      </List>
    </>
  )
})

/**
 * A card representing an individual filter with a category and set of applied values
 */
const Filter = observer(props => {
  const classes = useStyles()
  const { schema, filterObject, facets } = props
  const [categoryValue, setCategoryValue] = React.useState(
    filterObject.category
      ? facets.find(f => f.name === filterObject.category)
      : facets[0],
  )
  const [filterValue, setFilterValue] = React.useState(
    filterObject.filter ? filterObject.filter.split(',') : [],
  )

  const handleChangeCategory = event => {
    setCategoryValue(event.target.value)
    setFilterValue([])
    filterObject.setCategory(event.target.value.name)
  }

  const handleChangeFilter = event => {
    setFilterValue(event.target.value)
    filterObject.setFilter(event.target.value.join(','))
    updateTrack(schema.filters, schema.target)
  }

  function updateTrack(filters, target) {
    let gdcFilters = { op: 'and', content: [] }
    if (filters.length > 0) {
      for (const filter of filters) {
        if (filter.filter !== '') {
          gdcFilters.content.push({
            op: 'in',
            content: {
              field: `${filter.type}s.${filter.category}`,
              value: filter.filter.split(','),
            },
          })
        }
      }
    } else {
      gdcFilters = {}
    }
    target.adapter.filters.set(JSON.stringify(gdcFilters))
  }

  const handleFilterDelete = () => {
    schema.deleteFilter(filterObject.id)
    updateTrack(schema.filters, schema.target)
  }

  return (
    <>
      <List>
        <ListItem>
          <FormControl className={classes.formControl}>
            <Select
              labelId="category-select-label"
              id="category-select"
              value={categoryValue}
              onChange={handleChangeCategory}
              displayEmpty
            >
              <MenuItem disabled value="">
                <em>Category</em>
              </MenuItem>
              {facets.map(filterOption => {
                return (
                  <MenuItem value={filterOption} key={filterOption.name}>
                    {filterOption.prettyName}
                  </MenuItem>
                )
              })}
            </Select>
          </FormControl>
          <FormControl className={classes.formControl}>
            <Select
              labelId="demo-mutiple-checkbox-label"
              id="demo-mutiple-checkbox"
              multiple
              value={filterValue}
              onChange={handleChangeFilter}
              input={<Input />}
              displayEmpty
              renderValue={selected => {
                if (selected.length === 0) {
                  return <em>Filters</em>
                }

                return selected.join(', ')
              }}
            >
              <MenuItem disabled value="">
                <em>Filters</em>
              </MenuItem>
              {categoryValue.values.map(name => (
                <MenuItem key={name} value={name}>
                  <Checkbox checked={filterValue.indexOf(name) > -1} />
                  <ListItemText primary={name} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Tooltip title="Remove filter" aria-label="remove" placement="bottom">
            <IconButton aria-label="remove filter" onClick={handleFilterDelete}>
              <ClearIcon />
            </IconButton>
          </Tooltip>
        </ListItem>
      </List>
    </>
  )
})

const FilterList = observer(({ schema, type, facets }) => {
  const initialFilterSelection = facets[0].name

  const handleClick = () => {
    schema.addFilter(uuidv4(), initialFilterSelection, type, '')
  }

  return (
    <>
      <div>
        <FormLabel>{type} filters</FormLabel>
      </div>

      {schema.filters.map(filterObject => {
        if (filterObject.type === type) {
          return (
            <Filter
              schema={schema}
              {...{ filterObject }}
              key={filterObject.id}
              facets={facets}
            />
          )
        }
        return null
      })}
      <Tooltip title="Add a new filter" aria-label="add" placement="right">
        <IconButton aria-label="add" onClick={handleClick}>
          <AddIcon />
        </IconButton>
      </Tooltip>
    </>
  )
})

/**
 * Creates a corresponding filter model for existing filters from track
 * Assumes that the track filters are in a specific format
 * @param {*} schema schema
 */
function loadFilters(schema) {
  const filters = JSON.parse(schema.target.adapter.filters.value)
  if (filters.content && filters.content.length > 0) {
    for (const filter of filters.content) {
      let type
      if (filter.content.field.startsWith('cases.')) {
        type = 'case'
      } else if (filter.content.field.startsWith('ssms.')) {
        type = 'ssm'
      } else if (filter.content.field.startsWith('genes.')) {
        type = 'gene'
      } else {
        throw new Error(
          `The filter ${filter.content.field} is missing a type prefix.`,
        )
      }
      const name = filter.content.field.replace(`${type}s.`, '')
      schema.addFilter(uuidv4(), name, type, filter.content.value.join(','))
    }
  }
}

const GDCQueryBuilder = observer(({ schema }) => {
  schema.clearFilters()
  loadFilters(schema)

  const classes = useStyles()
  return (
    <>
      <TrackType {...schema.target} />
      <Typography variant="h6" className={classes.text}>
        Filters
        <Tooltip
          title="Apply filters to the current track"
          aria-label="help"
          placement="right"
        >
          <HelpIcon color="disabled" />
        </Tooltip>
      </Typography>
      <FilterList
        schema={schema}
        key="case"
        type="case"
        facets={caseFacets}
      ></FilterList>
      <FilterList
        schema={schema}
        key="gene"
        type="gene"
        facets={geneFacets}
      ></FilterList>
      <FilterList
        schema={schema}
        key="ssm"
        type="ssm"
        facets={ssmFacets}
      ></FilterList>
    </>
  )
})

function ConfigurationEditor({ model }) {
  const classes = useStyles()
  return (
    <div className={classes.root} data-testid="configEditor">
      {!model.target ? (
        'no target set'
      ) : (
        <GDCQueryBuilder schema={model} key="configEditor" />
      )}
    </div>
  )
}
ConfigurationEditor.propTypes = {
  model: MobxPropTypes.objectOrObservableObject.isRequired,
}

export default observer(ConfigurationEditor)
