/**
 * Simulation Orchestrator (sim.js)
 * Full 3-body gravitational dynamics (Sun, Earth, Moon) with mutual Newtonian coupling.
 * - Earth is gravitationally accelerated by Sun AND Moon (+ thrust)
 * - Moon is gravitationally accelerated by Sun AND Earth
 * - The Moon's gravitational pull and inertia are fully coupled into the orbital calculations.
 * - Planetary orbit expansion tracks Earth-Moon barycentre reaching target 2.7 AU.
 *
 * Exposes snapshot() for UI and Three.js visualizer.
 */

import {
  G,
  AU,
  YEAR,
  DAY,
  M_SUN,
  M_EARTH,
  M_MOON,
  M_EARTH_MOON,
  MU_SUN,
  MU_EARTH,
  ORBIT_INITIAL_AU,
  ORBIT_TARGET_AU,
  MAX_SIMULATED_YEARS,
} from './constants.js';
import * as vec3 from './vec3.js';
import { PhysicsLedger } from './ledger.js';
import { evaluatePropulsion, PROPULSION_CONCEPTS } from './propulsion.js';
import { analyzeOctoArm } from './structure.js';
import { OctoArmKinematics } from './kinematics.js';
import { evaluateHabitability, checkMoonBound } from './habitability.js';
import { ENABLERS } from './enablers.js';

// Yoshida 4th-order coefficients
const CBRT_2 = Math.cbrt(2.0);
const W1 = 1.0 / (2.0 - CBRT_2);
const W0 = -CBRT_2 / (2.0 - CBRT_2);
const C_STEPS = [W1 / 2.0, (W0 + W1) / 2.0, (W0 + W1) / 2.0, W1 / 2.0];
const D_STEPS = [W1, W0, W1];

export class PlanetaryPropulsionSim {
  /**
   * @param {Object} [config]
   * @param {string} [config.concept=PROPULSION_CONCEPTS.OCTO_SOLAR_WIND] - Active propulsion concept
   * @param {number} [config.initialOrbitAU=1.0] - Starting orbital radius in AU
   * @param {number} [config.targetOrbitAU=2.7] - Target orbital radius in AU
   * @param {number} [config.maxYears=10000.0] - Mission time limit in simulated years
   * @param {number} [config.thrustAccel=4.5e-8] - Thrust acceleration rate (m/s^2) sufficient to meet 2.7 AU
   * @param {number} [config.timeStepDays=5.0] - Base time step in days
   * @param {boolean} [config.artificialHeating=true] - Whether artificial solar radiation mirrors are deployed
   */
  constructor({
    concept = PROPULSION_CONCEPTS.OCTO_SOLAR_WIND,
    initialOrbitAU = ORBIT_INITIAL_AU,
    targetOrbitAU = ORBIT_TARGET_AU,
    maxYears = MAX_SIMULATED_YEARS,
    thrustAccel = 4.5e-8,
    timeStepDays = 5.0,
    artificialHeating = true,
  } = {}) {
    this.concept = concept;
    this.initialOrbitAU = initialOrbitAU;
    this.targetOrbitAU = targetOrbitAU;
    this.maxYears = maxYears;
    this.thrustAccel = thrustAccel;
    this.timeStepSeconds = timeStepDays * DAY;
    this.artificialHeating = artificialHeating;

    this.ledger = new PhysicsLedger();
    this.kinematics = new OctoArmKinematics();

    this.reset();
  }

  reset() {
    this.simTimeSeconds = 0.0;
    this.stepCount = 0;
    this.targetReached = false;
    this.targetReachedYear = null;
    this.ledger.reset();

    // Initial Earth state (ideal circular orbit at initialOrbitAU)
    const a0 = this.initialOrbitAU * AU;
    const v0 = Math.sqrt(MU_SUN / a0);

    this.rEarth = vec3.create(a0, 0, 0);
    this.vEarth = vec3.create(0, v0, 0);

    // Initial Moon state (orbiting Earth at 384,400 km in xy plane with real orbital velocity)
    const rMoonRel = 3.844e8;
    const vMoonRel = Math.sqrt((G * (M_EARTH + M_MOON)) / rMoonRel); // ~1,023 m/s

    this.rMoon = vec3.create(a0 + rMoonRel, 0, 0);
    this.vMoon = vec3.create(0, v0 + vMoonRel, 0);

    // Sun at origin
    this.rSun = vec3.create(0, 0, 0);
    this.vSun = vec3.create(0, 0, 0);

    // Historical trajectory points
    this.trajectoryHistory = [
      {
        year: 0,
        rAU: this.initialOrbitAU,
        xAU: this.rEarth[0] / AU,
        yAU: this.rEarth[1] / AU,
        zAU: this.rEarth[2] / AU,
      },
    ];

    // Arm state
    this.armExtension = 0.85;
    this.ringRotation = 0.0;
    this.cachedArmGeometry = this.kinematics.evaluate({
      extensionFraction: this.armExtension,
      ringRotationRad: this.ringRotation,
    });

    // Initial structural evaluation
    this.cachedStructural = analyzeOctoArm({
      armLength: 12.0e6,
      radiusRing: 7.0e6,
      density: 1300.0,
      yieldStrength: 100.0e9,
      youngsModulus: 1000.0e9,
      lateralThrustForce: 60.0,
    });
  }

  configure(params = {}) {
    if (params.concept !== undefined) this.concept = params.concept;
    if (params.targetOrbitAU !== undefined) this.targetOrbitAU = params.targetOrbitAU;
    if (params.thrustAccel !== undefined) this.thrustAccel = params.thrustAccel;
    if (params.artificialHeating !== undefined) this.artificialHeating = params.artificialHeating;
    if (params.timeStepDays !== undefined) this.timeStepSeconds = params.timeStepDays * DAY;
  }

  /**
   * Internal Symplectic 3-Body Sub-Step (Sun-Earth-Moon)
   * Integrates mutual gravitational pull:
   * - Moon pulls on Earth via a_M->E = G * M_moon * (r_M - r_E) / d_EM^3
   * - Earth pulls on Moon via a_E->M = G * M_earth * (r_E - r_M) / d_EM^3
   * - Sun pulls on both
   * - Thrust applied to Earth
   */
  _stepThreeBody(dtSub, thrustVector) {
    const thrustAccelE = vec3.create(
      thrustVector[0] / M_EARTH,
      thrustVector[1] / M_EARTH,
      thrustVector[2] / M_EARTH
    );

    // Helper to evaluate mutual 3-body accelerations
    const computeAccels = (rE, rM) => {
      // 1. Earth-Moon mutual gravity
      const dxEM = rM[0] - rE[0];
      const dyEM = rM[1] - rE[1];
      const dzEM = rM[2] - rE[2];
      const distEMSq = dxEM * dxEM + dyEM * dyEM + dzEM * dzEM;
      const distEM = Math.sqrt(distEMSq);
      const distEMCb = distEMSq * distEM;

      const factorEM = G / distEMCb;
      // Moon's gravitational pull on Earth
      const aMoonOnEarth = vec3.create(
        dxEM * factorEM * M_MOON,
        dyEM * factorEM * M_MOON,
        dzEM * factorEM * M_MOON
      );
      // Earth's gravitational pull on Moon
      const aEarthOnMoon = vec3.create(
        -dxEM * factorEM * M_EARTH,
        -dyEM * factorEM * M_EARTH,
        -dzEM * factorEM * M_EARTH
      );

      // 2. Solar gravity on Earth
      const distESq = rE[0] * rE[0] + rE[1] * rE[1] + rE[2] * rE[2];
      const distE = Math.sqrt(distESq);
      const factorSE = -MU_SUN / (distESq * distE);
      const aSunOnEarth = vec3.create(
        rE[0] * factorSE,
        rE[1] * factorSE,
        rE[2] * factorSE
      );

      // 3. Solar gravity on Moon
      const distMSq = rM[0] * rM[0] + rM[1] * rM[1] + rM[2] * rM[2];
      const distM = Math.sqrt(distMSq);
      const factorSM = -MU_SUN / (distMSq * distM);
      const aSunOnMoon = vec3.create(
        rM[0] * factorSM,
        rM[1] * factorSM,
        rM[2] * factorSM
      );

      // Total acceleration on Earth: Solar + Moon's pull + Thrust
      const aEarth = vec3.create(
        aSunOnEarth[0] + aMoonOnEarth[0] + thrustAccelE[0],
        aSunOnEarth[1] + aMoonOnEarth[1] + thrustAccelE[1],
        aSunOnEarth[2] + aMoonOnEarth[2] + thrustAccelE[2]
      );

      // Total acceleration on Moon: Solar + Earth's pull
      const aMoon = vec3.create(
        aSunOnMoon[0] + aEarthOnMoon[0],
        aSunOnMoon[1] + aEarthOnMoon[1],
        aSunOnMoon[2] + aEarthOnMoon[2]
      );

      return { aEarth, aMoon };
    };

    // Yoshida 4th-order stages
    // Stage 1
    vec3.scaleAndAdd(this.rEarth, this.rEarth, this.vEarth, C_STEPS[0] * dtSub);
    vec3.scaleAndAdd(this.rMoon, this.rMoon, this.vMoon, C_STEPS[0] * dtSub);

    let { aEarth, aMoon } = computeAccels(this.rEarth, this.rMoon);
    vec3.scaleAndAdd(this.vEarth, this.vEarth, aEarth, D_STEPS[0] * dtSub);
    vec3.scaleAndAdd(this.vMoon, this.vMoon, aMoon, D_STEPS[0] * dtSub);

    // Stage 2
    vec3.scaleAndAdd(this.rEarth, this.rEarth, this.vEarth, C_STEPS[1] * dtSub);
    vec3.scaleAndAdd(this.rMoon, this.rMoon, this.vMoon, C_STEPS[1] * dtSub);

    ({ aEarth, aMoon } = computeAccels(this.rEarth, this.rMoon));
    vec3.scaleAndAdd(this.vEarth, this.vEarth, aEarth, D_STEPS[1] * dtSub);
    vec3.scaleAndAdd(this.vMoon, this.vMoon, aMoon, D_STEPS[1] * dtSub);

    // Stage 3
    vec3.scaleAndAdd(this.rEarth, this.rEarth, this.vEarth, C_STEPS[2] * dtSub);
    vec3.scaleAndAdd(this.rMoon, this.rMoon, this.vMoon, C_STEPS[2] * dtSub);

    ({ aEarth, aMoon } = computeAccels(this.rEarth, this.rMoon));
    vec3.scaleAndAdd(this.vEarth, this.vEarth, aEarth, D_STEPS[2] * dtSub);
    vec3.scaleAndAdd(this.vMoon, this.vMoon, aMoon, D_STEPS[2] * dtSub);

    // Stage 4
    vec3.scaleAndAdd(this.rEarth, this.rEarth, this.vEarth, C_STEPS[3] * dtSub);
    vec3.scaleAndAdd(this.rMoon, this.rMoon, this.vMoon, C_STEPS[3] * dtSub);
  }

  /**
   * Advance simulation by dt seconds.
   * Breaks large dt into sub-steps (<= 1 day) to accurately integrate the 27.3-day lunar orbit.
   */
  step(dt = this.timeStepSeconds) {
    if (this.targetReached || this.simTimeSeconds >= this.maxYears * YEAR) {
      return;
    }

    const massSystem = M_EARTH_MOON;

    // 1. Evaluate active propulsion forces and book into ledger
    const prop = evaluatePropulsion({
      concept: this.concept,
      r: this.rEarth,
      v: this.vEarth,
      mass: massSystem,
      dt,
      ledger: this.ledger,
      options: {
        accelMps2: this.thrustAccel,
        forceNewtons: massSystem * this.thrustAccel,
        currentAmps: 1.0e6,
        armLengthMeters: 12.0e6,
        powerWatts: 5.35e21,
      },
    });

    const thrustForce = prop.thrustVector; // N

    // Sub-step integration to resolve the 27.3-day lunar orbit accurately
    const maxSubStep = 1.0 * DAY; // 1 day max per sub-step
    const numSubSteps = Math.max(1, Math.ceil(dt / maxSubStep));
    const dtSub = dt / numSubSteps;

    for (let s = 0; s < numSubSteps; s++) {
      this._stepThreeBody(dtSub, thrustForce);
    }

    // Register propulsion impulse into ledger for honesty validation
    // massSystem * dv_prop = thrustForce * dt
    const propDv = vec3.create(
      (thrustForce[0] / massSystem) * dt,
      (thrustForce[1] / massSystem) * dt,
      (thrustForce[2] / massSystem) * dt
    );
    this.ledger.recordBodyImpulse(massSystem, propDv);

    // Update time
    this.simTimeSeconds += dt;
    this.stepCount++;

    // Slowly rotate ring and arm assembly
    this.ringRotation += (2.0 * Math.PI * dt) / 86400.0;
    this.cachedArmGeometry = this.kinematics.evaluate({
      extensionFraction: this.armExtension,
      ringRotationRad: this.ringRotation,
    });

    // Update structural analysis with current load
    this.cachedStructural = analyzeOctoArm({
      armLength: 12.0e6,
      radiusRing: 7.0e6,
      lateralThrustForce: vec3.norm(thrustForce) / 8.0,
    });

    // Compute Earth-Moon Barycentre radius
    const baryX = (M_EARTH * this.rEarth[0] + M_MOON * this.rMoon[0]) / massSystem;
    const baryY = (M_EARTH * this.rEarth[1] + M_MOON * this.rMoon[1]) / massSystem;
    const baryZ = (M_EARTH * this.rEarth[2] + M_MOON * this.rMoon[2]) / massSystem;
    const currentR_m = Math.hypot(baryX, baryY, baryZ);
    const currentR_AU = currentR_m / AU;

    const currentYear = this.simTimeSeconds / YEAR;
    const lastRecordedYear = this.trajectoryHistory[this.trajectoryHistory.length - 1].year;
    if (currentYear - lastRecordedYear >= 15.0 || this.stepCount % 20 === 0) {
      this.trajectoryHistory.push({
        year: currentYear,
        rAU: currentR_AU,
        xAU: baryX / AU,
        yAU: baryY / AU,
        zAU: baryZ / AU,
      });
      if (this.trajectoryHistory.length > 500) {
        this.trajectoryHistory.splice(1, 2);
      }
    }

    // Check if target orbit (2.70 AU) is reached
    if (currentR_AU >= this.targetOrbitAU && !this.targetReached) {
      this.targetReached = true;
      this.targetReachedYear = currentYear;
    }
  }

  /**
   * Run multiple steps forward.
   */
  stepBatch(steps = 10, dt = this.timeStepSeconds) {
    for (let i = 0; i < steps; i++) {
      if (this.targetReached || this.simTimeSeconds >= this.maxYears * YEAR) break;
      this.step(dt);
    }
  }

  /**
   * Fast spiral directly out to 2.7 AU.
   * Advances the Earth-Moon system until targetOrbitAU (2.70 AU) is reached,
   * recording the full spiral trajectory and ledger metrics.
   */
  spiralToTarget() {
    if (this.concept === PROPULSION_CONCEPTS.OCTO_INTERNAL) {
      // In canonical internal mode, internal reaction cancellation prevents expansion!
      this.stepBatch(50);
      return;
    }

    // Adaptive macro-stepping to reach 2.7 AU efficiently
    const macroStepSeconds = 50.0 * DAY;
    const maxLoops = 80000;
    let loops = 0;

    while (!this.targetReached && this.simTimeSeconds < this.maxYears * YEAR && loops < maxLoops) {
      this.step(macroStepSeconds);
      loops++;
    }
  }

  /**
   * Return a read-only immutable snapshot of current simulation state.
   */
  snapshot() {
    const massSystem = M_EARTH_MOON;

    // Earth-Moon Barycentre position & velocity
    const baryX = (M_EARTH * this.rEarth[0] + M_MOON * this.rMoon[0]) / massSystem;
    const baryY = (M_EARTH * this.rEarth[1] + M_MOON * this.rMoon[1]) / massSystem;
    const baryZ = (M_EARTH * this.rEarth[2] + M_MOON * this.rMoon[2]) / massSystem;

    const baryVx = (M_EARTH * this.vEarth[0] + M_MOON * this.vMoon[0]) / massSystem;
    const baryVy = (M_EARTH * this.vEarth[1] + M_MOON * this.vMoon[1]) / massSystem;
    const baryVz = (M_EARTH * this.vEarth[2] + M_MOON * this.vMoon[2]) / massSystem;

    const rMeters = Math.hypot(baryX, baryY, baryZ);
    const vMps = Math.hypot(baryVx, baryVy, baryVz);
    const rAU = rMeters / AU;
    const year = this.simTimeSeconds / YEAR;

    // Specific orbital energy of Earth-Moon barycentre around Sun
    const specificEnergy = (vMps * vMps) / 2.0 - MU_SUN / rMeters;
    const semiMajorAxisM = -MU_SUN / (2.0 * specificEnergy);
    const semiMajorAxisAU = semiMajorAxisM / AU;

    // Specific angular momentum: h = |r x v|
    const hVec = vec3.create();
    vec3.cross(hVec, [baryX, baryY, baryZ], [baryVx, baryVy, baryVz]);
    const specificAngularMomentum = vec3.norm(hVec);

    // Moon's state relative to Earth
    const moonRelPos = [
      this.rMoon[0] - this.rEarth[0],
      this.rMoon[1] - this.rEarth[1],
      this.rMoon[2] - this.rEarth[2],
    ];
    const moonRelVel = [
      this.vMoon[0] - this.vEarth[0],
      this.vMoon[1] - this.vEarth[1],
      this.vMoon[2] - this.vEarth[2],
    ];
    const moonDist = Math.hypot(...moonRelPos);
    const moonVRel = Math.hypot(...moonRelVel);

    // Mutual gravitational energy of Moon relative to Earth
    const moonSpecificEnergy = 0.5 * moonVRel * moonVRel - (G * (M_EARTH + M_MOON)) / Math.max(1e3, moonDist);
    const moonPeriodDays = (2.0 * Math.PI * Math.sqrt(Math.pow(moonDist, 3) / (G * (M_EARTH + M_MOON)))) / DAY;

    // Habitability and Moon-bound evaluations
    const habitability = evaluateHabitability({
      rAU,
      artificialHeating: this.artificialHeating,
      heatingPowerWatts: this.artificialHeating ? 5.0e21 : 0.0,
    });

    const moonStatus = checkMoonBound(
      this.rEarth,
      this.vEarth,
      this.rMoon,
      this.vMoon,
      rAU
    );

    // Ledger report
    const deltaOrbitalEnergy = (MU_SUN * massSystem / 2.0) * (1.0 / (this.initialOrbitAU * AU) - 1.0 / rMeters);
    const ledgerReport = this.ledger.report({ deltaOrbitalEnergy });

    return {
      time: {
        simTimeSeconds: this.simTimeSeconds,
        elapsedYears: year,
        maxYears: this.maxYears,
        stepCount: this.stepCount,
        timeStepDays: this.timeStepSeconds / DAY,
      },
      orbit: {
        currentRadiusAU: rAU,
        semiMajorAxisAU,
        initialRadiusAU: this.initialOrbitAU,
        targetRadiusAU: this.targetOrbitAU,
        targetReached: this.targetReached,
        targetReachedYear: this.targetReachedYear,
        orbitalVelocityKmS: vMps / 1000.0,
        specificEnergy,
        specificAngularMomentum,
        progressPercent: Math.min(
          100.0,
          Math.max(0.0, ((rAU - this.initialOrbitAU) / (this.targetOrbitAU - this.initialOrbitAU)) * 100.0)
        ),
      },
      moonCoupling: {
        distanceMeters: moonDist,
        distanceKm: moonDist / 1000.0,
        relativeVelocityMps: moonVRel,
        orbitalPeriodDays: moonPeriodDays,
        specificEnergy: moonSpecificEnergy,
        moonPullOnEarthMps2: (G * M_MOON) / (moonDist * moonDist),
        earthPullOnMoonMps2: (G * M_EARTH) / (moonDist * moonDist),
        barycentreOffsetKm: (M_MOON * moonDist / massSystem) / 1000.0,
        isBound: moonSpecificEnergy < 0,
      },
      positions: {
        earth: Array.from(this.rEarth),
        earthVel: Array.from(this.vEarth),
        moon: Array.from(this.rMoon),
        moonVel: Array.from(this.vMoon),
        barycentre: [baryX, baryY, baryZ],
        sun: Array.from(this.rSun),
      },
      propulsion: {
        concept: this.concept,
        thrustAccelMps2: this.thrustAccel,
        effectiveThrustNewtons: this.concept === PROPULSION_CONCEPTS.OCTO_INTERNAL ? 0.0 : massSystem * this.thrustAccel,
        partner: this.concept === PROPULSION_CONCEPTS.OCTO_INTERNAL ? 'earth_ionosphere_and_core' : 'solar_wind_ions',
        partnerInsideEarthSystem: this.concept === PROPULSION_CONCEPTS.OCTO_INTERNAL,
      },
      structure: this.cachedStructural,
      kinematics: this.cachedArmGeometry,
      habitability,
      moonStatus,
      ledger: ledgerReport,
      enablers: ENABLERS,
      trajectoryHistory: this.trajectoryHistory,
    };
  }
}
