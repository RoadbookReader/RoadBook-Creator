# Convertit les PNG bruts de man_shots_all.js (/tmp/man_fr, /tmp/man_en) en JPG (1100 px maxi, qualité 82) dans src/manuel/img/ et img/en/
import glob, os
from PIL import Image
base = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'src', 'manuel', 'img') + os.sep
for src, dst in (('/tmp/man_fr/', base), ('/tmp/man_en/', base + 'en' + os.sep)):
    os.makedirs(dst, exist_ok=True)
    for f in sorted(glob.glob(src + '*.png')):
        im = Image.open(f).convert('RGB')
        if im.width > 1100: im = im.resize((1100, round(im.height * 1100 / im.width)), Image.LANCZOS)
        im.save(dst + os.path.basename(f)[:-4] + '.jpg', quality=82, optimize=True)
    print(dst, len(glob.glob(dst + '*.jpg')), 'images')
