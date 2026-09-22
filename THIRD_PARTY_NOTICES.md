# Third-party notices

## zxing-wasm 3.1.4

The QR module uses [zxing-wasm](https://github.com/Sec-ant/zxing-wasm) locally in the browser.

- `zxing-wasm` code is licensed under the MIT License.
- ZXing-C++ and its WebAssembly bridge are licensed under the Apache License 2.0.
- Zint code used for barcode writing is licensed under the BSD 3-Clause License.

See the dependency's included license information in `node_modules/zxing-wasm` and its upstream repository for the full license texts.

## @cf-wasm/resvg 0.4.0

The Life module uses [@cf-wasm/resvg](https://github.com/fineshopdesign/cf-wasm) and its resvg WebAssembly runtime to convert original 6.am SVG artwork into PNG wallpapers inside Cloudflare Workers.

- `@cf-wasm/resvg` and the bundled resvg-wasm code are licensed under the Mozilla Public License 2.0.
- The dependency is used unmodified through its published `workerd` entry point.

See the dependency's included license files and upstream repository for the complete license text.

## Moodist ambient sounds

The Time → Sounds catalog includes 30 audio files from [Moodist](https://github.com/remvze/moodist).

- Moodist identifies its third-party sound collection as licensed under either the Creative Commons CC0 1.0 dedication or the Pixabay Content License.
- The audio files are redistributed only as part of the 6.am soundscape feature; original upstream paths are recorded in `src/scripts/sound-catalog.js`.
- Moodist application code is MIT-licensed but is not copied into 6.am.

See [Moodist's third-party asset notice](https://github.com/remvze/moodist#third-party-assets), the [CC0 1.0 deed](https://creativecommons.org/publicdomain/zero/1.0/), and the [Pixabay Content License summary](https://pixabay.com/service/license-summary/) for the terms.

## Heartbeat sound

`public/sounds/ambient/heartbeat.flac` is the [Heartbeat (single sound)](https://opengameart.org/content/heartbeat-single-sound) recording submitted by qubodup / Independent.nu and released under CC0 1.0.

## Open Lo-Fi

The eight files in `public/sounds/lofi` are the Chillhop & Cozy Beats set from [Open Lo-Fi](https://github.com/btahir/open-lofi), created by Bilal Tahir and released under the [CC0 1.0 Universal dedication](https://creativecommons.org/publicdomain/zero/1.0/). Attribution is not required by the license and is included here for provenance.

## YouTube live radio

The optional external radio embeds the official Lofi Girl live stream through the YouTube privacy-enhanced IFrame API. No YouTube media is bundled with or redistributed by 6.am. Availability and playback remain subject to YouTube and the channel owner.
