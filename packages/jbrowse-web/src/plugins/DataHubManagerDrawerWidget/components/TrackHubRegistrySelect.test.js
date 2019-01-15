import { createMount, createShallow } from '@material-ui/core/test-utils'
import React from 'react'
import TrackHubRegistrySelect from './TrackHubRegistrySelect'

describe('<TrackHubRegistrySelect />', () => {
  let shallow
  let mount

  beforeAll(() => {
    shallow = createShallow({ untilSelector: 'TrackHubRegistrySelect' })
    mount = createMount()
  })

  afterAll(() => {
    mount.cleanUp()
  })

  it('shallowly renders', () => {
    const wrapper = shallow(
      <TrackHubRegistrySelect
        enableNext={() => {}}
        disableNext={() => {}}
        setTrackDbUrl={() => {}}
        setHubName={() => {}}
        setAssemblyName={() => {}}
      />,
    )
    expect(wrapper).toMatchSnapshot()
  })

  it('mounts', async () => {
    const mockFetch = url => {
      if (url === 'https://www.trackhubregistry.org/api/info/ping')
        return Promise.resolve(new Response('{"ping":1}'))
      if (url === 'https://www.trackhubregistry.org/api/info/assemblies')
        return Promise.resolve(
          new Response(
            `{"Trametes cinnabarina":[{"synonyms":["bn946"],"name":"BN946","accession":"GCA_000765035.1"}],"Gallus gallus":[{"synonyms":["galgal4"],"name":"Gallus_gallus-4.0","accession":"GCA_000002315.2"}],"Phytophthora parasitica":[{"synonyms":["phyt_para_cj02b3_v1"],"name":"Phyt_para_CJ02B3_V1","accession":"GCA_000509465.1"}],"Anopheles albimanus":[{"synonyms":["aalbs2"],"name":"Anop_albi_ALBI9_A_V2","accession":"GCA_000349125.2"},{"synonyms":["aalbs1"],"name":"Anop_albi_ALBI9_A_V1","accession":"GCA_000349125.1"}],"Anopheles epiroticus":[{"synonyms":["aepie1"],"name":"Anop_epir_epiroticus2_V1","accession":"GCA_000349105.1"}],"Culex quinquefasciatus":[{"synonyms":["cpipj2"],"name":"CulPip1.0","accession":"GCA_000209185.1"}],"Glossina pallidipes":[{"synonyms":["gpali1"],"name":"Glossina_pallidipes-1.0.3","accession":"GCA_000688715.1"}],"Anopheles coluzzii":[{"synonyms":["acolm1"],"name":"m5","accession":"GCA_000150765.1"}],"Selaginella moellendorffii":[{"synonyms":["v1.0"],"name":"v1.0","accession":"GCA_000143415.1"}],"Pythium irregulare DAOM BR486":[{"synonyms":["pir_scaffolds_v1"],"name":"pir_scaffolds_v1","accession":"GCA_000387425.2"}],"Pyrenophora teres f. teres 0-1":[{"synonyms":["gca_000166005.1"],"name":"PyrTer_1.0","accession":"GCA_000166005.1"}]}`,
          ),
        )
      return Promise.resolve(new Response(''))
    }
    jest.spyOn(global, 'fetch').mockImplementation(mockFetch)
    const wrapper = mount(
      <TrackHubRegistrySelect
        enableNext={() => {}}
        disableNext={() => {}}
        setTrackDbUrl={() => {}}
        setHubName={() => {}}
        setAssemblyName={() => {}}
      />,
    )
    const instance = wrapper.instance()
    await instance.componentDidMount()
    expect(wrapper).toMatchSnapshot()
  })
})
