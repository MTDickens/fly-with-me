import * as THREE from 'three';
import { uniform, vec3, vec4, mix, dot, smoothstep } from 'three/tsl';
import { seasonWeights } from './cycles.js';

// Seasonal surface color is shared by near/far crowns and the streamed ground.
// Species follow annual climate; today's normal changes leaf colour and snow.
export function createSeasonAppearance() {
  const weights = [0, 0, 0, 0];
  const blend = uniform(new THREE.Vector3()); // spring, autumn, winter; summer is the original paint
  const snowAltitude = uniform(4000), dryness = uniform(0);
  const color = (hex) => vec3(new THREE.Color(hex));
  const spring = color(0xa6bf76), autumn = color(0xc08b53), winter = color(0xc5cbbd);
  const groundSpring = color(0x8ea567), groundAutumn = color(0xac936e);
  const shade = (rgb) => dot(rgb, vec3(0.2126, 0.7152, 0.0722)).mul(1.8).add(0.25);

  return {
    update(phase, climate, ecology) {
      seasonWeights(phase, weights);
      const seasonality = ecology?.seasonality ?? 1;
      const cold = climate ? Math.max(0, Math.min(1, (5 - climate.mean) / 12)) : weights[3];
      blend.value.set(weights[0] * seasonality, weights[2] * seasonality, cold);
      // The scene's local hills are offsets from the selected location. A
      // standard 6.5 °C/km lapse rate estimates the freezing level, not snow depth.
      snowAltitude.value = climate ? climate.mean / 0.0065 : 4000;
      dryness.value = climate ? Math.max(0, Math.min(1, (climate.evapotranspiration - climate.rain) / 5)) : 0;
    },
    ground(rgb, climateTemperature, moisture) {
      const temperate = smoothstep(0.9, 0.5, climateTemperature).mul(smoothstep(0.12, 0.4, moisture));
      const light = shade(rgb);
      return mix(
        mix(rgb, groundSpring.mul(light), blend.x.mul(temperate).mul(0.25)),
        groundAutumn.mul(light), blend.y.mul(temperate).mul(0.55).max(dryness.mul(0.12)),
      );
    },
    snowLine(original, climateTemperature) {
      return snowAltitude;
    },
    foliage(sample, kind = 'grass') {
      // Needles and tropical fronds stay green; temperate crowns turn gold.
      const evergreen = kind === 'needle' || kind === 'frond' || kind === 'acacia';
      const light = shade(sample.rgb);
      const fresh = kind === 'blossom' ? sample.rgb.mul(1.12) : spring.mul(light);
      const rgb = mix(sample.rgb, fresh, blend.x.mul(evergreen ? 0.08 : 0.3));
      const gold = mix(rgb, autumn.mul(light), blend.y.mul(evergreen ? 0.08 : 0.82).max(dryness.mul(kind === 'grass' ? 0.25 : 0.04)));
      const frost = mix(gold, winter.mul(light), blend.z.mul(kind === 'frond' || kind === 'acacia' ? 0.08 : 0.72));
      return vec4(frost, sample.a);
    },
  };
}
