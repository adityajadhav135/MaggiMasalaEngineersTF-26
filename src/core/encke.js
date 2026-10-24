/**
 * Encke's Method for Orbital Deviation Tracking.
 * Tracks perturbations delta_r = r - r_ref relative to an unperturbed Keplerian orbit.
 * Prevents numerical loss of significance when integrating tiny thrusts (e.g. 1e-8 m/s^2)
 * over astronomical distances (~1.5e11 m).
 */

import { MU_SUN } from './constants.js';
import * as vec3 from './vec3.js';

export class EnckePropagator {
  /**
   * @param {Object} params
   * @param {Float64Array|Array<number>} params.initialPos - Initial position in meters
   * @param {Float64Array|Array<number>} params.initialVel - Initial velocity in m/s
   * @param {number} [params.mu=MU_SUN] - Central gravitational parameter
   * @param {number} [params.rectificationThreshold=0.01] - Max delta_r / r before rectifying
   */
  constructor({
    initialPos,
    initialVel,
    mu = MU_SUN,
    rectificationThreshold = 0.01,
  }) {
    this.mu = mu;
    this.threshold = rectificationThreshold;
    this.r_ref = vec3.fromArray(initialPos);
    this.v_ref = vec3.fromArray(initialVel);
    this.delta_r = vec3.create(0, 0, 0);
    this.delta_v = vec3.create(0, 0, 0);
    this.total_r = vec3.clone(this.r_ref);
    this.total_v = vec3.clone(this.v_ref);
    this.rectifications = 0;
  }

  /**
   * Special series function f(q) to prevent catastrophic cancellation:
   * f(q) = q * (3 + 3q + q^2) / (1 + (1 + q)^(3/2))
   * where q = delta_r . (delta_r - 2 * r_perturbed) / r_perturbed^2
   */
  static fq(q) {
    const denom = 1.0 + Math.pow(1.0 + q, 1.5);
    return (q * (3.0 + 3.0 * q + q * q)) / denom;
  }

  /**
   * Propagate deviation by one step dt under perturbative acceleration a_pert.
   *
   * @param {number} dt - Time step in seconds
   * @param {Float64Array|Array<number>} a_pert - External thrust/perturbation acceleration [ax, ay, az]
   * @returns {{ pos: Float64Array, vel: Float64Array, deltaR: Float64Array }}
   */
  step(dt, a_pert) {
    // 1. Advance reference Keplerian state by dt
    const rRefMag = vec3.norm(this.r_ref);
    const aRefMag = -this.mu / (rRefMag * rRefMag * rRefMag);
    const a_ref = vec3.create(
      this.r_ref[0] * aRefMag,
      this.r_ref[1] * aRefMag,
      this.r_ref[2] * aRefMag
    );

    // Leapfrog update for reference orbit
    vec3.scaleAndAdd(this.r_ref, this.r_ref, this.v_ref, dt);
    vec3.scaleAndAdd(this.v_ref, this.v_ref, a_ref, dt);

    // 2. Current total position: r = r_ref + delta_r
    vec3.add(this.total_r, this.r_ref, this.delta_r);

    // 3. Compute Encke deviation acceleration:
    // a_delta = -mu / r_ref^3 * (fq(q) * r + delta_r) + a_pert
    const rTotMagSq = vec3.normSq(this.total_r);
    // q = delta_r . (delta_r - 2*r) / r^2
    const term = vec3.create();
    term[0] = this.delta_r[0] - 2.0 * this.total_r[0];
    term[1] = this.delta_r[1] - 2.0 * this.total_r[1];
    term[2] = this.delta_r[2] - 2.0 * this.total_r[2];
    const q = vec3.dot(this.delta_r, term) / rTotMagSq;
    const fVal = EnckePropagator.fq(q);

    const factor = -this.mu / (rRefMag * rRefMag * rRefMag);
    const a_delta = vec3.create(
      factor * (fVal * this.total_r[0] + this.delta_r[0]) + (a_pert[0] || 0.0),
      factor * (fVal * this.total_r[1] + this.delta_r[1]) + (a_pert[1] || 0.0),
      factor * (fVal * this.total_r[2] + this.delta_r[2]) + (a_pert[2] || 0.0)
    );

    // 4. Update delta_r and delta_v
    vec3.scaleAndAdd(this.delta_v, this.delta_v, a_delta, dt);
    vec3.scaleAndAdd(this.delta_r, this.delta_r, this.delta_v, dt);

    // 5. Update total states
    vec3.add(this.total_r, this.r_ref, this.delta_r);
    vec3.add(this.total_v, this.v_ref, this.delta_v);

    // 6. Check for rectification if deviation exceeds threshold
    const deltaMag = vec3.norm(this.delta_r);
    const rMag = vec3.norm(this.total_r);
    if (deltaMag / rMag > this.threshold) {
      this.rectify();
    }

    return {
      pos: vec3.clone(this.total_r),
      vel: vec3.clone(this.total_v),
      deltaR: vec3.clone(this.delta_r),
      rectified: deltaMag / rMag > this.threshold,
    };
  }

  /**
   * Rectify reference orbit to match current osculating position and velocity.
   */
  rectify() {
    vec3.copy(this.r_ref, this.total_r);
    vec3.copy(this.v_ref, this.total_v);
    vec3.zero(this.delta_r);
    vec3.zero(this.delta_v);
    this.rectifications++;
  }
}
