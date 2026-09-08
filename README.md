<h1 align="center">Fly With Me</h1>

<p align="center">
  <a href="https://kunchenguid.github.io/fly-with-me/"
    ><img
      alt="Live"
      src="https://img.shields.io/badge/live-fly-blue?style=flat-square"
  /></a>
  <a href="LICENSE"
    ><img
      alt="License"
      src="https://img.shields.io/badge/license-MIT-green?style=flat-square"
  /></a>
  <a href="https://x.com/kunchenguid"
    ><img
      alt="X"
      src="https://img.shields.io/badge/X-@kunchenguid-black?style=flat-square"
  /></a>
  <a href="https://discord.gg/Wsy2NpnZDu"
    ><img
      alt="Discord"
      src="https://img.shields.io/discord/1439901831038763092?style=flat-square&label=discord"
  /></a>
</p>

<p align="center">
  <a href="https://kunchenguid.github.io/fly-with-me/"
    ><img
      alt="A bird gliding over sunlit oak hills at sunrise, an ocean coast and far mountains beyond"
      src="assets/hero.png"
      width="960"
  /></a>
</p>

<h3 align="center">Watch a bird fly across an infinite goegeous world.</h3>

<p align="center"><a href="https://kunchenguid.github.io/fly-with-me/">Open it and press Begin.</a></p>

## Using it

- The page opens on a white veil, then stands still behind one **Begin** button; nothing moves and no sound plays until you press it. Sound is synthesized in the browser, with an on/off switch and a volume slider that starts at half.
- Do nothing and the bird flies itself. Drag with the left button to orbit the bird, and the view stays where you leave it; drag with the right button to steer, up and down as well, and the bird flies where you look. The wheel zooms, touch steers, and the arrow keys nudge a turn or a climb that fades after a few seconds.
- **Pause**, or space with the canvas focused, stops the flight and the sound together. A reduced-motion preference starts the page paused.
- Open **time & seasons** in the corner to choose an hour with the 24-hour slider or jump to **Dawn**, **Day**, **Dusk**, or **Night**. The year slider blends continuously through **Spring**, **Summer**, **Autumn**, and **Winter**; the four buttons jump straight to a season. Seasonal foliage, grass and snow cover change together.
- Each cycle has its own speed slider and presets, from **Frozen** to **60×**. At **1×**, a day takes ten minutes (with a shorter night) and a full seasonal year takes forty minutes. Choosing a moment keeps its speed, and changing speed continues from that moment. Manual day controls release the opening's special sunrise timing. You can adjust either cycle while the flight is paused to preview a still scene.
- The page remembers your sound settings, framing, both cycle speeds, and the bird's exact place, course, time of day and season, and resumes there after Begin. `?seed=<number>` in the address selects that world; the share link carries the seed.
- WebGPU is used when available, over HTTPS or localhost; `?webgl=1` forces WebGL2, and the desktop corner names the backend.

## Read on

- [`VISION.md`](VISION.md): what the page is for, the experience it is meant to create, and what it welcomes and refuses.
- [`CONTRIBUTING.md`](CONTRIBUTING.md): how to run, check and publish it, and how to add a biome, a tree, a ruin or anything else to the world.
- [`AGENTS.md`](AGENTS.md): the engine's rules, for agents and anyone changing `src/`.

## License

[MIT](LICENSE) © Kun Chen. Three.js is loaded from a CDN and carries its own license.
