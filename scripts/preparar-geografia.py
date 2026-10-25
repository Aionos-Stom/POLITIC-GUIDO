#!/usr/bin/env python3
"""Descarga y verifica la geografía pública; no accede a datos de GUIDO."""

import hashlib
import json
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
URL = "https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/main/releaseData/gbOpen/DOM/ADM1/geoBoundaries-DOM-ADM1_simplified.geojson"
EXPECTED = "4a6403df6b0380bdcc1d0213d335426f8833d93f40e01b509b6806800c2f0e15"
TARGET = ROOT / "assets/data/provincias.json"
# La fuente utiliza tres nombres históricos o abreviados; conservar su trazabilidad.
NAMES = {"La Estrelleta": "Elías Piña", "El Seybo": "El Seibo", "Hermanas": "Hermanas Mirabal"}


def canonical_names(provinces):
    for province in provinces:
        original = province.get("source_name", province["name"])
        if original in NAMES:
            province["source_name"] = original
            province["name"] = NAMES[original]


def center(ring):
    area = longitude = latitude = 0.0
    for first, second in zip(ring, ring[1:] + ring[:1]):
        cross = first[0] * second[1] - second[0] * first[1]
        area += cross
        longitude += (first[0] + second[0]) * cross
        latitude += (first[1] + second[1]) * cross
    if abs(area) < 1e-10:
        return [sum(p[0] for p in ring) / len(ring), sum(p[1] for p in ring) / len(ring)]
    return [longitude / (3 * area), latitude / (3 * area)]


def main():
    if TARGET.exists():
        data = json.loads(TARGET.read_text())
        if len(data.get("provinces", [])) == 32 and data.get("source_sha256") == EXPECTED:
            canonical_names(data["provinces"])
            TARGET.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")))
            print("Geografía pública: 32 provincias disponibles.")
            return
    with urlopen(Request(URL, headers={"User-Agent": "GUIDO-local-setup"}), timeout=30) as response:
        content = response.read(2_000_000)
    if hashlib.sha256(content).hexdigest() != EXPECTED:
        raise SystemExit("La geografía publicada cambió. Revisar la fuente antes de reemplazarla.")
    geo = json.loads(content)
    provinces = []
    for feature in geo["features"]:
        geometry = feature["geometry"]
        polygons = geometry["coordinates"] if geometry["type"] == "MultiPolygon" else [geometry["coordinates"]]
        ring = max((polygon[0] for polygon in polygons), key=len)
        longitude, latitude = center(ring)
        provinces.append({"name": feature["properties"]["shapeName"], "latitude": round(latitude, 6), "longitude": round(longitude, 6), "outline": [[round(x, 5), round(y, 5)] for x, y, *_ in ring]})
    if len(provinces) != 32:
        raise SystemExit("La fuente no contiene las 32 provincias esperadas.")
    canonical_names(provinces)
    TARGET.parent.mkdir(parents=True, exist_ok=True)
    TARGET.write_text(json.dumps({"source": "geoBoundaries gbOpen DOM ADM1 / Natural Earth", "license": "Public Domain", "source_sha256": EXPECTED, "provinces": provinces}, ensure_ascii=False, separators=(",", ":")))
    print("Geografía pública preparada: 32 provincias; ubicaciones aproximadas por provincia.")


if __name__ == "__main__":
    main()
