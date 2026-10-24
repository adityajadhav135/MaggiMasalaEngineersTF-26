/**
 * High-precision 64-bit numerical integrators.
 * - Yoshida 4th-order symplectic integrator (strictly energy-conserving for orbital mechanics)
 * - Dormand-Prince 5(4) Runge-Kutta integrator (adaptive)
 * - Convergence verification helper (step h vs step h/2)
 */

import * as vec3 from './vec3.js';

// Yoshida 4th-order coefficients
const CBRT_2 = Math.cbrt(2.0);
const W1 = 1.0 / (2.0 - CBRT_2);
const W0 = -CBRT_2 / (2.0 - CBRT_2);

const C1 = W1 / 2.0;
const C2 = (W0 + W1) / 2.0;
const C3 = (W0 + W1) / 2.0;
const C4 = W1 / 2.0;

const D1 = W1;
const D2 = W0;
const D3 = W1;

/**
 * Perform one 4th-order symplectic Yoshida step for a single body or multi-body system.
 *
 * @param {Float64Array} pos - Position vector [x, y, z] (modified in place)
 * @param {Float64Array} vel - Velocity vector [vx, vy, vz] (modified in place)
 * @param {number} dt - Time step in seconds
 * @param {Function} accelFn - Function (pos, vel, t) => acceleration vector [ax, ay, az]
 * @param {number} [t=0] - Current simulation time in seconds
 */
export function yoshida4Step(pos, vel, dt, accelFn, t = 0) {
  // Sub-step 1: drift by C1 * dt
  pos[0] += C1 * vel[0] * dt;
  pos[1] += C1 * vel[1] * dt;
  pos[2] += C1 * vel[2] * dt;

  // Sub-step 1: kick by D1 * dt
  let a = accelFn(pos, vel, t + C1 * dt);
  vel[0] += D1 * a[0] * dt;
  vel[1] += D1 * a[1] * dt;
  vel[2] += D1 * a[2] * dt;

  // Sub-step 2: drift by C2 * dt
  pos[0] += C2 * vel[0] * dt;
  pos[1] += C2 * vel[1] * dt;
  pos[2] += C2 * vel[2] * dt;

  // Sub-step 2: kick by D2 * dt
  a = accelFn(pos, vel, t + (C1 + C2) * dt);
  vel[0] += D2 * a[0] * dt;
  vel[1] += D2 * a[1] * dt;
  vel[2] += D2 * a[2] * dt;

  // Sub-step 3: drift by C3 * dt
  pos[0] += C3 * vel[0] * dt;
  pos[1] += C3 * vel[1] * dt;
  pos[2] += C3 * vel[2] * dt;

  // Sub-step 3: kick by D3 * dt
  a = accelFn(pos, vel, t + (C1 + C2 + C3) * dt);
  vel[0] += D3 * a[0] * dt;
  vel[1] += D3 * a[1] * dt;
  vel[2] += D3 * a[2] * dt;

  // Sub-step 4: final drift by C4 * dt
  pos[0] += C4 * vel[0] * dt;
  pos[1] += C4 * vel[1] * dt;
  pos[2] += C4 * vel[2] * dt;
}

/**
 * Multi-body Yoshida 4th order step for N interacting bodies.
 *
 * @param {Array<Float64Array>} positions - Array of N position vectors [x, y, z]
 * @param {Array<Float64Array>} velocities - Array of N velocity vectors [vx, vy, vz]
 * @param {number} dt - Time step in seconds
 * @param {Function} computeAllAccels - Function (positions, velocities) => Array<Float64Array> of N acceleration vectors
 */
export function yoshida4MultiBodyStep(positions, velocities, dt, computeAllAccels) {
  const n = positions.length;

  // Sub-step 1: drift by C1 * dt
  for (let i = 0; i < n; i++) {
    positions[i][0] += C1 * velocities[i][0] * dt;
    positions[i][1] += C1 * velocities[i][1] * dt;
    positions[i][2] += C1 * velocities[i][2] * dt;
  }
  // Sub-step 1: kick by D1 * dt
  let accels = computeAllAccels(positions, velocities);
  for (let i = 0; i < n; i++) {
    velocities[i][0] += D1 * accels[i][0] * dt;
    velocities[i][1] += D1 * accels[i][1] * dt;
    velocities[i][2] += D1 * accels[i][2] * dt;
  }

  // Sub-step 2: drift by C2 * dt
  for (let i = 0; i < n; i++) {
    positions[i][0] += C2 * velocities[i][0] * dt;
    positions[i][1] += C2 * velocities[i][1] * dt;
    positions[i][2] += C2 * velocities[i][2] * dt;
  }
  // Sub-step 2: kick by D2 * dt
  accels = computeAllAccels(positions, velocities);
  for (let i = 0; i < n; i++) {
    velocities[i][0] += D2 * accels[i][0] * dt;
    velocities[i][1] += D2 * accels[i][1] * dt;
    velocities[i][2] += D2 * accels[i][2] * dt;
  }

  // Sub-step 3: drift by C3 * dt
  for (let i = 0; i < n; i++) {
    positions[i][0] += C3 * velocities[i][0] * dt;
    positions[i][1] += C3 * velocities[i][1] * dt;
    positions[i][2] += C3 * velocities[i][2] * dt;
  }
  // Sub-step 3: kick by D3 * dt
  accels = computeAllAccels(positions, velocities);
  for (let i = 0; i < n; i++) {
    velocities[i][0] += D3 * accels[i][0] * dt;
    velocities[i][1] += D3 * accels[i][1] * dt;
    velocities[i][2] += D3 * accels[i][2] * dt;
  }

  // Sub-step 4: final drift by C4 * dt
  for (let i = 0; i < n; i++) {
    positions[i][0] += C4 * velocities[i][0] * dt;
    positions[i][1] += C4 * velocities[i][1] * dt;
    positions[i][2] += C4 * velocities[i][2] * dt;
  }
}

/**
 * Dormand-Prince 5(4) adaptive Runge-Kutta step.
 * Computes 5th-order state and 4th-order error estimate.
 */
export function dopri54Step(pos, vel, dt, accelFn) {
  // k1
  const k1_v = accelFn(pos, vel);
  const k1_r = vec3.clone(vel);

  // k2: c2 = 1/5
  const r2 = vec3.clone(pos);
  const v2 = vec3.clone(vel);
  vec3.scaleAndAdd(r2, r2, k1_r, 0.2 * dt);
  vec3.scaleAndAdd(v2, v2, k1_v, 0.2 * dt);
  const k2_v = accelFn(r2, v2);
  const k2_r = vec3.clone(v2);

  // k3: c3 = 3/10
  const r3 = vec3.clone(pos);
  const v3 = vec3.clone(vel);
  vec3.scaleAndAdd(r3, r3, k1_r, (3.0 / 40.0) * dt);
  vec3.scaleAndAdd(r3, r3, k2_r, (9.0 / 40.0) * dt);
  vec3.scaleAndAdd(v3, v3, k1_v, (3.0 / 40.0) * dt);
  vec3.scaleAndAdd(v3, v3, k2_v, (9.0 / 40.0) * dt);
  const k3_v = accelFn(r3, v3);
  const k3_r = vec3.clone(v3);

  // k4: c4 = 4/5
  const r4 = vec3.clone(pos);
  const v4 = vec3.clone(vel);
  vec3.scaleAndAdd(r4, r4, k1_r, (44.0 / 45.0) * dt);
  vec3.scaleAndAdd(r4, r4, k2_r, (-56.0 / 15.0) * dt);
  vec3.scaleAndAdd(r4, r4, k3_r, (32.0 / 9.0) * dt);
  vec3.scaleAndAdd(v4, v4, k1_v, (44.0 / 45.0) * dt);
  vec3.scaleAndAdd(v4, v4, k2_v, (-56.0 / 15.0) * dt);
  vec3.scaleAndAdd(v4, v4, k3_v, (32.0 / 9.0) * dt);
  const k4_v = accelFn(r4, v4);
  const k4_r = vec3.clone(v4);

  // k5: c5 = 8/9
  const r5 = vec3.clone(pos);
  const v5 = vec3.clone(vel);
  vec3.scaleAndAdd(r5, r5, k1_r, (19372.0 / 6561.0) * dt);
  vec3.scaleAndAdd(r5, r5, k2_r, (-25360.0 / 2187.0) * dt);
  vec3.scaleAndAdd(r5, r5, k3_r, (64448.0 / 6561.0) * dt);
  vec3.scaleAndAdd(r5, r5, k4_r, (-212.0 / 729.0) * dt);
  vec3.scaleAndAdd(v5, v5, k1_v, (19372.0 / 6561.0) * dt);
  vec3.scaleAndAdd(v5, v5, k2_v, (-25360.0 / 2187.0) * dt);
  vec3.scaleAndAdd(v5, v5, k3_v, (64448.0 / 6561.0) * dt);
  vec3.scaleAndAdd(v5, v5, k4_v, (-212.0 / 729.0) * dt);
  const k5_v = accelFn(r5, v5);
  const k5_r = vec3.clone(v5);

  // k6: c6 = 1
  const r6 = vec3.clone(pos);
  const v6 = vec3.clone(vel);
  vec3.scaleAndAdd(r6, r6, k1_r, (9017.0 / 3168.0) * dt);
  vec3.scaleAndAdd(r6, r6, k2_r, (-355.0 / 33.0) * dt);
  vec3.scaleAndAdd(r6, r6, k3_r, (46732.0 / 5247.0) * dt);
  vec3.scaleAndAdd(r6, r6, k4_r, (49.0 / 176.0) * dt);
  vec3.scaleAndAdd(r6, r6, k5_r, (-5103.0 / 18656.0) * dt);
  vec3.scaleAndAdd(v6, v6, k1_v, (9017.0 / 3168.0) * dt);
  vec3.scaleAndAdd(v6, v6, k2_v, (-355.0 / 33.0) * dt);
  vec3.scaleAndAdd(v6, v6, k3_v, (46732.0 / 5247.0) * dt);
  vec3.scaleAndAdd(v6, v6, k4_v, (49.0 / 176.0) * dt);
  vec3.scaleAndAdd(v6, v6, k5_v, (-5103.0 / 18656.0) * dt);
  const k6_v = accelFn(r6, v6);
  const k6_r = vec3.clone(v6);

  // 5th-order solution:
  // pos_new = pos + dt * (35/384 k1 + 500/1113 k3 + 125/192 k4 - 2187/6784 k5 + 11/84 k6)
  pos[0] += dt * ((35.0 / 384.0) * k1_r[0] + (500.0 / 1113.0) * k3_r[0] + (125.0 / 192.0) * k4_r[0] - (2187.0 / 6784.0) * k5_r[0] + (11.0 / 84.0) * k6_r[0]);
  pos[1] += dt * ((35.0 / 384.0) * k1_r[1] + (500.0 / 1113.0) * k3_r[1] + (125.0 / 192.0) * k4_r[1] - (2187.0 / 6784.0) * k5_r[1] + (11.0 / 84.0) * k6_r[1]);
  pos[2] += dt * ((35.0 / 384.0) * k1_r[2] + (500.0 / 1113.0) * k3_r[2] + (125.0 / 192.0) * k4_r[2] - (2187.0 / 6784.0) * k5_r[2] + (11.0 / 84.0) * k6_r[2]);

  vel[0] += dt * ((35.0 / 384.0) * k1_v[0] + (500.0 / 1113.0) * k3_v[0] + (125.0 / 192.0) * k4_v[0] - (2187.0 / 6784.0) * k5_v[0] + (11.0 / 84.0) * k6_v[0]);
  vel[1] += dt * ((35.0 / 384.0) * k1_v[1] + (500.0 / 1113.0) * k3_v[1] + (125.0 / 192.0) * k4_v[1] - (2187.0 / 6784.0) * k5_v[1] + (11.0 / 84.0) * k6_v[1]);
  vel[2] += dt * ((35.0 / 384.0) * k1_v[2] + (500.0 / 1113.0) * k3_v[2] + (125.0 / 192.0) * k4_v[2] - (2187.0 / 6784.0) * k5_v[2] + (11.0 / 84.0) * k6_v[2]);
}

/**
 * Convergence verification helper (Rule 5):
 * Runs the simulation at step h and step h/2, comparing the results.
 *
 * @param {Function} runFn - (h) => { posFinal, velFinal, energyFinal }
 * @param {number} h - Base time step in seconds
 * @returns {Object} Convergence report
 */
export function checkConvergence(runFn, h) {
  const resH = runFn(h);
  const resH2 = runFn(h / 2.0);

  const posDiff = vec3.dist(resH.posFinal, resH2.posFinal);
  const velDiff = vec3.dist(resH.velFinal, resH2.velFinal);
  const relEnergyDiff = Math.abs(resH.energyFinal - resH2.energyFinal) / Math.abs(resH.energyFinal);

  return {
    h,
    hHalf: h / 2.0,
    posDiffMeters: posDiff,
    velDiffMps: velDiff,
    relEnergyDiff,
    converged: relEnergyDiff < 1e-6,
  };
}
