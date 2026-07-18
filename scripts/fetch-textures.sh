#!/usr/bin/env bash
# Fetch Earth textures for the GOD-EYE globe engine.
# Sources: NASA Visible Earth / Blue Marble (public domain).
set -euo pipefail

DIR="$(cd "$(dirname "$0")/../web/public/textures" && pwd)"
echo "[fetch-textures] Downloading to $DIR ..."

# Earth day topographic (8k) — NASA Blue Marble
curl -L --progress-bar -o "$DIR/earth-topo-bathy.jpg" \
  "https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73909/world.topo.bathy.200412.3x5400x2700.jpg"

# Earth night lights (8k)
curl -L --progress-bar -o "$DIR/earth-night.jpg" \
  "https://eoimages.gsfc.nasa.gov/images/imagerecords/144000/144898/BlackMarble_2016_3km.jpg"

# Water mask (for specular)
curl -L --progress-bar -o "$DIR/earth-water.png" \
  "https://unpkg.com/globe.gl@2/example/img/earth-water.png"

# Night sky / starfield
curl -L --progress-bar -o "$DIR/night-sky.png" \
  "https://unpkg.com/globe.gl@2/example/img/night-sky.png"

echo "[fetch-textures] Done. Files:"
ls -lh "$DIR"
