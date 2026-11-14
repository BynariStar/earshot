# Earshot

**A hearing self-check and noise coach for astronauts, built on NASA's own rules and data.**
Team Earshot, NASA Space Apps Challenge 2026 (Haifa), Challenge: *Create Health Monitoring Software for Astronauts on Space Missions*.

Long missions put astronauts in constant machinery noise and expose them to fluid shifts that may affect the inner ear. NASA tracks this as a formal health risk, yet tests hearing only about once per ISS mission. Earshot lets an astronaut check their own hearing against their own baseline, in a browser, using NASA's shift definitions; shows where on the cochlea any change sits; and turns the day's noise exposure into concrete hearing-protection advice.

## What it does
- **Living cochlea home screen:** each test pitch is painted at its place along the cochlea (Greenwood 1990); tap a region for what it hears and its status.
- **Hearing self-check:** pulsed tones per ear at 250 Hz to 4 kHz, a standard down-10/up-5 threshold search, an output cap, two same-day baselines, and a confirming retest before any flag.
- **NASA's rules:** low-frequency shift (10 dB average at 250 and 500 Hz), high-frequency shift (10 dB average at 2, 3 and 4 kHz), sudden drop (30 dB).
- **Noise layer:** NASA-STD-3001 noise dose and ISS Flight Rule B13-152 checks, run on real NASA dosimetry and ISS module noise levels.
- **Private by design:** all results stay in the browser on your device.

Earshot is a research prototype, not a medical device. Consumer headphones aren't calibrated, so it measures change from your own baseline on the same headphones, never absolute hearing levels.

## Run it
```
npm install
npm run dev      # local development
npm test         # unit tests (NASA formulas and rules)
npm run build    # production build
```
Rebuild the data files from the original downloads: `python3 data-prep/prepare_data.py data-raw src/data` (needs `xlrd`).

## Data sources
| Data | Source | Use |
| --- | --- | --- |
| 24-hour noise dosimetry, 1-minute resolution, three chamber floors | NASA Life Sciences Portal, LMLSTP 3.3, *Acoustic Noise During the Phase III Chamber Test* (JSC, 1997) — [record](https://nlsp.nasa.gov/search/data/details/1b5df68e-c84b-59a3-b640-e2151357fce6?dataType=EXPERIMENTS) | Noise dose and flight-rule demo |
| Hearing threshold at 6 kHz by age, astronauts vs. comparisons | NASA Life Sciences Portal, LSAH Newsletter 7(2), 1998 (JMLSAHNEWSV722_153) and 14(1), 2006 (JMLSAHNEWSV1411_1) | Simulated crew |
| ISS module sound levels | Allen, C.S. (2024), *ISS Acoustics: A Status Report*, ICES-2024-354 — [NTRS](https://ntrs.nasa.gov/citations/20240006442) | Station soundscape |
| Treadmill level and earplug worked example | Allen & Danielson (2020), MMOP acoustics presentation — [NTRS](https://ntrs.nasa.gov/api/citations/20200002173/downloads/20200002173.pdf) | Day planner, tests |
| Noise dose formula and limits | NASA-STD-3001 Vol. 2 Rev F, [V2 6115], [V2 6077] — [PDF](https://www.nasa.gov/wp-content/uploads/2025/05/nasa-std-3001-vol-2.pdf) | Noise layer |
| Hearing shift definitions | NASA Human System Risk Board, hearing-loss risk record Rev B.1 (2025) — [PDF](https://www.nasa.gov/wp-content/uploads/2025/11/hsrb-hearing-loss-risk-record-rev-b-1-web.pdf) | Rules engine |
| In-flight hearing testing practice | Wexler et al. (2026), Aerosp Med Hum Perform 97(1):26–35 | Retest and 10 dB rationale |
| Auditory task, 40 volunteers × 10 sessions | Canadian Space Agency Open Data, PRET v5.0 LNSAT — [record](https://data.asc-csa.gc.ca/dataset/c22fa749-b005-4956-bf68-2ac2b9e68d31), Open Government Licence – Canada | Cross-check of hearing vs. cognitive scores |
| Cochlear place–frequency map | Greenwood, D.D. (1990), J Acoust Soc Am 87(6):2592–2605 | Cochlea drawing |

Original files are in `data-raw/`, unchanged. Contains information licensed under the Open Government Licence – Canada.

## Use of AI
Most of the code and the data-preparation script were written with Claude (Anthropic), directed and reviewed by the team. See [AI_USE.md](AI_USE.md) for exactly where and how, as the Space Apps rules require.

## License
Apache License 2.0. See [LICENSE](LICENSE).
