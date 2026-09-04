# Source artwork

Original, full-resolution Deneuve illustrations. These are the masters — they
are **not** served to the browser.

`tools/build-assets.py` derives everything under `public/assets/img/` from
these files (cut-outs are de-matted, trimmed, resized, quantised and exported
as PNG and WebP). Re-run it after replacing any file here:

```sh
python3 -m pip install Pillow
python3 tools/build-assets.py
```

| File | Notes |
| --- | --- |
| `deneuve_logo.png` | The monogram on its original paper scan. Source of the page's grain and colour. |
| `deneuve_logocut.png` | The monogram cut out on transparency. Source of the site mark, icons and favicons. |
| `deneuve_girl.png` | The seamstress illustration. |
| `deneuve_girlcut.PNG` | The seamstress cut out on transparency. Source of the hero and atelier art. |
