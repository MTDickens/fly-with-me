import * as THREE from 'three';
import { uniform, vec3, vec4, mix, dot, smoothstep } from 'three/tsl';
import { seasonWeights } from './cycles.js';

// Seasonal surface color is shared by near/far crowns and the streamed ground.
// It never changes the climate cells, geometry, placement RNG or sky palette.
export function createSeasonAppearance() {
  const weights = [0, 0, 0, 0];
  const blend = uniform(new THREE.Vector3()); // spring, autumn, winter; summer is the original paint
  const color = (hex) => vec3(new THREE.Color(hex));
  const spring = color(0xa6bf76), autumn = color(0xc08b53), winter = color(0xc5cbbd);
  const groundSpring = color(0x8ea567), groundAutumn = color(0xac936e);
  const shade = (rgb) => dot(rgb, vec3(0.2126, 0.7152, 0.0722)).mul(1.8).add(0.25);

  return {
    update(phase) {
      seasonWeights(phase, weights);
      blend.value.set(weights[0], weights[2], weights[3]);
    },
    ground(rgb, climateTemperature, moisture) {
      const temperate = smoothstep(0.9, 0.5, climateTemperature).mul(smoothstep(0.12, 0.4, moisture));
      const light = shade(rgb);
      return mix(
        mix(rgb, groundSpring.mul(light), blend.x.mul(temperate).mul(0.25)),
        groundAutumn.mul(light), blend.y.mul(temperate).mul(0.55),
      );
    },
    snowLine(original, climateTemperature) {
      return original.sub(blend.z.mul(smoothstep(0.85, 0.4, climateTemperature)).mul(360));
    },
    foliage(sample, kind = 'grass') {
      // Needles and tropical fronds stay green; temperate crowns turn gold.
      const evergreen = kind === 'needle' || kind === 'frond' || kind === 'acacia';
      const light = shade(sample.rgb);
      const fresh = kind === 'blossom' ? sample.rgb.mul(1.12) : spring.mul(light);
      const rgb = mix(sample.rgb, fresh, blend.x.mul(evergreen ? 0.08 : 0.3));
      const gold = mix(rgb, autumn.mul(light), blend.y.mul(evergreen ? 0.08 : 0.82));
      const frost = mix(gold, winter.mul(light), blend.z.mul(kind === 'frond' || kind === 'acacia' ? 0.08 : 0.72));
      return vec4(frost, sample.a);
    },
  };
}
