#!/usr/bin/env python3
"""
Build public/glaciers.csv from the raw GLIMS download in data/glims/{north,south}.

- Location: one representative point per glacier from glims_points.shp
- Lat/lon are encoded in the GLIMS id (G<lon*1000 east 0-360>E<lat*1000>N|S),
  so they are not stored separately; see lib/glaciers.js.
- Attributes: from glims_polygons.dbf, using the most recent "glac_bound"
  outline per glacier (preferring outlines whose status is "exists").

Pure standard library, streams the multi-GB DBF files.
Usage: python3 scripts/build-glaciers.py
"""
import csv
import os
import re
import struct
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "data", "glims")
OUT = os.path.join(ROOT, "public", "glaciers.csv")

WANT = ["line_type", "anlys_id", "glac_id", "anlys_time", "area", "db_area",
        "min_elev", "max_elev", "glac_name", "glac_stat", "geog_area",
        "proc_desc", "gtng_o1reg"]


def dbf_reader(path, want=None):
    with open(path, "rb") as fh:
        head = fh.read(32)
        n, header_len, rec_len = struct.unpack("<IHH", head[4:12])
        fields, off = [], 1
        while True:
            d = fh.read(32)
            if d[0] == 0x0D:
                break
            name = d[:11].split(b"\0")[0].decode()
            length = d[16]
            fields.append((name, off, length))
            off += length
        if want:
            fields = [f for f in fields if f[0] in want]
        fh.seek(header_len)
        for _ in range(n):
            rec = fh.read(rec_len)
            if len(rec) < rec_len:
                break
            if rec[0:1] == b"*":  # deleted record
                continue
            yield {name: rec[o:o + l].decode("latin1").strip() for name, o, l in fields}


def shp_points(path):
    """Yield (x, y) for each record of a Point shapefile."""
    with open(path, "rb") as fh:
        fh.seek(100)
        while True:
            rh = fh.read(8)
            if len(rh) < 8:
                break
            _, content_len = struct.unpack(">ii", rh)
            content = fh.read(content_len * 2)
            shape_type = struct.unpack("<i", content[:4])[0]
            if shape_type == 0:
                yield None
            else:
                yield struct.unpack("<dd", content[4:20])


def num(v):
    try:
        return float(v)
    except ValueError:
        return 0.0


def clean(v):
    return "" if v in ("None", "") else v


# placeholder names: US state codes (WA, MT...), "S/N" (sin nombre), bare numbers
PLACEHOLDER_NAME = re.compile(r"^([A-Z]{2}|S/N|\d+|\(.*\))$")


def clean_name(v):
    v = clean(v).replace(",", " ").strip()
    return "" if PLACEHOLDER_NAME.match(v) else v


def main():
    # GLIMS stores one record per outline *part*, and many analyses per glacier
    # (different years / submitters). Aggregate parts per analysis, then pick
    # the best analysis per glacier. The submitted "area" field is unreliable
    # (units mixed up, often 0), so we use "db_area", computed by GLIMS from
    # the geometry.
    analyses = {}  # (glac_id, anlys_id) -> aggregate
    fallback = {}  # glac_id -> name / region / elevation seen on any analysis

    for hemi in ("north", "south"):
        d = os.path.join(SRC, hemi)
        print(f"[{hemi}] reading polygon attributes...", file=sys.stderr)
        for i, r in enumerate(dbf_reader(os.path.join(d, "glims_polygons.dbf"), set(WANT))):
            if i % 100000 == 0:
                print(f"  {i:,}", file=sys.stderr)
            if r["line_type"] != "glac_bound":
                continue
            # skip reconstructed Little Ice Age extents (not present-day ice)
            if r["geog_area"] == "LIA outlines" or "little ice age" in r["proc_desc"].lower():
                continue
            gid = r["glac_id"]
            name = clean_name(r["glac_name"])
            o1 = int(num(r["gtng_o1reg"]))
            lo, hi = int(num(r["min_elev"])), int(num(r["max_elev"]))

            key = (gid, r["anlys_id"])
            a = analyses.get(key)
            if a is None:
                a = analyses[key] = {"gid": gid, "time": r["anlys_time"], "exists": r["glac_stat"] == "exists",
                                     "area": 0.0, "name": "", "o1": 0, "lo": 0, "hi": 0}
            a["area"] += num(r["db_area"])
            a["name"] = a["name"] or name
            a["o1"] = a["o1"] or o1
            if lo > 0:
                a["lo"] = min(a["lo"], lo) if a["lo"] else lo
            a["hi"] = max(a["hi"], hi)

            f = fallback.setdefault(gid, {"name": "", "name_t": "", "o1": 0, "lo": 0, "hi": 0, "elev_t": ""})
            if name and r["anlys_time"] >= f["name_t"]:
                f["name"], f["name_t"] = name, r["anlys_time"]
            f["o1"] = f["o1"] or o1
            if hi > 0 and r["anlys_time"] >= f["elev_t"]:
                f["lo"], f["hi"], f["elev_t"] = lo, hi, r["anlys_time"]

    best = {}
    for a in analyses.values():
        # rank: existing first, then most recent, then largest (ties on date)
        rank = (a["exists"], a["time"][:10], a["area"])
        prev = best.get(a["gid"])
        if prev is None or rank > prev[0]:
            best[a["gid"]] = (rank, a)
    del analyses

    rows = []
    for hemi in ("north", "south"):
        d = os.path.join(SRC, hemi)
        print(f"[{hemi}] reading points...", file=sys.stderr)
        ids = dbf_reader(os.path.join(d, "glims_points.dbf"))
        pts = shp_points(os.path.join(d, "glims_points.shp"))
        for rec, pt in zip(ids, pts):
            if pt is None:
                continue
            gid = rec["glacier_id"]
            b = best.get(gid)
            if b is None or not b[1]["exists"] or b[1]["area"] <= 0:
                continue
            a, f = b[1], fallback[gid]
            lo, hi = (a["lo"], a["hi"]) if a["hi"] else (f["lo"], f["hi"])
            rows.append([
                gid,
                a["name"] or f["name"],
                f"{a['area']:.3f}".rstrip("0").rstrip("."),
                lo or "",
                hi or "",
                a["o1"] or f["o1"] or "",
            ])

    with open(OUT, "w", newline="") as fh:
        w = csv.writer(fh, lineterminator="\n")
        w.writerow(["id", "name", "area_km2", "min_elev", "max_elev", "rgi_region"])
        w.writerows(rows)
    print(f"wrote {len(rows):,} glaciers to {OUT} ({os.path.getsize(OUT)/1e6:.1f} MB)", file=sys.stderr)


if __name__ == "__main__":
    main()
