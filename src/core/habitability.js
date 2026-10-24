/**
 * Planetary habitability, thermal equilibrium, atmosphere, and lunar binding checks.
 * All computations use standard SI units and 64-bit precision.
 */

import {
  AU,
  L_SUN,
  SIGMA_SB,
  M_SUN,
  M_EARTH,
  MU_EARTH,
  R_MOON_ORBIT,
} from './constants.js';

/**
 * Planetary equilibrium blackbody temperature (Benchmark 10).
 * Teq = [ (S * (1 - albedo)) / (4 * sigma) ]^(1/4)
 *
 * @param {Object} options
 * @param {number} options.rAU - Orbital distance from Sun in Astronomical Units (AU)
 * @param {number} [options.albedo=0.306] - Planetary Bond albedo (Earth default ~0.306)
 * @returns {number} Equilibrium temperature in Kelvin
 */
export function equilibriumTemp({ rAU, albedo = 0.306 }) {
  if (rAU <= 0) {
    throw new Error('Distance rAU must be positive');
  }
  const rMeters = rAU * AU;
  // Solar flux at distance r: S = L_sun / (4 * pi * r^2)
  const flux = L_SUN / (4.0 * Math.PI * rMeters * rMeters);

  // Radiative balance: absorbed solar flux = emitted thermal flux
  // S * pi * R^2 * (1 - albedo) = 4 * pi * R^2 * sigma * Teq^4
  // Teq = ( S * (1 - albedo) / (4 * sigma) )^(1/4)
  const Teq = Math.pow((flux * (1.0 - albedo)) / (4.0 * SIGMA_SB), 0.25);
  return Teq;
}

/**
 * Solar irradiance (flux) in W/m^2 at distance rAU.
 * @param {number} rAU - Distance from Sun in AU
 * @returns {number} Irradiance in W/m^2
 */
export function solarFlux(rAU) {
  const rMeters = rAU * AU;
  return L_SUN / (4.0 * Math.PI * rMeters * rMeters);
}

/**
 * Earth Hill sphere radius: R_H = r_sun * (M_earth / (3 * M_sun))^(1/3)
 * @param {number} rAU - Distance from Sun in AU
 * @returns {number} Hill radius in meters
 */
export function hillRadius(rAU) {
  const rMeters = rAU * AU;
  return rMeters * Math.cbrt(M_EARTH / (3.0 * M_SUN));
}

/**
 * Checks whether the Moon remains gravitationally bound to Earth.
 * Evaluates Earth-Moon specific orbital energy: eps = v_rel^2 / 2 - mu_earth / r_rel < 0
 * and verifies that separation does not exceed the Hill sphere radius.
 *
 * @param {Float64Array|Array<number>} rEarth - Earth position [x, y, z] in meters
 * @param {Float64Array|Array<number>} vEarth - Earth velocity [vx, vy, vz] in m/s
 * @param {Float64Array|Array<number>} rMoon - Moon position [x, y, z] in meters
 * @param {Float64Array|Array<number>} vMoon - Moon velocity [vx, vy, vz] in m/s
 * @param {number} sunDistanceAU - Distance from Sun in AU
 * @returns {{ bound: boolean, specificEnergy: number, separation: number, hillSphere: number, fractionOfHillRadius: number }}
 */
export function checkMoonBound(rEarth, vEarth, rMoon, vMoon, sunDistanceAU) {
  const dx = rMoon[0] - rEarth[0];
  const dy = rMoon[1] - rEarth[1];
  const dz = rMoon[2] - rEarth[2];
  const separation = Math.hypot(dx, dy, dz);

  const dvx = vMoon[0] - vEarth[0];
  const dvy = vMoon[1] - vEarth[1];
  const dvz = vMoon[2] - vEarth[2];
  const vRelSq = dvx * dvx + dvy * dvy + dvz * dvz;

  const specificEnergy = 0.5 * vRelSq - MU_EARTH / Math.max(1e3, separation);
  const rHill = hillRadius(sunDistanceAU);

  const bound = specificEnergy < 0 && separation < rHill && separation > 1.0e7;

  return {
    bound,
    specificEnergy,
    separation,
    hillSphere: rHill,
    fractionOfHillRadius: separation / rHill,
  };
}

/**
 * Comprehensive habitability assessment along the trajectory.
 * Checks solar flux, equilibrium temp, ocean freezing, atmospheric retention, and artificial heating requirement.
 *
 * @param {Object} params
 * @param {number} params.rAU - Current orbital radius in AU
 * @param {boolean} [params.artificialHeating=false] - Whether artificial solar mirrors / fusion radiators are deployed
 * @param {number} [params.heatingPowerWatts=0.0] - Injected heating power in Watts
 * @returns {Object} Habitability report with flags and warnings
 */
export function evaluateHabitability({ rAU, artificialHeating = false, heatingPowerWatts = 0.0 }) {
  const Teq = equilibriumTemp({ rAU, albedo: 0.306 });
  const flux = solarFlux(rAU);

  // Natural greenhouse effect adds ~33 K at 1 AU
  const greenhouseNatural = 33.0 * Math.sqrt(Math.max(0.1, flux / 1361.0));
  let surfaceTemp = Teq + greenhouseNatural;

  // Artificial heating boost: deltaT ~ (P_heat / (4 * pi * R_earth^2 * 4 * sigma * Teq^3))
  if (artificialHeating && heatingPowerWatts > 0) {
    const earthArea = 4.0 * Math.PI * Math.pow(6.371e6, 2);
    const addedFlux = heatingPowerWatts / earthArea;
    const effectiveTotalFlux = flux * (1.0 - 0.306) + addedFlux;
    surfaceTemp = Math.pow(effectiveTotalFlux / (4.0 * SIGMA_SB), 0.25) + 33.0;
  }

  const oceanFreezing = surfaceTemp < 273.15;
  const deepGlobalGlaciation = surfaceTemp < 250.0;
  const co2AtmosphereCollapse = surfaceTemp < 195.0; // CO2 condensation
  const n2AtmosphereCollapse = surfaceTemp < 77.0;   // Nitrogen liquefaction

  let status = 'HABITABLE_NOMINAL';
  const warnings = [];

  if (co2AtmosphereCollapse) {
    status = 'CATASTROPHIC_ATMOSPHERE_COLLAPSE';
    warnings.push('Surface temperature below 195 K: Carbon dioxide snows out; atmosphere collapses.');
  } else if (deepGlobalGlaciation) {
    status = 'EXTREME_SNOWBALL_EARTH';
    warnings.push('Global temperature plunges below 250 K: 100% ocean and land ice coverage.');
  } else if (oceanFreezing) {
    status = 'GLACIATED';
    warnings.push('Mean temperature dropped below 0°C (273.15 K): Ocean surfaces freezing.');
  }

  if (oceanFreezing && !artificialHeating) {
    warnings.push('Rulebook Notice: Moving beyond 1.2 AU without declared artificial heating freezes planetary biosphere.');
  }

  return {
    rAU,
    solarFluxWm2: flux,
    fluxDropPercent: ((1361.0 - flux) / 1361.0) * 100.0,
    equilibriumTempK: Teq,
    surfaceTempK: surfaceTemp,
    status,
    oceanFreezing,
    deepGlobalGlaciation,
    co2AtmosphereCollapse,
    warnings,
    needsArtificialHeating: rAU > 1.15,
  };
}
