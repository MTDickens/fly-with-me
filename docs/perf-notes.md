# What a frame costs, and what is left

The page ran a laptop's fan hard. This is where the cost sits, what was taken
off it without touching the picture, and what the remaining ideas are worth,
so the next pass starts from measurements instead of guesses.

`CONTRIBUTING.md` says how to run the two tools. This file says what they found.

## How it was measured

`tools/bench.js` teleports the bird to five fixed vantages of one seed's world,
holds each still, and reads a window of frames there. Held vantages are the
whole point: cost follows what is in front of the bird, and the same build
measured twice on a free flight drifted by more than half its frame time, which
is larger than any win worth chasing. Draw calls and triangle counts repeating
across runs are the check that a vantage really is the same scene.

`tools/parity.js` answers the other half. It points the render pipeline at a
small target and reads back the finished eight-bit picture at those same
vantages, so tone mapping, bloom, the soft reconstruction and FXAA are all
inside the comparison, and it reports the difference in screen levels beside
its own noise floor from two reads of one build. A change is invisible when its
difference sits at that floor.

Everything below was taken on an Apple M5 with a ten-core GPU, in headed Chrome
on the WebGPU backend, seed 42, with `--disable-gpu-vsync
--disable-frame-rate-limit` whenever the question was what a frame costs rather
than what the display allows. Two window sizes appear: 1,996,800 drawing-buffer
pixels, which is exactly what the page's own budget produces on a retina
laptop, and 1,564,805, which several sweeps used. Numbers say which.

Three habits make the numbers repeatable on a machine that is not idle. Read
the fifth percentile of a window, because the cheapest frames are the ones the
rest of the machine left alone. Take the minimum across repeated rounds. And
interleave the two builds round by round, so thermal drift cannot be mistaken
for a win. This machine's load average ranged from 2.5 to 29 across the work;
without all three, run-to-run noise swamped every effect measured here.

Two traps are worth knowing. `renderer.info.render.timestamp` overstates: it
read 6.75 ms in the same window where the frame itself took 4.10 ms, so treat
it as a relative measure and never as a frame budget. And Three.js resolves
`samples || antialias === true ? 4 : 0`, so any truthy sample count becomes
four; two-sample multisampling is not selectable through that parameter.

## What was taken off, and what it gave

Three changes, all of which the picture cannot show.

The sky dome drew **first**, so its shader, which carries the bands, the sun,
the moon, a painted cloud layer, two star fields and the galaxy, ran on every
pixel of the frame, and the ground, the trees and the water then painted over
most of it. It writes no depth, so hidden-surface removal could not discard it
either. It now draws last among the opaque objects, with the dome moved out
past the far corner of the streamed terrain so nothing opaque is ever behind
it, and the depth test throws away every fragment the world already covers.

`antialias: true` multisampled the **canvas** as well as the scene. The only
thing ever drawn to the canvas is one full-screen quad, where all four samples
of a pixel take the same shaded value and the resolve averages copies of it:
four times the raster and a resolve, to produce exactly the same image. The
scene pass now asks for its own four samples, which is where the approved look
and the foliage's alpha-to-coverage need them.

The two intermediates after tone mapping held half floats. Everything past that
point is display-referred, in the eight bits a screen has, and the soft pass
reads its input nine times per pixel while FXAA reads its own more than that.
They are eight bits now, with the depth buffers neither ever used.

Measured against plain `main`, five vantages, vsync free, minimum of the fifth
percentile over four interleaved rounds, at 1,564,805 pixels:

| vantage | GPU ms before | after | change |
| --- | --- | --- | --- |
| dawn | 7.01 | 6.88 | -1.9% |
| noon | 6.95 | 6.75 | -2.8% |
| far | 5.50 | 5.57 | +1.2% |
| above the deck | 8.52 | 7.67 | -10.0% |
| night | 7.86 | 7.73 | -1.7% |
| **mean** | **7.17** | **6.92** | **-3.5%** |

A second four-round pass, taken while the display held the rate, agreed at
-2.3% on the mean with every vantage between -1.7% and -3.3%. Graphics memory
fell from 220 MB to 188 MB at 1,996,800 pixels, a sixth of it.

Parity put the difference from the previous build at 0.17 to 0.61 screen levels
of 255 on average, against a noise floor of 0.00 to 0.07 on the same vantages,
with the largest single-pixel difference between 10 and 62 on isolated edges.
Amplified twenty-four times the difference images are black apart from sparse
single-pixel sparkles where eight bits quantise a highlight. Checks stayed
green: 212 flight checks on WebGPU at seeds 42, 0 and 4294967295, on WebGL2,
and on the bundle; 24 night checks on both backends and the bundle; and
`tests/galaxy-checks.mjs`.

## Where the rest of the cost is

Measured at the noon vantage, 1,564,805 pixels, a frame costing 6.75 to 6.88 ms
of GPU time, by holding the world still and taking one thing away at a time.
Shares are of the whole frame.

| what | cost | share |
| --- | --- | --- |
| trees | 2.88 ms | 43% |
| the shadow map | 0.85 ms | 12% |
| the scene pass's four samples | 0.66 ms | 10% |
| the terrain | 0.33 ms | 5% |
| the sky, after the reorder above | 0.33 ms | 5% |
| the soft reconstruction | 0.26 ms | 4% |
| bloom, FXAA, the grass | about nothing | - |

Two of those deserve a sentence. At a sixteenth of the pixels the trees still
cost 1.64 ms, so **more than half of the tree cost is not fill**: it is vertex
work, instance submission and the shadow pass, and only the rest is the foliage
covering the screen. And hiding the water made the frame **0.52 ms slower**,
because water is a cheap opaque surface standing in front of expensive ones;
it is not a target, it is a saving.

## What is left, and what it would cost

Nothing here is landed. Each line says what it is worth, what it takes, and how
much of that is measured rather than reasoned.

1. **Cap the frame rate below the display refresh.** Worth 40% to 50% of the
   GPU and main-thread seconds spent per second of wall clock, which is far
   more than everything else here put together, and the only lever that would
   actually quiet a fan. **Perceptible**: it trades motion smoothness, which is
   the captain's call and nobody else's. The figure is arithmetic on measured
   numbers, not an A/B: a frame costs about 6 ms at the 2.0 M pixel budget and
   the page presents at the display refresh, so busy time is cost times rate
   and halving the rate halves the work. Not built. What is not known is the
   real power response, since clocks and voltage do not scale linearly with
   occupancy, and whether the loss of smoothness is acceptable at all.
2. **Drop the scene pass to zero samples.** Worth 10%, measured. **Perceptible**
   and not recommended: the foliage leans on alpha-to-coverage, and without
   multisampling every leaf edge becomes a hard alpha-test cut. Two samples is
   not available, for the Three.js reason noted above.
3. **Lower the two-million-pixel budget.** Worth about 25% at 1.5 M, since cost
   runs close to linear in pixels. **Perceptible** on a retina panel. Certain
   in size, and the cheapest of the perceptible options to try.
4. **Frustum-cull tree instances by spatial block.** Worth 5% to 10%, the
   off-screen share of the resolution-independent tree cost. Lossless in
   principle. The cost is the problem: keeping the fixed-allocation contract
   without dropping trees in a dense block means roughly four times the
   instance buffers, about 40 MB, and two to four times the tree draw calls.
   Medium uncertainty on the win, higher on whether the trade is worth it.
5. **Trim the shadow map's casters.** Worth up to 8%. **Not safely lossless by
   distance**, and this is the trap: the shadow frame is a 720 m box across the
   light but an open tube along it, from the near plane a kilometre up-light to
   the far plane beyond, so a tree well outside any sphere around the bird can
   still be the caster a low sun throws across the frame. A correct trim needs
   a lateral test in the light's own basis, re-evaluated as the sun moves, and
   dawn is the moment a mistake would show. The same warning is in `AGENTS.md`.
6. **Half-resolution bloom, and trimming the grass radius.** Both measured at
   about zero, because bloom and grass are already about nothing in this frame.
   Dropped.
