# ORBIVUE Local Archive Data

Place demo satellite imagery here for local archive ingestion.

Supported files:

- GeoTIFF / TIFF / readable COG (`.tif`, `.tiff`)
- PNG (`.png`)
- JPEG (`.jpg`, `.jpeg`)

Optional sidecar metadata can be stored next to an image with the same stem and a `.json` extension, for example `scene.tif` and `scene.json`.

Supported sidecar fields:

- `scene_id`
- `acquisition_datetime`
- `sensor`
- `source`
- `product_type`
- `cloud_cover`

Runtime imagery and SQLite databases under `backend/runtime/` are ignored by git.
