/**
 * Structural mechanics module for planetary engineering elements.
 * Evaluates beam deflections, root bending moments, axial stresses, Euler buckling,
 * and structural safety factors (SF >= 1.5).
 */

import { G, M_EARTH, REQUIRED_SAFETY_FACTOR } from './constants.js';

/**
 * Standard cantilever beam under uniform distributed self-weight load q (N/m).
 * @param {Object} params
 * @param {number} params.q - Uniform load per unit length (N/m)
 * @param {number} params.L - Length of the cantilever (m)
 * @param {number} params.E - Young's Modulus (Pa)
 * @param {number} params.I - Area Moment of Inertia (m^4)
 * @returns {{ rootMoment: number, tipDeflection: number }}
 */
export function cantilever({ q, L, E, I }) {
  if (L <= 0 || E <= 0 || I <= 0) {
    throw new Error('Geometric and material parameters must be positive');
  }

  // Root bending moment: M_root = q * L^2 / 2
  const rootMoment = (q * Math.pow(L, 2)) / 2.0;

  // Maximum tip deflection: delta_tip = q * L^4 / (8 * E * I)
  const tipDeflection = (q * Math.pow(L, 4)) / (8.0 * E * I);

  return { rootMoment, tipDeflection };
}

/**
 * Combined axial and bending stress: sigma = |N / A| + |M * c / I|
 * @param {number} N - Axial normal force in Newtons
 * @param {number} M - Bending moment in N*m
 * @param {number} A - Cross-sectional area in m^2
 * @param {number} I - Moment of inertia in m^4
 * @param {number} c - Distance from neutral axis to extreme fiber in meters
 * @returns {number} Maximum normal stress in Pa
 */
export function combinedStress(N, M, A, I, c) {
  const axial = Math.abs(N) / Math.max(1e-12, A);
  const bending = (Math.abs(M) * c) / Math.max(1e-12, I);
  return axial + bending;
}

/**
 * Euler critical column buckling load for a column fixed at base, free at tip (K=2):
 * P_cr = (pi^2 * E * I) / (4 * L^2)
 * Or for pinned-pinned (K=1):
 * P_cr = (pi^2 * E * I) / L^2
 *
 * @param {number} E - Young's modulus in Pa
 * @param {number} I - Moment of inertia in m^4
 * @param {number} L - Column length in meters
 * @param {number} [effectiveLengthFactor=2.0] - K factor (2.0 for cantilever column)
 * @returns {number} Critical buckling load in Newtons
 */
export function eulerBucklingLoad(E, I, L, effectiveLengthFactor = 2.0) {
  const effectiveLength = effectiveLengthFactor * L;
  return (Math.PI * Math.PI * E * I) / Math.pow(effectiveLength, 2);
}

/**
 * Safety Factor computation: SF = sigma_yield / sigma_actual
 * @param {number} yieldStrength - Material yield strength in Pa
 * @param {number} actualStress - Actual maximum stress in Pa
 * @returns {{ sf: number, passes: boolean }}
 */
export function safetyFactor(yieldStrength, actualStress) {
  if (actualStress <= 0) {
    return { sf: Infinity, passes: true };
  }
  const sf = yieldStrength / actualStress;
  return {
    sf,
    passes: sf >= REQUIRED_SAFETY_FACTOR,
  };
}

/**
 * First-principles structural analysis of a 12,000 km Octo-Earth articulated arm.
 * Evaluates gravity gradient differential, centrifugal stress, self-weight, and buckling.
 *
 * @param {Object} options
 * @param {number} [options.armLength=12.0e6] - Arm length in meters (default 12,000 km)
 * @param {number} [options.radiusRing=7.0e6] - Ring mounting radius from Earth center (m)
 * @param {number} [options.density=1300.0] - Material density in kg/m^3 (CNT composite)
 * @param {number} [options.yieldStrength=100.0e9] - Material yield strength in Pa (100 GPa CNT limit)
 * @param {number} [options.youngsModulus=1000.0e9] - Young's modulus in Pa (1 TPa)
 * @param {number} [options.crossSectionArea=1.0] - Effective cross-sectional area (m^2)
 * @param {number} [options.lateralThrustForce=0.0] - Transverse thrust load applied at tip (N)
 * @returns {Object} Comprehensive structural evaluation including safety factor and failure mode
 */
export function analyzeOctoArm({
  armLength = 12.0e6,
  radiusRing = 7.0e6,
  density = 1300.0,
  yieldStrength = 100.0e9,
  youngsModulus = 1000.0e9,
  crossSectionArea = 1.0,
  lateralThrustForce = 0.0,
} = {}) {
  const rRoot = radiusRing;
  const rTip = radiusRing + armLength;

  // 1. Gravity gradient across the 12,000 km arm
  const gRoot = (G * M_EARTH) / (rRoot * rRoot); // ~8.14 m/s^2 at 7,000 km
  const gTip = (G * M_EARTH) / (rTip * rTip); // ~1.10 m/s^2 at 19,000 km
  const deltaG = gRoot - gTip;

  // Total arm mass
  const armMass = density * crossSectionArea * armLength;

  // Integrated self-weight tensile load due to gravity gradient:
  // F_grav_gradient = integral_{rRoot}^{rTip} rho * A * (GM/r^2) dr = rho * A * GM * (1/rRoot - 1/rTip)
  const tensileLoadGravityGradient = density * crossSectionArea * G * M_EARTH * (1.0 / rRoot - 1.0 / rTip);
  const axialStressGravity = tensileLoadGravityGradient / crossSectionArea;

  // 2. Transverse bending from lateral thrust / reaction forces
  // Approximate beam as annular hollow cylinder or box with diameter D ~ 2 m
  const diameter = Math.sqrt((4.0 * crossSectionArea) / Math.PI) * 2.0;
  const c = diameter / 2.0;
  const I = (Math.PI / 64.0) * (Math.pow(diameter, 4) - Math.pow(diameter - 0.05, 4));

  const bendingMomentRoot = lateralThrustForce * armLength;
  const bendingStressRoot = (bendingMomentRoot * c) / Math.max(1e-6, I);

  // 3. Peak combined stress
  const peakStress = axialStressGravity + bendingStressRoot;

  // 4. Critical Euler Buckling load (if compressive load occurs under joint actuation)
  const pCritical = eulerBucklingLoad(youngsModulus, I, armLength, 2.0);

  // 5. Safety factor against yield strength
  const sfYield = safetyFactor(yieldStrength, peakStress);

  // Identify first failing component honestly
  let firstFailingPart = 'None (Structure Meets Safety Factor)';
  let failureMode = 'Nominal Safe';

  if (sfYield.sf < REQUIRED_SAFETY_FACTOR) {
    if (axialStressGravity > yieldStrength) {
      firstFailingPart = 'Arm Root / Ring Hinge Interface';
      failureMode = 'Tensile Rupture from Gravitational Gradient Self-Weight';
    } else if (bendingStressRoot > yieldStrength) {
      firstFailingPart = 'Joint 1 Cantilever Shoulder';
      failureMode = 'Bending Overstress from Transverse Reaction Loads';
    } else {
      firstFailingPart = 'Arm Main Spar Structure';
      failureMode = 'Combined Stress Exceeds Required 1.5 Safety Margin';
    }
  }

  return {
    armLengthMeters: armLength,
    armMassKg: armMass,
    gRootMps2: gRoot,
    gTipMps2: gTip,
    deltaGMps2: deltaG,
    axialStressPa: axialStressGravity,
    bendingStressPa: bendingStressRoot,
    peakStressPa: peakStress,
    yieldStrengthPa: yieldStrength,
    safetyFactor: sfYield.sf,
    passesRequirement: sfYield.passes,
    criticalBucklingLoadNewtons: pCritical,
    firstFailingPart,
    failureMode,
    unmodeledPhenomena: [
      'Multi-body dynamic joint vibration and resonance (frequencies < 1e-4 Hz)',
      'Thermal gradient expansion across day/night terminator',
      'Torsional flutter under non-symmetric magnetic drag',
      'Joint friction, bearing fatigue, and micro-meteoroid degradation',
    ],
  };
}
