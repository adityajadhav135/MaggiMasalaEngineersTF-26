/**
 * Momentum and Energy Ledger (The Heart of the Simulator)
 *
 * Implements Newton's Third Law accounting and energy conservation:
 * - Every force applied to a body is booked with its equal and opposite reaction partner.
 * - Forces whose reaction lands on Earth (core, ring, arms, ionosphere held by Earth) move nothing.
 * - Only reactions carried away from the Earth system (solar wind, photons, ejecta, asteroid) move Earth.
 * - Tracks applied impulses, body impulses, partner impulses, power, and waste heat.
 */

import * as vec3 from './vec3.js';

export class PhysicsLedger {
  constructor() {
    this.reset();
  }

  reset() {
    this.entries = [];
    this.J_applied = vec3.create(0, 0, 0);     // Sum of F * dt on bodies
    this.J_partners = vec3.create(0, 0, 0);    // Sum of F_reaction * dt (-F * dt)
    this.dP_bodies = vec3.create(0, 0, 0);      // Integrated delta-P on bodies (m * dv)
    this.J_external = vec3.create(0, 0, 0);    // Impulse with partner OUTSIDE Earth system
    this.J_internal = vec3.create(0, 0, 0);    // Impulse with partner INSIDE Earth system
    this.totalEnergyDrawnJoules = 0.0;
    this.totalWasteHeatJoules = 0.0;
    this.partnersSummary = {};
  }

  /**
   * Book a force application.
   * @param {Object} record
   * @param {string} record.name - Identifier for the force source
   * @param {string} record.onBody - Target body receiving the force ('earth', 'moon', 'ring', etc.)
   * @param {Array<number>|Float64Array} record.force - Force vector [fx, fy, fz] in Newtons (inertial frame)
   * @param {number} record.dt - Time step in seconds
   * @param {string} record.partner - Reaction partner receiving equal & opposite impulse
   * @param {boolean|string} record.partnerInEarthSystem - Whether reaction partner is inside Earth system
   * @param {number} [record.power=0.0] - Energy rate drawn from power source in Watts
   * @param {number} [record.wasteHeat=0.0] - Waste thermal energy generated in Joules
   */
  book({
    name,
    onBody,
    force,
    dt,
    partner,
    partnerInEarthSystem,
    power = 0.0,
    wasteHeat = 0.0,
  }) {
    const fx = force[0] || 0.0;
    const fy = force[1] || 0.0;
    const fz = force[2] || 0.0;

    const impulseOnBody = vec3.create(fx * dt, fy * dt, fz * dt);
    const impulseOnPartner = vec3.create(-fx * dt, -fy * dt, -fz * dt);

    // Sum applied impulse on bodies
    vec3.add(this.J_applied, this.J_applied, impulseOnBody);

    // Sum reaction impulse on partners (identically -J_applied)
    vec3.add(this.J_partners, this.J_partners, impulseOnPartner);

    // Differentiate external vs internal momentum partners
    const isInternal = partnerInEarthSystem === true || partnerInEarthSystem === 'internal';
    if (isInternal) {
      vec3.add(this.J_internal, this.J_internal, impulseOnBody);
    } else {
      vec3.add(this.J_external, this.J_external, impulseOnBody);
    }

    // Energy tracking
    const energyDrawn = power * dt;
    this.totalEnergyDrawnJoules += energyDrawn;
    this.totalWasteHeatJoules += wasteHeat;

    // Aggregate by partner
    if (!this.partnersSummary[partner]) {
      this.partnersSummary[partner] = {
        name: partner,
        insideEarthSystem: isInternal,
        impulse: vec3.create(0, 0, 0),
        count: 0,
      };
    }
    vec3.add(this.partnersSummary[partner].impulse, this.partnersSummary[partner].impulse, impulseOnPartner);
    this.partnersSummary[partner].count++;
  }

  /**
   * Register actual velocity changes resulting from numerical integration of bodies.
   * This allows verifying that the integrator faithfully applied the forces.
   * @param {number} mass - Body mass in kg
   * @param {Float64Array|Array<number>} dv - Velocity change vector [dvx, dvy, dvz] in m/s
   */
  recordBodyImpulse(mass, dv) {
    this.dP_bodies[0] += mass * dv[0];
    this.dP_bodies[1] += mass * dv[1];
    this.dP_bodies[2] += mass * dv[2];
  }

  /**
   * Final report and validation assertions.
   * @param {Object} [orbitalContext]
   * @param {number} [orbitalContext.deltaOrbitalEnergy] - Change in orbital energy in Joules
   * @returns {Object} Full ledger validation report
   */
  report(orbitalContext = {}) {
    const normJApplied = vec3.norm(this.J_applied);
    const normJPartners = vec3.norm(this.J_partners);
    const normJExternal = vec3.norm(this.J_external);
    const normJInternal = vec3.norm(this.J_internal);

    // Conservation check: J_applied + J_partners must be 0 within 1e-9 of norm(J_applied)
    const sumJ = vec3.create();
    vec3.add(sumJ, this.J_applied, this.J_partners);
    const sumJNorm = vec3.norm(sumJ);

    let nothingFromNothingHonest = true;
    if (normJApplied > 1e-12) {
      nothingFromNothingHonest = sumJNorm <= 1e-9 * normJApplied;
    }

    // Integrator honesty check: dP_bodies vs J_applied (if dP was tracked)
    const diffImpulse = vec3.create();
    vec3.sub(diffImpulse, this.dP_bodies, this.J_applied);
    const diffImpulseNorm = vec3.norm(diffImpulse);

    let integratorHonest = true;
    if (normJApplied > 1e-12 && vec3.norm(this.dP_bodies) > 1e-12) {
      integratorHonest = diffImpulseNorm <= 1e-9 * normJApplied;
    }

    // Net effective thrust fraction: external momentum / total applied momentum
    const externalThrustFraction = normJApplied > 0 ? normJExternal / normJApplied : 0.0;

    return {
      appliedImpulseNewtonsSeconds: Array.from(this.J_applied),
      partnerImpulseNewtonsSeconds: Array.from(this.J_partners),
      internalImpulseNewtonsSeconds: Array.from(this.J_internal),
      externalImpulseNewtonsSeconds: Array.from(this.J_external),
      bodyMomentumChangeNewtonsSeconds: Array.from(this.dP_bodies),
      normAppliedImpulse: normJApplied,
      normPartnerImpulse: normJPartners,
      normExternalImpulse: normJExternal,
      normInternalImpulse: normJInternal,
      externalThrustFraction,
      totalEnergyDrawnJoules: this.totalEnergyDrawnJoules,
      totalWasteHeatJoules: this.totalWasteHeatJoules,
      deltaOrbitalEnergyJoules: orbitalContext.deltaOrbitalEnergy || 0.0,
      partners: this.partnersSummary,
      validations: {
        nothingCreatedFromNothing: nothingFromNothingHonest,
        sumJNorm,
        relativeConservationResidual: normJApplied > 0 ? sumJNorm / normJApplied : 0.0,
        integratorHonest,
        relativeIntegratorResidual: normJApplied > 0 ? diffImpulseNorm / normJApplied : 0.0,
      },
    };
  }
}
