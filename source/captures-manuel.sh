#!/bin/sh
# Régénère toutes les captures des manuels (FR et EN) avec l'appli actuelle. Usage : sh captures-manuel.sh
# Demande : internet (IGN, OpenFreeMap), Playwright, Python + Pillow. Durée : environ 3 à 4 minutes.
set -e
cd "$(dirname "$0")"
node build.js
rm -rf /tmp/man_fr /tmp/man_en
node test/real/man_shots_all.js fr
node test/real/man_shots_all.js en
python3 test/real/man_shots_convert.py
echo "Terminé. Relire les images, puis : node build.js && python3 mktest.py"
