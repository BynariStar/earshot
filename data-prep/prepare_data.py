"""Convert the raw NASA and CSA files in data-raw/ into small JSON files the app loads.

Run from the repository root:
    python3 data-prep/prepare_data.py data-raw src/data

Sources (all public; see README "Data sources"):
- NASA Life Sciences Portal, LMLSTP 3.3 "Acoustic Noise During the Phase III Chamber Test" (1997):
  JMGROUNDLMLSTP33_122/123/124.xls, 24-hour A-weighted dosimetry at 1-minute resolution per chamber floor.
- NASA Life Sciences Portal, LSAH Newsletter 7(2) (1998), JMLSAHNEWSV722_153.xls:
  mean right-ear threshold at 6 kHz by age band and sex, astronauts vs. JSC comparison employees.
- CSA Open Data, PRET version 5.0, Letter-Number Sequencing Auditory Task (LNSAT), n=40.xls
  (Open Government Licence - Canada).
"""
import json
import math
import statistics
import sys
from collections import defaultdict
from pathlib import Path

import xlrd

# NASA-STD-3001 Vol 2 [V2 6115]: allowed minutes at level L, 75 dBA for 8 h, 3 dB exchange rate.
def allowed_minutes(level_dba):
    return 480.0 / 2 ** ((level_dba - 75.0) / 3.0)


def leq(levels):
    return 10 * math.log10(sum(10 ** (l / 10) for l in levels) / len(levels))


def dose(levels_per_minute):
    return 100.0 * sum(1.0 / allowed_minutes(l) for l in levels_per_minute)


def read_lmlstp_floor(path, floor_name):
    book = xlrd.open_workbook(str(path))
    sheet = book.sheet_by_index(0)
    header_row = None
    for r in range(sheet.nrows):
        if str(sheet.cell_value(r, 3)).strip() == "dB(A)" and str(sheet.cell_value(r, 1)).strip() == "DATE":
            header_row = r
            break
    if header_row is None:
        raise ValueError(f"no minute table found in {path}")
    minutes = []
    for r in range(header_row + 1, sheet.nrows):
        t = sheet.cell_value(r, 2)
        v = sheet.cell_value(r, 3)
        if isinstance(t, float) and isinstance(v, float) and v > 0:
            dt = xlrd.xldate_as_datetime(t, book.datemode)
            minutes.append({"t": dt.strftime("%Y-%m-%dT%H:%M"), "dba": round(v, 1)})
    # The recordings run a little over 24 h; keep the first 1,440 valid minutes (24 h).
    day = minutes[:1440]
    levels = [m["dba"] for m in day]
    return {
        "floor": floor_name,
        "sourceFile": path.name,
        "start": day[0]["t"],
        "end": day[-1]["t"],
        "minutes": len(day),
        "leq24hDba": round(leq(levels), 1),
        "maxDba": max(levels),
        "nasaDose24h": round(dose(levels), 1),
        "series": levels,
    }


def read_lsah_table(path):
    sheet = xlrd.open_workbook(str(path)).sheet_by_index(0)
    bands = [str(sheet.cell_value(7, c)).strip() for c in range(2, sheet.ncols)]
    groups = {}
    for r in range(8, 12):
        name = str(sheet.cell_value(r, 1)).strip()
        groups[name] = {
            band: (round(sheet.cell_value(r, c), 2) if isinstance(sheet.cell_value(r, c), float) else None)
            for band, c in zip(bands, range(2, sheet.ncols))
        }
    return {"metric": "Mean right-ear hearing threshold at 6 kHz (units not stated; presumably dB HL)",
            "ageBands": bands, "groups": groups}


def read_pret_lnsat(path):
    sheet = xlrd.open_workbook(str(path)).sheet_by_index(0)
    hdr = [sheet.cell_value(0, c) for c in range(sheet.ncols)]
    rows = [dict(zip(hdr, [sheet.cell_value(r, c) for c in range(sheet.ncols)])) for r in range(1, sheet.nrows)]
    sessions = defaultdict(lambda: defaultdict(list))
    for row in rows:
        sessions[int(row["Subject"])][int(row["Session"])].append(row)
    people = []
    for subject_index, (subject, by_session) in enumerate(sorted(sessions.items()), start=1):
        series = []
        for s in sorted(by_session):
            trials = by_session[s]
            passed = [t["TrialLevel"] for t in trials if t["ACC"] == 1]
            series.append({
                "session": s,
                "date": "-".join(f"{int(x):02d}" for x in str(trials[0]["Date_Time"]).split("_")[:3]),
                "highestLevelPassed": int(max(passed)) if passed else 0,
                "trials": len(trials),
                "correct": int(sum(t["ACC"] for t in trials)),
            })
        # Participant IDs are replaced by an index; no personal data is kept.
        people.append({"participant": subject_index, "sessions": series})
    diffs = []
    for p in people:
        lv = [s["highestLevelPassed"] for s in p["sessions"]]
        diffs += [b - a for a, b in zip(lv, lv[1:])]
    return {
        "task": "PRET v5.0 Letter-Number Sequencing Auditory Task (strings played over the computer's speakers)",
        "participants": len(people),
        "sessionToSessionChangeSD": round(statistics.stdev(diffs), 2),
        "sessionToSessionChangeMean": round(statistics.mean(diffs), 2),
        "people": people,
    }


def main(raw_dir, out_dir):
    raw, out = Path(raw_dir), Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    lm = raw / "nasa-lmlstp-3.3"
    floors = [
        read_lmlstp_floor(lm / "JMGROUNDLMLSTP33_122.xls", "First floor"),
        read_lmlstp_floor(lm / "JMGROUNDLMLSTP33_123.xls", "Second floor"),
        read_lmlstp_floor(lm / "JMGROUNDLMLSTP33_124.xls", "Third floor"),
    ]
    (out / "lmlstp.json").write_text(json.dumps({
        "source": "NASA Life Sciences Portal, LMLSTP 3.3, Acoustic Noise During the Phase III Chamber Test (JSC, 1997)",
        "url": "https://nlsp.nasa.gov/search/data/details/1b5df68e-c84b-59a3-b640-e2151357fce6?dataType=EXPERIMENTS",
        "note": "Static sound level readings per chamber floor, 1-minute A-weighted levels, first 24 h of each file.",
        "floors": floors,
    }))
    (out / "lsah.json").write_text(json.dumps({
        "source": "NASA Life Sciences Portal, LSAH Newsletter 7(2), Oct 1998 (JMLSAHNEWSV722_153)",
        "table": read_lsah_table(raw / "nasa-lsah" / "JMLSAHNEWSV722_153.xls"),
    }, indent=1))
    (out / "pret_lnsat.json").write_text(json.dumps({
        "source": "Canadian Space Agency Open Data, PRET (Performance Readiness Evaluation Tool), version 5.0, LNSAT n=40",
        "url": "https://data.asc-csa.gc.ca/dataset/c22fa749-b005-4956-bf68-2ac2b9e68d31",
        "licence": "Open Government Licence - Canada",
        **read_pret_lnsat(raw / "csa-pret" / "PRET5_LNSAT_n40.xls"),
    }))
    for f in floors:
        print(f"{f['floor']}: {f['minutes']} min, Leq {f['leq24hDba']} dBA, max {f['maxDba']}, dose {f['nasaDose24h']}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
