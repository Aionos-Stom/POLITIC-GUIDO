# Geografía pública

`mundo.json` contiene contornos de tierra derivados de Natural Earth, escala 1:110m. Se simplifica la precisión decimal para su representación en el globo.

- Fuente: [Natural Earth vector](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_land.geojson).
- Licencia: [dominio público](https://github.com/nvkelso/natural-earth-vector/blob/master/LICENSE.md).

`provincias.json` se prepara a partir de geoBoundaries gbOpen DOM ADM1, con fuente Natural Earth y licencia de dominio público según sus metadatos. Su SHA-256 se comprueba antes de generar los centroides.

- Fuente y licencia: [metadatos DOM ADM1](https://www.geoboundaries.org/api/current/gbOpen/DOM/ADM1/).
- Preparación: `python3 scripts/preparar-geografia.py`.

Los centroides provinciales son aproximaciones. Las coordenadas de sectores deben proceder del catálogo territorial revisado. Estos archivos no contienen simpatizantes, cantidades ni datos privados.

Se normalizan tres rótulos de la fuente sin modificar sus coordenadas: La Estrelleta → Elías Piña, El Seybo → El Seibo y Hermanas → Hermanas Mirabal. El nombre recibido se conserva en `source_name`. Los nombres actuales se contrastan con la [división territorial de la ONE](https://www.one.gob.do/media/f3sligov/cartograf%C3%ADadivisi%C3%B3nterritorial2015.pdf) y el [catálogo provincial de la ONE](https://anda.one.gob.do/index.php/catalog/95/datafile/F1/V2).
