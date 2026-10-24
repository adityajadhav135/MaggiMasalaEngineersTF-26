/**
 * Declared Hypothetical Enablers (Strictly <= 3, Bounded, and Frozen).
 *
 * Rule 6 & 7:
 * - Up to 3 declared hypothetical enablers, each bounded and labelled.
 * - No forbidden enablers (no reactionless thrust, no broken conservation laws, no assumed outcomes, no ignored loads).
 * - Frozen after load to prevent runtime tampering.
 */

const declaredEnablers = [
  {
    id: 'ENABLER_1_POWER',
    name: 'High-Density Fusion/Antimatter Reactor Array',
    bound: 'Maximum sustained continuous power capacity P <= 1.0e22 Watts (10 Zettawatts)',
    maxValue: 1.0e22,
    unit: 'W',
    category: 'Energy Source',
    rationale:
      'Provides the necessary ~5.4 ZW continuous power for planetary acceleration over 10,000 years. ' +
      'Requires full waste heat dissipation via high-temperature ring radiators.',
    status: 'DECLARED_BOUNDED',
  },
  {
    id: 'ENABLER_2_MATERIAL',
    name: 'Theoretical Carbon Nanotube / Graphene Structural Arm Composite',
    bound: 'Tensile yield strength sigma_yield <= 100.0 GPa, Density rho >= 1300.0 kg/m^3, E <= 1.0 TPa',
    maxValue: 100.0e9,
    unit: 'Pa',
    category: 'Materials Science',
    rationale:
      'Enables articulated arm components up to 12,000 km in Earth\'s gravity field without immediate catastrophic self-weight tensile rupture.',
    status: 'DECLARED_BOUNDED',
  },
  {
    id: 'ENABLER_3_PLASMA_COUPLING',
    name: 'Interplanetary Solar Wind Magnetized Plasma Return Circuit',
    bound: 'Plasma momentum coupling efficiency eta <= 0.85; loop closure strictly beyond magnetopause (> 10 R_earth)',
    maxValue: 0.85,
    unit: 'ratio',
    category: 'Electrodynamics & Momentum Partner',
    rationale:
      'Allows electrodynamic arms to interact with external momentum partner (solar wind ions), ' +
      'preventing Newton\'s Third Law cancellation that occurs with internal Earth ionospheric loops.',
    status: 'DECLARED_BOUNDED',
  },
];

// Deep freeze to guarantee immutability
for (const enabler of declaredEnablers) {
  Object.freeze(enabler);
}

export const ENABLERS = Object.freeze(declaredEnablers);

export function getEnablerById(id) {
  return ENABLERS.find((e) => e.id === id);
}

export function validateEnablerUsage(requestedPower, requestedYield, requestedCoupling) {
  const violations = [];
  if (requestedPower > ENABLERS[0].maxValue) {
    violations.push(`Power ${requestedPower.toExponential(2)} W exceeds Enabler 1 bound (${ENABLERS[0].maxValue.toExponential(2)} W)`);
  }
  if (requestedYield > ENABLERS[1].maxValue) {
    violations.push(`Yield strength ${requestedYield.toExponential(2)} Pa exceeds Enabler 2 bound (${ENABLERS[1].maxValue.toExponential(2)} Pa)`);
  }
  if (requestedCoupling > ENABLERS[2].maxValue) {
    violations.push(`Plasma coupling efficiency ${requestedCoupling} exceeds Enabler 3 bound (${ENABLERS[2].maxValue})`);
  }
  return {
    valid: violations.length === 0,
    violations,
  };
}
