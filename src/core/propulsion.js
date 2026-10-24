/**
 * Propulsion concepts module.
 * Evaluates forces, books reactions into the ledger, and accounts for power & partners.
 *
 * Hard Rule 1: Every force is booked with its reaction partner.
 * Internal reactions move nothing.
 */

import * as vec3 from './vec3.js';
import { lorentzSegment } from './em.js';
import { SPEED_OF_LIGHT } from './constants.js';

export const PROPULSION_CONCEPTS = {
  OCTO_INTERNAL: 'octo_earth_internal',
  OCTO_SOLAR_WIND: 'octo_earth_solar_wind',
  CONTINUOUS_TANGENTIAL: 'continuous_tangential',
  SOLAR_SAIL_MIRRORS: 'solar_sail_mirrors',
};

/**
 * Evaluates propulsion forces and books them into the provided ledger.
 *
 * @param {Object} params
 * @param {string} params.concept - Propulsion concept key
 * @param {Float64Array|Array<number>} params.r - Earth position [x, y, z] in meters
 * @param {Float64Array|Array<number>} params.v - Earth velocity [vx, vy, vz] in m/s
 * @param {number} params.mass - System mass (Earth + Moon) in kg
 * @param {number} params.dt - Time step in seconds
 * @param {Object} params.ledger - PhysicsLedger instance
 * @param {Object} [params.options] - Concept-specific parameters
 * @returns {{ thrustVector: Float64Array, powerWatts: number, effectiveThrustNewtons: number }}
 */
export function evaluatePropulsion({
  concept,
  r,
  v,
  mass,
  dt,
  ledger,
  options = {},
}) {
  const thrustVector = vec3.create(0, 0, 0);
  let powerWatts = 0.0;
  let effectiveThrustNewtons = 0.0;

  const vNorm = vec3.norm(v);
  const vUnit = vec3.create();
  if (vNorm > 0) {
    vec3.normalize(vUnit, v);
  } else {
    vUnit[1] = 1.0;
  }

  switch (concept) {
    case PROPULSION_CONCEPTS.OCTO_INTERNAL: {
      // Octo-Earth canonical: 8 articulated arms spaced at 45 degrees, internal current closure.
      // Symmetrical arms cancel each other out in uniform fields.
      // Crucially, reaction force lands on Earth's liquid core / ionosphere.
      const current = options.currentAmps || 1.0e6; // 1 MA
      const armLength = options.armLengthMeters || 12.0e6; // 12,000 km
      const bField = options.bField || [0, 5.0e-9, 0]; // 5 nT IMF

      // 8 arms spaced at 45° intervals: angles 0, 45, 90, 135, 180, 225, 270, 315 deg
      for (let i = 0; i < 8; i++) {
        const theta = (i * Math.PI) / 4.0;
        const armDir = vec3.create(Math.cos(theta) * armLength, Math.sin(theta) * armLength, 0);
        const armForce = lorentzSegment(current, armDir, bField);

        // Book individual arm force: reaction is inside the Earth system!
        ledger.book({
          name: `octo_arm_${i}_internal`,
          onBody: 'earth_ring',
          force: armForce,
          dt,
          partner: 'earth_ionosphere_and_core',
          partnerInEarthSystem: true, // INTERNAL!
          power: options.armPowerPerArmWatts || 1.0e9,
          wasteHeat: (options.armPowerPerArmWatts || 1.0e9) * dt,
        });

        // Add to internal force accumulation (which symmetrically sums to zero anyway)
        vec3.add(thrustVector, thrustVector, armForce);
      }

      // Net external thrust is IDENTICALLY ZERO because reaction lands on Earth!
      // In accordance with Hard Rule 1: "A force whose reaction lands on Earth moves nothing."
      vec3.zero(thrustVector);
      effectiveThrustNewtons = 0.0;
      powerWatts = (options.armPowerPerArmWatts || 1.0e9) * 8;
      break;
    }

    case PROPULSION_CONCEPTS.OCTO_SOLAR_WIND: {
      // Octo-Earth with solar wind plasma circuit closure beyond magnetopause
      const targetForce = options.forceNewtons || 2.23e17; // Nominal ~2.2e17 N for 10,000 yr spiral
      vec3.scale(thrustVector, vUnit, targetForce);

      // Reaction partner is external solar wind ions carried away into deep space
      powerWatts = options.powerWatts || 5.35e21; // ~5.4 ZW
      const wasteHeat = powerWatts * 0.15 * dt; // 15% thermal dissipation

      ledger.book({
        name: 'octo_solar_wind_plasma_thrust',
        onBody: 'earth',
        force: thrustVector,
        dt,
        partner: 'solar_wind_ions',
        partnerInEarthSystem: false, // EXTERNAL!
        power: powerWatts,
        wasteHeat,
      });

      effectiveThrustNewtons = targetForce;
      break;
    }

    case PROPULSION_CONCEPTS.CONTINUOUS_TANGENTIAL: {
      // Canonical low-thrust benchmark (e.g. Benchmark 8: 1e-8 m/s^2 along v)
      const accel = options.accelMps2 || 1.0e-8;
      const targetForce = mass * accel;
      vec3.scale(thrustVector, vUnit, targetForce);

      // Power = F * v
      powerWatts = targetForce * vNorm;

      ledger.book({
        name: 'collimated_exhaust_reaction_thrust',
        onBody: 'earth',
        force: thrustVector,
        dt,
        partner: 'ultra_relativistic_ejecta',
        partnerInEarthSystem: false, // EXTERNAL!
        power: powerWatts,
        wasteHeat: powerWatts * 0.05 * dt,
      });

      effectiveThrustNewtons = targetForce;
      break;
    }

    case PROPULSION_CONCEPTS.SOLAR_SAIL_MIRRORS: {
      // Solar radiation pressure array / giant concentrator mirrors
      const sailAreaM2 = options.sailAreaM2 || 1.0e14; // Massive space array
      const rMeters = vec3.norm(r);
      // Radiation pressure: P_rad = S / c
      const flux = 3.828e26 / (4.0 * Math.PI * rMeters * rMeters);
      const radPressure = (2.0 * flux) / SPEED_OF_LIGHT; // Ideal reflection factor 2
      const targetForce = radPressure * sailAreaM2;

      // Force pushed along radial and tangential components
      vec3.scale(thrustVector, vUnit, targetForce);

      ledger.book({
        name: 'photon_reflection_pressure',
        onBody: 'earth',
        force: thrustVector,
        dt,
        partner: 'reflected_photons',
        partnerInEarthSystem: false, // EXTERNAL!
        power: 0.0, // Solar driven
        wasteHeat: 0.0,
      });

      effectiveThrustNewtons = targetForce;
      break;
    }

    default:
      vec3.zero(thrustVector);
  }

  return {
    thrustVector,
    powerWatts,
    effectiveThrustNewtons,
  };
}
