/**
 * Electromagnetism module for Planetary Propulsion Simulator.
 * Computes Lorentz forces on conductors, Biot-Savart fields, loop forces, and field models.
 * All computations use 64-bit IEEE 754 floats.
 */

import { MU_0, B_IMF_1AU } from './constants.js';
import * as vec3 from './vec3.js';

/**
 * Lorentz force on a straight conductor segment: F = I * (dl x B)
 * @param {number} I - Current in Amperes
 * @param {Array<number>|Float64Array} dl - Vector length & direction of segment [dx, dy, dz] in meters
 * @param {Array<number>|Float64Array} B - Magnetic field vector [Bx, By, Bz] in Tesla
 * @returns {Float64Array} Force vector [Fx, Fy, Fz] in Newtons
 */
export function lorentzSegment(I, dl, B) {
  const F = vec3.create();
  vec3.cross(F, dl, B);
  vec3.scale(F, F, I);
  return F;
}

/**
 * Net Lorentz force on a closed square loop carrying current I in a uniform magnetic field B.
 * By fundamental vector calculus, the closed contour integral of I * dl x B in a uniform field is identically ZERO:
 * oint (dl x B) = (oint dl) x B = 0 x B = 0.
 *
 * @param {number} I - Current in Amperes
 * @param {number} side - Side length of the square loop in meters
 * @param {Array<number>|Float64Array} B - Uniform magnetic field vector [Bx, By, Bz] in Tesla
 * @param {number} [segmentsPerSide=25] - Discretization points per side
 * @returns {Float64Array} Net force vector [Fx, Fy, Fz] in Newtons (will be ~0 within numerical precision)
 */
export function loopForce(I, side, B, segmentsPerSide = 25) {
  const netForce = vec3.create(0, 0, 0);
  const n = Math.max(1, Math.floor(segmentsPerSide));
  const ds = side / n;

  // Square loop in xy-plane centered at origin:
  // Side 1: from (-side/2, -side/2) to (+side/2, -side/2) -> dl = [+ds, 0, 0]
  // Side 2: from (+side/2, -side/2) to (+side/2, +side/2) -> dl = [0, +ds, 0]
  // Side 3: from (+side/2, +side/2) to (-side/2, +side/2) -> dl = [-ds, 0, 0]
  // Side 4: from (-side/2, +side/2) to (-side/2, -side/2) -> dl = [0, -ds, 0]
  const sides = [
    vec3.create(ds, 0, 0),
    vec3.create(0, ds, 0),
    vec3.create(-ds, 0, 0),
    vec3.create(0, -ds, 0),
  ];

  for (let s = 0; s < 4; s++) {
    const dl = sides[s];
    const segmentForce = lorentzSegment(I, dl, B);
    for (let k = 0; k < n; k++) {
      vec3.add(netForce, netForce, segmentForce);
    }
  }

  return netForce;
}

/**
 * Magnetic field from an infinitely long straight wire at distance r:
 * B = (mu_0 * I) / (2 * pi * r)
 *
 * @param {number} I - Current in Amperes
 * @param {number} r - Perpendicular distance from wire in meters
 * @returns {number} Magnetic field magnitude in Tesla
 */
export function biotSavartWire(I, r) {
  if (r <= 0) {
    throw new Error('Distance r must be positive');
  }
  return (MU_0 * I) / (2.0 * Math.PI * r);
}

/**
 * Interplanetary Magnetic Field (Parker spiral approximation) at distance r (m).
 * @param {number} rMeters - Radial distance from the Sun in meters
 * @returns {Float64Array} Interplanetary magnetic field vector in Tesla
 */
export function getInterplanetaryField(rMeters) {
  // Approximate 5 nT at 1 AU falling as 1/r
  const rAU = rMeters / 1.495978707e11;
  const bMag = B_IMF_1AU / Math.max(0.1, rAU);
  // Azimuthal component dominating in outer solar system
  return vec3.create(0, bMag, 0);
}

/**
 * Earth magnetic dipole field at a geocentric position vector.
 * @param {Float64Array} rGeoMeters - Position relative to Earth center in meters
 * @returns {Float64Array} Magnetic field vector in Tesla
 */
export function getEarthDipoleField(rGeoMeters) {
  const r = vec3.norm(rGeoMeters);
  const R_EARTH = 6.371e6;
  if (r < R_EARTH * 0.5) return vec3.create(0, 0, 0);

  // Earth dipole moment vector along -z (magnetic south at geographic north):
  // M_dipole ~ 8.0e22 A*m^2
  const M_MAG = 8.0e22;
  const unitR = vec3.create();
  vec3.normalize(unitR, rGeoMeters);

  // B = (mu_0 / (4*pi*r^3)) * (3(m . r_hat)r_hat - m)
  const mVec = vec3.create(0, 0, -M_MAG);
  const mDotR = vec3.dot(mVec, unitR);
  const factor = (MU_0 / (4.0 * Math.PI * Math.pow(r, 3)));

  const B = vec3.create();
  B[0] = factor * (3.0 * mDotR * unitR[0] - mVec[0]);
  B[1] = factor * (3.0 * mDotR * unitR[1] - mVec[1]);
  B[2] = factor * (3.0 * mDotR * unitR[2] - mVec[2]);
  return B;
}
