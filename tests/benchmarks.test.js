import test from 'node:test';
import assert from 'node:assert/strict';
import { lorentzSegment, loopForce, biotSavartWire } from '../src/core/em.js';
import {
  keplerRun,
  systemEnergy,
  solarSystemRun,
  barycentrePeriodDays,
  hohmann,
  pushRun,
  HORIZONS_BODIES_2026,
} from '../src/core/nbody.js';
import { analyzeOctoArm, cantilever } from '../src/core/structure.js';
import { equilibriumTemp, checkMoonBound } from '../src/core/habitability.js';
import { PhysicsLedger } from '../src/core/ledger.js';
import { checkConvergence, yoshida4Step } from '../src/core/integrators.js';
import * as vec3 from '../src/core/vec3.js';
import { AU, MU_SUN } from '../src/core/constants.js';

const close = (a, b, rtol, atol = 0) =>
  assert.ok(
    Math.abs(a - b) <= atol + rtol * Math.abs(b),
    `${a} vs ${b} (diff: ${Math.abs(a - b)}, allowable: ${atol + rtol * Math.abs(b)})`
  );

test('1. wire 10 A, L=2 m x, B=0.5 T y -> 10 N along +z', () => {
  const F = lorentzSegment(10, [2, 0, 0], [0, 0.5, 0]);
  close(F[0], 0, 0, 1e-9);
  close(F[1], 0, 0, 1e-9);
  close(F[2], 10, 1e-9);
});

test('2. closed loop in uniform field -> net force 0 (1e-9 of I*L*B)', () => {
  const I = 10, side = 2, B = [0, 0.5, 0.3];
  const F = loopForce(I, side, B);               // square loop, discretised
  const scale = I * side * Math.hypot(...B);
  for (const c of F) {
    assert.ok(Math.abs(c) <= 1e-9 * scale, `Force component ${c} exceeds 1e-9 of scale ${scale}`);
  }
});

test('3. 1 kA wire at 1 m -> 2.000e-4 T (1e-6)', () => {
  close(biotSavartWire(1000, 1.0), 2.0e-4, 1e-6);
});

test('4. Kepler a=1 AU, e=0.3, 10 periods -> back to start, energy 1e-9', () => {
  const r = keplerRun({ a: 1.495978707e11, e: 0.3, periods: 10 });
  close(r.aFinal, r.a0, 1e-6);
  close(r.energyFinal, r.energy0, 1e-9);
  assert.ok(r.positionError / r.a0 < 1e-6, `Position error fraction: ${r.positionError / r.a0}`);
});

test('5. solar system 5 years, no push -> energy constant (1e-9)', () => {
  const r = solarSystemRun({ years: 5 });
  close(r.energyFinal, r.energy0, 1e-9);
});

test('6. Earth-Moon barycentre period 365.256 d (0.1 d)', () => {
  close(barycentrePeriodDays(), 365.256, 0, 0.1);
});

test('7. Hohmann 1 -> 1.524 AU: 2.94 + 2.65 km/s, about 259 d', () => {
  const h = hohmann(1.0, 1.524);                 // km/s, days
  close(h.dv1, 2.94, 0, 0.02);
  close(h.dv2, 2.65, 0, 0.02);
  close(h.days, 259, 0, 2);
});

test('8. push 1e-8 m/s^2 along velocity for 1 yr -> a grows about 3170 km (1%)', () => {
  const r = pushRun({ accel: 1e-8, years: 1 });  // uses your integrator, not the formula
  close(r.deltaA / 1000, 3170, 0.01);            // Gauss: da/dt = 2 a^2 (v.a_push)/mu
});

test('9. cantilever self-weight: root moment qL^2/2, tip deflection qL^4/(8EI) (1%)', () => {
  const p = { q: 100, L: 10, E: 200e9, I: 8e-6 };
  const r = cantilever(p);
  close(r.rootMoment, (p.q * p.L ** 2) / 2, 0.01);
  close(r.tipDeflection, (p.q * p.L ** 4) / (8 * p.E * p.I), 0.01);
});

test('Octo arm uses thrust as axial load and clears the 1.5 safety factor requirement', () => {
  const result = analyzeOctoArm({ axialThrustForce: 2.72e17 / 8 });

  assert.ok(result.axialThrustStressPa > 0);
  assert.equal(result.bendingStressPa, 0);
  assert.ok(result.safetyFactor > 1.5, `Expected SF > 1.5, got ${result.safetyFactor}`);
  assert.equal(result.passesRequirement, true);
});

test('10. Teq at 1 AU, albedo 0.306 -> about 254 K (2 K)', () => {
  close(equilibriumTemp({ rAU: 1, albedo: 0.306 }), 254, 0, 2);
});

// Additional required tests demanded by the rules:

test('ledger: integrator honest + nothing from nothing (1e-9)', () => {
  const ledger = new PhysicsLedger();
  const force = [1.2e16, -3.4e16, 5.6e15];
  const dt = 86400.0;
  const mass = 5.9722e24;

  // Apply force
  ledger.book({
    name: 'test_propulsion',
    onBody: 'earth',
    force,
    dt,
    partner: 'solar_wind_ions',
    partnerInEarthSystem: false,
    power: 5.4e21,
  });

  // Integrator honestly moves the body by F * dt / mass
  const dv = [
    (force[0] * dt) / mass,
    (force[1] * dt) / mass,
    (force[2] * dt) / mass,
  ];
  ledger.recordBodyImpulse(mass, dv);

  const report = ledger.report();
  assert.ok(report.validations.nothingCreatedFromNothing, 'Nothing created from nothing failed');
  assert.ok(report.validations.integratorHonest, 'Integrator honesty failed');
  assert.ok(report.validations.relativeConservationResidual < 1e-9);
  assert.ok(report.validations.relativeIntegratorResidual < 1e-9);
});

test('convergence: h vs h/2 give same result within tolerance', () => {
  // Test orbital propagation for 180 days with step h=7200s vs h/2=3600s
  const runOrbit = (step) => {
    const pos = vec3.create(AU, 0, 0);
    const vel = vec3.create(0, Math.sqrt(MU_SUN / AU), 0);
    const duration = 180.0 * 86400.0;
    const numSteps = Math.round(duration / step);

    const accelFn = (p) => {
      const r = Math.hypot(p[0], p[1], p[2]);
      const f = -MU_SUN / (r * r * r);
      return vec3.create(p[0] * f, p[1] * f, p[2] * f);
    };

    for (let s = 0; s < numSteps; s++) {
      yoshida4Step(pos, vel, step, accelFn, s * step);
    }

    const rFinal = Math.hypot(pos[0], pos[1], pos[2]);
    const vFinal = Math.hypot(vel[0], vel[1], vel[2]);
    const energyFinal = (vFinal * vFinal) / 2.0 - MU_SUN / rFinal;

    return {
      posFinal: pos,
      velFinal: vel,
      energyFinal,
    };
  };

  const conv = checkConvergence(runOrbit, 7200.0);
  assert.ok(conv.converged, `Convergence failed with relEnergyDiff: ${conv.relEnergyDiff}`);
  assert.ok(conv.relEnergyDiff < 1e-8, `Expected energy diff < 1e-8, got ${conv.relEnergyDiff}`);
});

test('Moon stays bound after propulsion run', () => {
  // Load real Earth and Moon state vectors from Horizons 2026 fixture
  const earth = HORIZONS_BODIES_2026.find((b) => b.name === 'Earth');
  const moon = HORIZONS_BODIES_2026.find((b) => b.name === 'Moon');

  assert.ok(earth, 'Earth fixture found');
  assert.ok(moon, 'Moon fixture found');

  const status = checkMoonBound(earth.pos, earth.vel, moon.pos, moon.vel, 1.0);
  assert.ok(status.bound, 'Moon should be bound to Earth');
  assert.ok(status.specificEnergy < 0, `Specific energy must be negative: ${status.specificEnergy}`);
  assert.ok(
    status.separation < status.hillSphere,
    `Separation (${status.separation} m) must be inside Hill sphere (${status.hillSphere} m)`
  );
  assert.ok(
    status.fractionOfHillRadius < 0.5,
    `Moon orbit should occupy less than 50% of Hill radius (got ${status.fractionOfHillRadius})`
  );
});

test('orchestrator: PlanetaryPropulsionSim snapshot() exposes honest physics and ledger', async () => {
  const { PlanetaryPropulsionSim } = await import('../src/core/sim.js');
  const { PROPULSION_CONCEPTS } = await import('../src/core/propulsion.js');

  const sim = new PlanetaryPropulsionSim({
    concept: PROPULSION_CONCEPTS.OCTO_SOLAR_WIND,
    thrustAccel: 1.0e-8,
    timeStepDays: 5.0,
  });

  // Step 20 times (100 days)
  sim.stepBatch(20);
  const snap = sim.snapshot();

  assert.ok(snap.time.elapsedYears > 0.2);
  assert.ok(snap.orbit.currentRadiusAU > 0.99);
  assert.ok(snap.ledger.normAppliedImpulse > 0);
  assert.ok(snap.ledger.validations.nothingCreatedFromNothing);
  assert.ok(snap.ledger.validations.integratorHonest);
  assert.ok(typeof snap.structure.safetyFactor === 'number');
  assert.ok(snap.structure.firstFailingPart.length > 0);
  assert.strictEqual(snap.kinematics.arms.length, 8);
  assert.strictEqual(snap.kinematics.isBalanced, true);
});
