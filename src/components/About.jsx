// AI-generated: written by Claude (Anthropic AI assistant) for team Earshot, NASA Space Apps 2026.
// Reviewed and directed by the team. See AI_USE.md.
import { clearAll } from '../lib/storage.js';

const SOURCES = [
  ['NASA Human System Risk Board, Risk of Hearing Loss and Performance Decrements due to Acoustics Issues, risk record Rev B.1 (2025)', 'https://www.nasa.gov/wp-content/uploads/2025/11/hsrb-hearing-loss-risk-record-rev-b-1-web.pdf', 'Shift definitions and in-flight statistics'],
  ['NASA-STD-3001 Vol. 2 Rev F, section 6.6 Acoustics', 'https://www.nasa.gov/wp-content/uploads/2025/05/nasa-std-3001-vol-2.pdf', 'Noise dose formula [V2 6115] and limits'],
  ['NASA Life Sciences Portal, LMLSTP 3.3, Acoustic Noise During the Phase III Chamber Test (1997)', 'https://nlsp.nasa.gov/search/data/details/1b5df68e-c84b-59a3-b640-e2151357fce6?dataType=EXPERIMENTS', '24-hour minute-by-minute noise data'],
  ['NASA Life Sciences Portal, LSAH hearing-by-age tables (1998, 2006)', 'https://nlsp.nasa.gov/search/data?dataTypes=EXPERIMENTS%2CDATASETS&q=hearing', 'Typical high-pitch hearing by age'],
  ['Allen, C.S. (2024). ISS Acoustics: A Status Report. ICES-2024-354', 'https://ntrs.nasa.gov/citations/20240006442', 'ISS module noise levels'],
  ['Allen & Danielson (2020). ISS acoustics, NASA MMOP presentation', 'https://ntrs.nasa.gov/api/citations/20200002173/downloads/20200002173.pdf', 'Flight Rule B13-152 and the treadmill example'],
  ['Wexler et al. (2026). Hearing Assessments and Tympanometry in NASA Astronauts on the ISS. Aerosp Med Hum Perform 97(1):26-35', 'https://asma.kglmeridian.com/view/journals/amhp/97/1/article-p26.xml', 'In-flight testing practice; why 10 dB'],
  ['Canadian Space Agency, PRET open data (Open Government Licence - Canada)', 'https://data.asc-csa.gc.ca/dataset/c22fa749-b005-4956-bf68-2ac2b9e68d31', 'Auditory task data, 40 volunteers'],
  ['Allen & Danielson (2020) worked example and Limardo et al. (2021), crew noise dosimetry, INTER-NOISE 2021', 'https://ntrs.nasa.gov/citations/20210016151', 'Measured ISS workday and sleep exposures'],
  ['Chandrasekhar et al. (2019). Clinical Practice Guideline: Sudden Hearing Loss (Update). Otolaryngol Head Neck Surg 161(1_suppl)', 'https://pubmed.ncbi.nlm.nih.gov/31369359/', 'Sudden-drop response: definition, timing, treatment options'],
  ['Ahmed et al. (2018). Validity of the Hum Test, a Simple and Reliable Alternative to the Weber Test. Ann Otol Rhinol Laryngol 127(6)', 'https://eld.bl.uk/catalog/100071246325_0x000001', 'Hum test'],
  ['Diaz et al. (2024). Expiration analysis of the ISS formulary. npj Microgravity 10:76 (list via WikEM)', 'https://wikem.org/wiki/Common_medication_list_onboard_ISS', 'Steroids carried on the ISS'],
  ['Burke & Howard (2022). Internal Layout of a Lunar Surface Habitat. ASCEND 2022', 'https://ntrs.nasa.gov/api/citations/20220013669/downloads/Internal%20Layout%20of%20a%20Lunar%20Surface%20Habitat.pdf', 'Simulated Moon base layout'],
  ['NASA CHAPEA, Mars Dune Alpha habitat', 'https://www.nasa.gov/chapea/habitat', 'Simulated Mars base rooms'],
  ['NASA Moon to Mars exploration atmosphere (8.2 psia, 34% O2)', 'https://ntrs.nasa.gov/citations/20240003211', 'Cabin pressure for the bases'],
  ['Fan acoustics: sound power vs speed and gas density (fan laws)', 'https://www.punker.com/en/fan-technology-guide/basics-of-acoustics/fan-acoustics/', 'Pressure model for the bases'],
  ['Acoustic impedance (Z = ρc) and intensity (I = p²/Z)', 'https://sengpielaudio.com/FormulaWheel-Acoustics.htm', 'Pressure model for the bases'],
  ['Earphone output at altitude. Aerosp Med Hum Perform 90(7):655 (2019)', 'https://asma.kglmeridian.com/downloadpdf/view/journals/amhp/90/7/article-p655.pdf', 'Why baselines must match cabin pressure'],
  ['Gateway paused in favour of a lunar surface base (March 2026)', 'https://www.theregister.com/2026/03/24/goodbye_lunar_gateway_nasa_ditches/', 'Why there is no Gateway view'],
  ['Greenwood, D.D. (1990). J Acoust Soc Am 87(6):2592-2605', 'https://doi.org/10.1121/1.399052', 'Where each pitch sits on the cochlea'],
];

export default function About({ data, onReset }) {
  return (
    <section className="panel about">
      <h1>How Earshot works, and where it comes from</h1>
      <p>
        Earshot measures how quiet a tone you can hear at six pitches in each ear, and compares it with your own baseline taken on the same
        headphones at the same volume. Consumer headphones aren't calibrated, so it never reports absolute hearing levels, only change, which
        is also how NASA compares in-flight tests.
      </p>
      <p>
        A change counts only if a retest repeats it, because 10 dB is about two standard deviations of portable-test error (Wexler et al.
        2026). Tones are capped at 20 dB below the device's full scale, and you set a comfortable volume once and leave it.
      </p>
      <h2>Sources</h2>
      <ul className="sources">
        {SOURCES.map(([title, url, use]) => (
          <li key={url}>
            <a href={url} target="_blank" rel="noreferrer">{title}</a>
            <span className="muted"> · {use}</span>
          </li>
        ))}
      </ul>
      <h2>Your data</h2>
      <p>{data.tests.length} test(s) stored in this browser only. Nothing is uploaded.</p>
      <button
        className="secondary"
        onClick={() => {
          if (data.tests.length === 0) return;
          clearAll();
          onReset();
        }}
      >
        Delete all my results from this device
      </button>
    </section>
  );
}
