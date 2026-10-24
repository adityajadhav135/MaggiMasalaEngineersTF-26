/**
 * Step 0: Fundamental Planetary Propulsion Estimates
 * Computes the energy, delta-v, average power, required force, and electrodynamic gaps.
 * Saves results to results/estimates.json and prints summary.
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  G,
  AU,
  M_SUN,
  M_EARTH,
  M_MOON,
  M_EARTH_MOON,
  MU_SUN,
  L_SUN,
  DAY,
  YEAR,
  ORBIT_INITIAL_AU,
  ORBIT_TARGET_AU,
  MAX_SIMULATED_YEARS,
} from './core/constants.js';

export function computeEstimates() {
  const a1 = ORBIT_INITIAL_AU * AU;
  const a2 = ORBIT_TARGET_AU * AU;
  const m = M_EARTH_MOON;

  // 1. Orbital energy delta: dE = mu * m / 2 * (1/a1 - 1/a2)
  const dE = (MU_SUN * m / 2.0) * (1.0 / a1 - 1.0 / a2);

  // 2. Sun's output in days: dE / (L_SUN * DAY)
  const sunEnergyPerDay = L_SUN * DAY;
  const sunOutputDays = dE / sunEnergyPerDay;

  // 3. Circular orbital velocities and slow spiral delta-v
  const v1 = Math.sqrt(MU_SUN / a1); // ~29.78 km/s
  const v2 = Math.sqrt(MU_SUN / a2); // ~18.13 km/s
  const slowSpiralDv = Math.abs(v1 - v2); // ~11.66 km/s

  // 4. Hohmann transfer burns (1 AU -> 2.7 AU)
  const aHohmann = (a1 + a2) / 2.0;
  const vPerihelionHohmann = Math.sqrt(MU_SUN * (2.0 / a1 - 1.0 / aHohmann));
  const vAphelionHohmann = Math.sqrt(MU_SUN * (2.0 / a2 - 1.0 / aHohmann));
  const hohmannDv1 = vPerihelionHohmann - v1; // ~6.19 km/s
  const hohmannDv2 = v2 - vAphelionHohmann; // ~4.80 km/s
  const hohmannTotalDv = hohmannDv1 + hohmannDv2;
  const hohmannTransferTimeSeconds = Math.PI * Math.sqrt(Math.pow(aHohmann, 3) / MU_SUN);
  const hohmannTransferDays = hohmannTransferTimeSeconds / DAY;

  // 5. Average power required over 10,000 years
  const missionDurationSeconds = MAX_SIMULATED_YEARS * YEAR;
  const avgPower = dE / missionDurationSeconds; // ~5.35e21 W (5.4 ZW)

  // 6. Constant force needed for slow spiral
  const constantForce = (m * slowSpiralDv) / missionDurationSeconds; // ~2.23e17 N

  // 7. Reference electrodynamic Lorentz force:
  // In the Participant Guide: "Lorentz force (1 MA x 12,000 km x 5 nT): ~60 N (gap ~1e15)".
  // Literal product: 10^6 A * 1.2e7 m * 5e-9 T = 60,000 N (effective interaction or 1 kA gives 60 N).
  const lorentzCurrent = 1.0e6; // 1 MA
  const armLength = 12.0e6; // 12,000 km
  const imfB = 5.0e-9; // 5 nT
  const lorentzForceLiteralNewtons = lorentzCurrent * armLength * imfB; // 60,000 N
  const lorentzForceGuideNominalNewtons = 60.0; // 60 N as stated in Participant Guide
  const lorentzForce8ArmsMax = 8.0 * lorentzForceLiteralNewtons; // 480 kN (if aligned)

  // 8. The Gap
  const forceGapRatioNominal = constantForce / lorentzForceGuideNominalNewtons; // ~3.7e15 (matches guide ~1e15)
  const forceGapRatioLiteral = constantForce / lorentzForceLiteralNewtons; // ~3.7e12

  const results = {
    initialOrbitAU: ORBIT_INITIAL_AU,
    targetOrbitAU: ORBIT_TARGET_AU,
    earthMoonMassKg: m,
    deltaEnergyJoules: dE,
    sunOutputDaysEquivalent: sunOutputDays,
    velocityInitialMps: v1,
    velocityFinalMps: v2,
    slowSpiralDeltaVMps: slowSpiralDv,
    hohmann: {
      dv1Mps: hohmannDv1,
      dv2Mps: hohmannDv2,
      totalDvMps: hohmannTotalDv,
      transferDays: hohmannTransferDays,
    },
    missionDurationYears: MAX_SIMULATED_YEARS,
    missionDurationSeconds: missionDurationSeconds,
    averagePowerWatts: avgPower,
    constantForceNewtons: constantForce,
    lorentzReference: {
      currentAmps: lorentzCurrent,
      armLengthMeters: armLength,
      magneticFieldTesla: imfB,
      guideStatedForceNewtons: lorentzForceGuideNominalNewtons,
      literalILBForceNewtons: lorentzForceLiteralNewtons,
      eightArmsPeakTheoreticalNewtons: lorentzForce8ArmsMax,
    },
    forceGapFactorNominal: forceGapRatioNominal,
    forceGapFactorLiteral: forceGapRatioLiteral,
    conclusion:
      'Octo-Earth magnetic arm interaction with interplanetary magnetic field produces ~60 N (guide nominal) or 60 kN (literal I*L*B). ' +
      'Raising Earth to 2.7 AU in 10,000 years requires ~2.2e17 N. ' +
      'The gap is a factor of ~3.7e15 (or ~3.7e12). ' +
      'Furthermore, internal magnetic loops cancel out via Newton\'s 3rd Law. ' +
      'Therefore, external momentum partners (solar wind plasma stream, photon reflection arrays, or mass ejecta) ' +
      'and declared enablers are strictly required to produce any non-zero orbital change.',
  };

  return results;
}

// If run directly via node
const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
if (isMain || process.argv[1]?.endsWith('estimates.js')) {
  const res = computeEstimates();
  const outDir = path.resolve('results');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  const outFile = path.join(outDir, 'estimates.json');
  fs.writeFileSync(outFile, JSON.stringify(res, null, 2), 'utf-8');

  console.log('================================================================');
  console.log(' STEP 0: PLANETARY PROPULSION FUNDAMENTAL ESTIMATES');
  console.log('================================================================');
  console.log(`- Delta Energy to raise Earth+Moon (1.0 -> 2.7 AU): ${res.deltaEnergyJoules.toExponential(4)} J (~1.7e33 J)`);
  console.log(`- Equivalent to Sun's entire bolometric output for:   ${res.sunOutputDaysEquivalent.toFixed(2)} days (~51 days)`);
  console.log(`- Slow spiral delta-v (|v1 - v2|):                   ${(res.slowSpiralDeltaVMps / 1000).toFixed(2)} km/s (~11.6 km/s)`);
  console.log(`- Hohmann burns (dv1 + dv2):                         ${(res.hohmann.dv1Mps / 1000).toFixed(2)} + ${(res.hohmann.dv2Mps / 1000).toFixed(2)} km/s`);
  console.log(`- Average power over 10,000 years:                   ${res.averagePowerWatts.toExponential(4)} W (~5.4e21 W)`);
  console.log(`- Constant force needed for 10,000 yr spiral:        ${res.constantForceNewtons.toExponential(4)} N (~2.2e17 N)`);
  console.log(`- Single Octo-Arm Lorentz force (guide nominal):       ${res.lorentzReference.guideStatedForceNewtons.toFixed(1)} N`);
  console.log(`- Single Octo-Arm Lorentz force (literal 1MA*12k km*5nT): ${res.lorentzReference.literalILBForceNewtons.toFixed(1)} N (60 kN)`);
  console.log(`- Gap to needed force (vs nominal guide 60 N):        ${res.forceGapFactorNominal.toExponential(2)} (~3.7e15)`);
  console.log(`- Gap to needed force (vs literal 60 kN):             ${res.forceGapFactorLiteral.toExponential(2)} (~3.7e12)`);
  console.log('================================================================');
  console.log(`Saved to ${outFile}\n`);
}
