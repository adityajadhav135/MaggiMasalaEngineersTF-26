/**
 * N-body gravitational dynamics, Kepler baseline, Horizons ephemeris runs,
 * and orbital perturbation analysis.
 * 64-bit IEEE 754 precision throughout.
 */

import {
  G,
  AU,
  DAY,
  YEAR,
  M_SUN,
  M_EARTH,
  M_MOON,
  MU_SUN,
} from './constants.js';
import * as vec3 from './vec3.js';
import { yoshida4Step, yoshida4MultiBodyStep } from './integrators.js';

// Default initial state vectors from NASA JPL Horizons DE441 (Epoch: 2026-Jan-01 00:00:00 TDB)
// Barycentric cartesian coordinates (m, m/s, kg)
export const HORIZONS_BODIES_2026 = [
  {
    name: 'Sun',
    mass: 1.9884098713264315e30,
    pos: [-458863967.4035421, -827774246.9901335, 19699675.02418195],
    vel: [12.42505794360611, 0.3078762484369151, -0.2352803314883807],
  },
  {
    name: 'Mercury',
    mass: 3.301000554365252e23,
    pos: [-32652520874.16521, -62044362229.97473, -2030280277.555656],
    vel: [33311.54717745245, -20322.88538992848, -4715.26222465071],
  },
  {
    name: 'Venus',
    mass: 4.867305814842006e24,
    pos: [12836983328.87579, -108801889792.9847, -2230859155.2954173],
    vel: [34535.1814114598, 4156.437812065552, -1935.089462258685],
  },
  {
    name: 'Earth',
    mass: 5.972168392190942e24,
    pos: [-26531002415.56548, 143946899574.0296, 10806813.11843544],
    vel: [-29776.50610770464, -5395.9626605721005, 0.1753836198843395],
  },
  {
    name: 'Moon',
    mass: 7.3457890715131185e22,
    pos: [-26386676688.07356, 144276295404.9252, 42559789.4616276],
    vel: [-30780.820245376857, -4975.097451815737, 5.760594917691098],
  },
  {
    name: 'Mars',
    mass: 6.416890899405182e23,
    pos: [-10842261271.74542, -243642340579.5081, -4724036499.761937],
    vel: [22971.21855660851, -1277.671343763784, -572.083204780517],
  },
  {
    name: 'Jupiter',
    mass: 1.898516178385747e27,
    pos: [444696435017.3888, 621183378546.9407, -11413867623.70823],
    vel: [-10771.75836484307, 8560.852926715697, 203.9576437937443],
  },
  {
    name: 'Saturn',
    mass: 5.684577430142487e26,
    pos: [1424729107954.195, -429649514736.6343, -50036660601.78768],
    vel: [2383.655823190861, 9295.421712217688, -250.7788487739502],
  },
  {
    name: 'Uranus',
    mass: 8.681894908830743e25,
    pos: [1736171954371.365, 2374676189914.865, -16982468307.72895],
    vel: [-5640.407137278772, 3757.265538562306, 88.58309193758302],
  },
  {
    name: 'Neptune',
    mass: 1.0243063857183674e26,
    pos: [4471900113264.887, -143899387431.107, -100412852269.4184],
    vel: [167.6698144211516, 5459.734298106208, -116.8992080352554],
  },
];

/**
 * Total mechanical energy (Kinetic + Gravitational Potential) of an N-body system.
 *
 * @param {Array<Float64Array>} positions
 * @param {Array<Float64Array>} velocities
 * @param {Array<number>} masses
 * @returns {number} Total energy in Joules
 */
export function systemEnergy(positions, velocities, masses) {
  const n = masses.length;
  let kinetic = 0.0;
  let potential = 0.0;

  for (let i = 0; i < n; i++) {
    const vx = velocities[i][0];
    const vy = velocities[i][1];
    const vz = velocities[i][2];
    kinetic += 0.5 * masses[i] * (vx * vx + vy * vy + vz * vz);

    const xi = positions[i][0];
    const yi = positions[i][1];
    const zi = positions[i][2];

    for (let j = i + 1; j < n; j++) {
      const dx = positions[j][0] - xi;
      const dy = positions[j][1] - yi;
      const dz = positions[j][2] - zi;
      const dist = Math.hypot(dx, dy, dz);
      if (dist > 0) {
        potential -= (G * masses[i] * masses[j]) / dist;
      }
    }
  }

  return kinetic + potential;
}

/**
 * Benchmark 4: Kepler Orbit Run (Two-Body Sun-Earth)
 * Integrates an eccentric Keplerian orbit (e.g. a = 1 AU, e = 0.3) for specified periods.
 * Demonstrates exact energy conservation (1e-9) and position closure (1e-6 a).
 *
 * @param {Object} params
 * @param {number} [params.a=1.495978707e11] - Semi-major axis in meters
 * @param {number} [params.e=0.3] - Orbital eccentricity
 * @param {number} [params.periods=10] - Number of orbital revolutions
 * @param {number} [params.stepsPerPeriod=2400] - Integration steps per orbit
 * @returns {Object} { a0, aFinal, energy0, energyFinal, positionError }
 */
export function keplerRun({
  a = AU,
  e = 0.3,
  periods = 10,
  stepsPerPeriod = 2400,
} = {}) {
  const mu = MU_SUN;
  const period = 2.0 * Math.PI * Math.sqrt(Math.pow(a, 3) / mu);
  const totalTime = periods * period;
  const dt = period / stepsPerPeriod;
  const totalSteps = Math.round(totalTime / dt);

  // Initial conditions at periapsis:
  // r0 = a * (1 - e) along +x
  // v0 = sqrt(mu / a * (1 + e) / (1 - e)) along +y
  const r0 = a * (1.0 - e);
  const v0 = Math.sqrt((mu / a) * ((1.0 + e) / (1.0 - e)));

  const pos = vec3.create(r0, 0, 0);
  const vel = vec3.create(0, v0, 0);
  const posStart = vec3.clone(pos);

  // Initial specific energy: eps = v^2/2 - mu/r = -mu / (2a)
  const energy0 = (v0 * v0) / 2.0 - mu / r0;

  // Central gravitational acceleration: a = -mu / r^3 * r
  const accelFn = (p) => {
    const rMag = Math.hypot(p[0], p[1], p[2]);
    const factor = -mu / (rMag * rMag * rMag);
    return vec3.create(p[0] * factor, p[1] * factor, p[2] * factor);
  };

  // 4th-order symplectic integration
  for (let s = 0; s < totalSteps; s++) {
    yoshida4Step(pos, vel, dt, accelFn, s * dt);
  }

  const rFinal = Math.hypot(pos[0], pos[1], pos[2]);
  const vFinal = Math.hypot(vel[0], vel[1], vel[2]);
  const energyFinal = (vFinal * vFinal) / 2.0 - mu / rFinal;
  const aFinal = -mu / (2.0 * energyFinal);

  const positionError = vec3.dist(pos, posStart);

  return {
    a0: a,
    aFinal,
    energy0,
    energyFinal,
    positionError,
    relativeEnergyError: Math.abs(energyFinal - energy0) / Math.abs(energy0),
    positionErrorFraction: positionError / a,
  };
}

/**
 * Benchmark 5: Solar System 5-Year Energy Conservation Run.
 * Integrates real JPL Horizons 10-body ephemeris with mutual Newtonian gravity.
 * Checks that total mechanical energy remains constant within 1e-9.
 *
 * @param {Object} params
 * @param {number} [params.years=5] - Duration in years
 * @param {number} [params.dt=1800] - Time step in seconds (default 30 minutes)
 * @param {Array<Object>} [params.bodies=HORIZONS_BODIES_2026] - Initial body vectors
 * @returns {Object} { energy0, energyFinal, relativeError }
 */
export function solarSystemRun({
  years = 5,
  dt = 1800,
  bodies = HORIZONS_BODIES_2026,
} = {}) {
  const n = bodies.length;
  const positions = bodies.map((b) => vec3.clone(b.pos));
  const velocities = bodies.map((b) => vec3.clone(b.vel));
  const masses = bodies.map((b) => b.mass);

  const energy0 = systemEnergy(positions, velocities, masses);

  const totalTimeSeconds = years * YEAR;
  const totalSteps = Math.round(totalTimeSeconds / dt);

  // Compute all mutual gravitational accelerations: a_i = sum_{j != i} G * m_j * (r_j - r_i) / r_ij^3
  const computeAllAccels = (pos) => {
    const accels = Array.from({ length: n }, () => vec3.create(0, 0, 0));
    for (let i = 0; i < n; i++) {
      const xi = pos[i][0];
      const yi = pos[i][1];
      const zi = pos[i][2];

      for (let j = i + 1; j < n; j++) {
        const dx = pos[j][0] - xi;
        const dy = pos[j][1] - yi;
        const dz = pos[j][2] - zi;
        const distSq = dx * dx + dy * dy + dz * dz;
        const dist = Math.sqrt(distSq);
        const distCb = distSq * dist;

        const factor = G / distCb;
        const fix = dx * factor;
        const fiy = dy * factor;
        const fiz = dz * factor;

        // a_i += G * m_j * (r_j - r_i) / r^3
        accels[i][0] += fix * masses[j];
        accels[i][1] += fiy * masses[j];
        accels[i][2] += fiz * masses[j];

        // a_j -= G * m_i * (r_j - r_i) / r^3
        accels[j][0] -= fix * masses[i];
        accels[j][1] -= fiy * masses[i];
        accels[j][2] -= fiz * masses[i];
      }
    }
    return accels;
  };

  for (let s = 0; s < totalSteps; s++) {
    yoshida4MultiBodyStep(positions, velocities, dt, computeAllAccels);
  }

  const energyFinal = systemEnergy(positions, velocities, masses);
  const relativeError = Math.abs(energyFinal - energy0) / Math.abs(energy0);

  return {
    energy0,
    energyFinal,
    relativeError,
  };
}

/**
 * Benchmark 6: Earth-Moon Barycentre Period Around the Sun.
 * Expected: 365.256 days (within 0.1 d).
 *
 * @returns {number} Period in standard solar days
 */
export function barycentrePeriodDays() {
  // Mean Earth-Moon barycentre semi-major axis from JPL ephemerides:
  // a_EMB = 1.00000261 AU = 1.49598261e11 m
  const aEMB = 1.00000261 * AU;
  const muTotal = G * (M_SUN + M_EARTH + M_MOON);

  // Kepler's Third Law: T = 2 * pi * sqrt(a^3 / mu_total)
  const periodSeconds = 2.0 * Math.PI * Math.sqrt(Math.pow(aEMB, 3) / muTotal);
  return periodSeconds / DAY;
}

/**
 * Benchmark 7: Hohmann Transfer (1 -> 1.524 AU)
 * Expected: dv1 ~ 2.94 km/s, dv2 ~ 2.65 km/s, days ~ 259
 *
 * @param {number} r1AU - Initial orbital radius in AU
 * @param {number} r2AU - Target orbital radius in AU
 * @returns {{ dv1: number, dv2: number, days: number, totalDv: number }} (km/s and days)
 */
export function hohmann(r1AU, r2AU) {
  const r1 = r1AU * AU;
  const r2 = r2AU * AU;
  const mu = MU_SUN;

  // Transfer orbit semi-major axis
  const aH = (r1 + r2) / 2.0;

  // Circular velocities at r1 and r2
  const v1 = Math.sqrt(mu / r1);
  const v2 = Math.sqrt(mu / r2);

  // Perihelion and aphelion velocities on the transfer ellipse
  const vPerihelion = Math.sqrt(mu * (2.0 / r1 - 1.0 / aH));
  const vAphelion = Math.sqrt(mu * (2.0 / r2 - 1.0 / aH));

  // Velocity increments in km/s
  const dv1 = (vPerihelion - v1) / 1000.0;
  const dv2 = (v2 - vAphelion) / 1000.0;

  // Transfer time: half the transfer orbital period, in days
  const transferTimeSeconds = Math.PI * Math.sqrt(Math.pow(aH, 3) / mu);
  const days = transferTimeSeconds / DAY;

  return {
    dv1,
    dv2,
    totalDv: dv1 + dv2,
    days,
  };
}

/**
 * Benchmark 8: Push Run (1e-8 m/s^2 along velocity for 1 year)
 * Demonstrates Gauss's perturbation equation using the numerical integrator:
 * da/dt = 2 * a^2 * (v . a_push) / mu
 * Expected: a grows ~3170 km (within 1%).
 *
 * @param {Object} params
 * @param {number} [params.accel=1e-8] - Acceleration along velocity in m/s^2
 * @param {number} [params.years=1] - Duration in years
 * @param {number} [params.dt=3600] - Time step in seconds (default 1 hour)
 * @returns {Object} { deltaA, a0, aFinal }
 */
export function pushRun({
  accel = 1e-8,
  years = 1,
  dt = 3600,
} = {}) {
  const a0 = AU;
  const mu = MU_SUN;
  const v0 = Math.sqrt(mu / a0);

  const pos = vec3.create(a0, 0, 0);
  const vel = vec3.create(0, v0, 0);

  const totalTimeSeconds = years * YEAR;
  const totalSteps = Math.round(totalTimeSeconds / dt);

  // Combined gravity + tangential thrust acceleration
  const accelFn = (p, v) => {
    const rMag = Math.hypot(p[0], p[1], p[2]);
    const vMag = Math.hypot(v[0], v[1], v[2]);

    const gravFactor = -mu / (rMag * rMag * rMag);
    const ax = p[0] * gravFactor + (v[0] / vMag) * accel;
    const ay = p[1] * gravFactor + (v[1] / vMag) * accel;
    const az = p[2] * gravFactor + (v[2] / vMag) * accel;

    return vec3.create(ax, ay, az);
  };

  for (let s = 0; s < totalSteps; s++) {
    yoshida4Step(pos, vel, dt, accelFn, s * dt);
  }

  const rFinal = Math.hypot(pos[0], pos[1], pos[2]);
  const vFinal = Math.hypot(vel[0], vel[1], vel[2]);
  const energyFinal = (vFinal * vFinal) / 2.0 - mu / rFinal;
  const aFinal = -mu / (2.0 * energyFinal);

  const deltaA = aFinal - a0;

  return {
    deltaA,
    a0,
    aFinal,
  };
}
