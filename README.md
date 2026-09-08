<h1 align="center">Fly With Me</h1>

<p align="center">
  <a href="https://mtdickens.github.io/fly-with-me/"
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
  <a href="https://mtdickens.github.io/fly-with-me/"
    ><img
      alt="A bird gliding over sunlit oak hills at sunrise, an ocean coast and far mountains beyond"
      src="assets/hero.png"
      width="960"
  /></a>
</p>

<h3 align="center">Watch a bird fly across an infinite gorgeous world.</h3>

<p align="center"><a href="https://mtdickens.github.io/fly-with-me/">Open it and press Begin.</a></p>

## Using it

- The page opens on a white veil, then stands still behind one **Begin** button; nothing moves and no sound plays until you press it. Sound is synthesized in the browser, with an on/off switch and a volume slider that starts at half.
- Do nothing and the bird flies itself. Drag with the left button to orbit the bird, and the view stays where you leave it; drag with the right button to steer, up and down as well, and the bird flies where you look. The wheel zooms, touch steers, and the arrow keys nudge a turn or a climb that fades after a few seconds.
- **Pause**, or space with the canvas focused, stops the flight and the sound together. A reduced-motion preference starts the page paused.
- Open **world, time & seasons** to click a location on the world map. Drag to pan, use the wheel or pinch to zoom, or use the zoom buttons. You can also choose a city, adjust latitude/longitude sliders, or enter exact coordinates. The map is bundled locally and makes no map-service requests.
- Choose a local hour with the 24-hour slider or jump to **Sunrise**, **Solar noon**, **Sunset**, or **Midnight**. The date and location determine the sun's position and day length, including polar day/night. Choose the location's timezone or UTC; daylight-saving changes are handled by the browser's timezone database.
- The year slider blends continuously through **Spring**, **Summer**, **Autumn**, and **Winter**; buttons select a season and the date picker selects a calendar day. Southern-hemisphere seasons are reversed. Both sliders have their own speed controls and presets, from **Frozen** to **60×**. At **1×**, a civil day takes ten minutes and the seasonal year takes forty minutes. The two cycles repeat independently within the selected year. Seeking preserves speed; changing speed preserves the selected moment. Pause stops both, and paused adjustments preview the scene.
- Location changes temperature, rainfall, vegetation density and species suitability. Online, the page calculates daily normals from **1991–2020 ERA5** data via Open-Meteo; the readout includes daily average low/high temperatures and their interannual standard deviations. Vegetation is estimated from annual temperature, precipitation and reference evapotranspiration. Seasonal foliage and snow follow that climate. The terrain remains a procedural landscape, not a real-world elevation map.
- Beijing's real climate calendar is included. Up to eight loaded locations are cached for reuse offline; an uncached location uses a clearly labeled latitude-based estimate until climate data is available. New real climate downloads need a connection. The **Offline copy ready** message confirms the flight files have been cached for offline reload after the first online visit (HTTPS or localhost, when browser storage permits).
- The page remembers sound, framing, location, date, both cycle speeds, and the bird's place and course. The share link carries the seed and coordinates. `?seed=<number>&lat=<latitude>&lon=<longitude>` selects a reproducible landscape and geographic setting.
- WebGPU is used when available, over HTTPS or localhost; `?webgl=1` forces WebGL2, and the desktop corner names the backend.

[ChatGPT Site](https://fly-with-me-seasons.mtdickens1998.chatgpt.site) is another publication of this fork.

## Read on

- [`VISION.md`](VISION.md): what the page is for, the experience it is meant to create, and what it welcomes and refuses.
- [`CONTRIBUTING.md`](CONTRIBUTING.md): how to run, check and publish it, and how to add a biome, a tree, a ruin or anything else to the world.
- [`AGENTS.md`](AGENTS.md): the engine's rules, for agents and anyone changing `src/`.

## License

[MIT](LICENSE) © Kun Chen. Three.js is loaded from a CDN and carries its own license. Map and climate data have separate credits in [DATA-SOURCES.md](DATA-SOURCES.md).
