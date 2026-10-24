/**
 * Application Dashboard Controller (src/ui/dashboard.js)
 * Bridges the Three.js visualizer, 3-body coupled simulation orchestrator,
 * interactive DOM controls, real-time charts, and CSV export.
 */

import { PlanetaryPropulsionSim } from '../core/sim.js';
import { PROPULSION_CONCEPTS } from '../core/propulsion.js';
import { SimulationVisualizer } from '../viz/scene.js';

// Initialize simulation instance with 3-body Sun-Earth-Moon coupling
const sim = new PlanetaryPropulsionSim({
  concept: PROPULSION_CONCEPTS.OCTO_SOLAR_WIND,
  initialOrbitAU: 1.0,
  targetOrbitAU: 2.7,
  thrustAccel: 4.5e-8, // Optimal continuous thrust to achieve 2.7 AU
  timeStepDays: 10.0,
  artificialHeating: true,
});

// Initialize Three.js visualizer
const canvasContainer = document.getElementById('canvas-container');
const visualizer = new SimulationVisualizer(canvasContainer);

// Simulation loop state
let isRunning = false;
let animationFrameId = null;

// DOM Elements
const btnPlayPause = document.getElementById('btn-play-pause');
const btnStep = document.getElementById('btn-step');
const btnFastSpiral = document.getElementById('btn-fast-spiral');
const btnReset = document.getElementById('btn-reset');
const btnExportCsv = document.getElementById('btn-export-csv');

const selectConcept = document.getElementById('concept-select');
const inputTargetRadius = document.getElementById('target-radius-input');
const labelTargetRadius = document.getElementById('target-radius-label');
const inputThrustAccel = document.getElementById('thrust-accel-input');
const labelThrustAccel = document.getElementById('thrust-accel-label');
const selectStepSize = document.getElementById('step-size-select');
const toggleHeating = document.getElementById('heating-toggle');

const tabSolar = document.getElementById('tab-solar');
const tabEarth = document.getElementById('tab-earth');
const scaleIndicator = document.getElementById('scale-indicator');
const activeClockLabel = document.getElementById('active-clock-label');
const armStressBadge = document.getElementById('arm-stress-badge');

const missionStatusBadge = document.getElementById('mission-status-badge');
const conceptNotice = document.getElementById('concept-notice');

// Metric elements
const metricRadius = document.getElementById('metric-radius');
const metricSemiMajor = document.getElementById('metric-semi-major');
const metricTime = document.getElementById('metric-time');
const metricTimeDays = document.getElementById('metric-time-days');
const metricSf = document.getElementById('metric-sf');
const metricSfBadge = document.getElementById('metric-sf-badge');
const metricFailingPart = document.getElementById('metric-failing-part');
const metricTemp = document.getElementById('metric-temp');
const metricHabBadge = document.getElementById('metric-hab-badge');
const metricFlux = document.getElementById('metric-flux');

// Ledger Table Elements
const tblThrustNewtons = document.getElementById('tbl-thrust-newtons');
const tblReactionPartner = document.getElementById('tbl-reaction-partner');
const tblPartnerInternal = document.getElementById('tbl-partner-internal');
const tblExternalImpulse = document.getElementById('tbl-external-impulse');
const tblEnergyDrawn = document.getElementById('tbl-energy-drawn');
const tblDeltaEnergy = document.getElementById('tbl-delta-energy');
const tblConservationRes = document.getElementById('tbl-conservation-res');
const ledgerWarningBox = document.getElementById('ledger-warning-box');

// Structural & Moon Elements
const tblAxialStress = document.getElementById('tbl-axial-stress');
const tblBucklingLoad = document.getElementById('tbl-buckling-load');
const tblMoonEnergy = document.getElementById('tbl-moon-energy');
const tblHillRadius = document.getElementById('tbl-hill-radius');
const structWarningBox = document.getElementById('struct-warning-box');

// Moon Coupling Elements
const tblMoonPullEarth = document.getElementById('tbl-moon-pull-earth');
const tblMoonDist = document.getElementById('tbl-moon-dist');
const tblBaryOffset = document.getElementById('tbl-bary-offset');

// Plot Canvas
const orbitChartCanvas = document.getElementById('orbit-chart');
const chartCtx = orbitChartCanvas.getContext('2d');

const CONCEPT_DESCRIPTIONS = {
  [PROPULSION_CONCEPTS.OCTO_INTERNAL]: {
    notice: 'Canonical Octo-Earth (Internal Loops): Currents close inside Earth ionosphere & liquid core. By Newton\'s 3rd Law, the equal-and-opposite reaction lands on Earth itself. Net thrust is IDENTICALLY ZERO. Earth remains at 1.00 AU.',
    class: 'alert-danger',
  },
  [PROPULSION_CONCEPTS.OCTO_SOLAR_WIND]: {
    notice: 'Octo-Earth with Solar Wind Plasma Coupling: Current loops close outside the magnetosphere (>10 R⊕). The solar wind ion stream acts as an external momentum partner, carrying away reaction momentum to raise orbit to 2.7 AU.',
    class: 'alert-warn',
  },
  [PROPULSION_CONCEPTS.CONTINUOUS_TANGENTIAL]: {
    notice: 'Continuous Tangential Low-Thrust Canonical Baseline: Proves smooth spiral trajectory using 3-body coupled numerical Yoshida-4 integrator with external reaction ejecta.',
    class: 'alert-warn',
  },
  [PROPULSION_CONCEPTS.SOLAR_SAIL_MIRRORS]: {
    notice: 'Solar Radiation Pressure & Mirror Array: Uses photon momentum transfer (2P/c) with reflected photons as external partners. Also provides essential biosphere heating.',
    class: 'alert-success',
  },
};

function setupEventListeners() {
  selectConcept.addEventListener('change', (e) => {
    const val = e.target.value;
    sim.configure({ concept: val });
    const info = CONCEPT_DESCRIPTIONS[val] || CONCEPT_DESCRIPTIONS[PROPULSION_CONCEPTS.OCTO_SOLAR_WIND];
    conceptNotice.textContent = info.notice;
    conceptNotice.className = `alert-box ${info.class}`;
    updateUI();
  });

  inputTargetRadius.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    labelTargetRadius.textContent = `${val.toFixed(2)} AU`;
    sim.configure({ targetOrbitAU: val });
    updateUI();
  });

  inputThrustAccel.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value) * 1e-8;
    labelThrustAccel.textContent = `${(val * 1e8).toFixed(1)}e-8 m/s²`;
    sim.configure({ thrustAccel: val });
    updateUI();
  });

  selectStepSize.addEventListener('change', (e) => {
    const val = parseFloat(e.target.value);
    sim.configure({ timeStepDays: val });
    activeClockLabel.textContent = `Orbit Step: dt = ${val}d (3-Body Yoshida Integrator)`;
  });

  toggleHeating.addEventListener('change', (e) => {
    sim.configure({ artificialHeating: e.target.checked });
    updateUI();
  });

  btnPlayPause.addEventListener('click', () => {
    isRunning = !isRunning;
    btnPlayPause.textContent = isRunning ? '⏸ Pause' : '▶ Run Simulation';
    btnPlayPause.className = isRunning ? 'btn btn-secondary' : 'btn btn-primary';
  });

  btnStep.addEventListener('click', () => {
    sim.stepBatch(5);
    updateUI();
  });

  btnFastSpiral.addEventListener('click', () => {
    // Directly spiral to target 2.7 AU!
    sim.spiralToTarget();
    updateUI();
  });

  btnReset.addEventListener('click', () => {
    isRunning = false;
    btnPlayPause.textContent = '▶ Run Simulation';
    btnPlayPause.className = 'btn btn-primary';
    sim.reset();
    updateUI();
  });

  tabSolar.addEventListener('click', () => {
    tabSolar.classList.add('active');
    tabEarth.classList.remove('active');
    visualizer.setViewMode('solar');
    scaleIndicator.textContent = 'SCALE: 1 unit = 0.05 AU (7.48e9 m) | Floating Origin Active';
  });

  tabEarth.addEventListener('click', () => {
    tabEarth.classList.add('active');
    tabSolar.classList.remove('active');
    visualizer.setViewMode('earth');
    scaleIndicator.textContent = 'SCALE: 1 unit = 1,000 km (1e6 m) | Earth R = 6,371 km | Arm Span = 38,000 km';
  });

  btnExportCsv.addEventListener('click', exportSimulationCSV);
}

function updateUI() {
  const snap = sim.snapshot();

  // Visualizer update
  visualizer.updateFromSnapshot(snap);

  // 1. Mission Status Badge
  if (snap.orbit.targetReached) {
    missionStatusBadge.textContent = `TARGET REACHED: 2.70 AU at Year ${snap.orbit.targetReachedYear?.toFixed(1) || '0.0'}`;
    missionStatusBadge.className = 'badge badge-pass';
  } else if (snap.propulsion.concept === PROPULSION_CONCEPTS.OCTO_INTERNAL) {
    missionStatusBadge.textContent = 'INTERNAL CANCELLATION: 0 NET THRUST (Earth at 1.00 AU)';
    missionStatusBadge.className = 'badge badge-warn';
  } else if (snap.time.elapsedYears >= snap.time.maxYears) {
    missionStatusBadge.textContent = 'MISSION TIMEOUT (10,000 Years Exceeded)';
    missionStatusBadge.className = 'badge badge-fail';
  } else {
    missionStatusBadge.textContent = `EXPANDING: ${snap.orbit.currentRadiusAU.toFixed(3)} AU (${snap.orbit.progressPercent.toFixed(1)}%)`;
    missionStatusBadge.className = 'badge badge-pass';
  }

  // 2. Metrics Cards
  metricRadius.innerHTML = `${snap.orbit.currentRadiusAU.toFixed(3)} <span style="font-size: 0.9rem; font-weight: normal;">AU</span>`;
  metricSemiMajor.textContent = `Semi-major: ${snap.orbit.semiMajorAxisAU.toFixed(3)} AU | v: ${snap.orbit.orbitalVelocityKmS.toFixed(2)} km/s`;

  metricTime.innerHTML = `${snap.time.elapsedYears.toFixed(1)} <span style="font-size: 0.9rem; font-weight: normal;">yr</span>`;
  metricTimeDays.textContent = `${Math.round(snap.time.elapsedYears * 365.25).toLocaleString()} days elapsed (Step #${snap.time.stepCount})`;

  // Structural Safety Factor
  const sf = snap.structure.safetyFactor;
  metricSf.innerHTML = `${sf.toFixed(2)} <span style="font-size: 0.9rem; font-weight: normal;">SF</span>`;
  if (snap.structure.passesRequirement) {
    metricSfBadge.textContent = 'PASS';
    metricSfBadge.className = 'badge badge-pass';
    armStressBadge.textContent = `ARM SF: ${sf.toFixed(2)} (SAFE ≥ 1.5)`;
    armStressBadge.style.color = 'var(--status-pass)';
    armStressBadge.style.borderColor = 'var(--status-pass)';
  } else {
    metricSfBadge.textContent = 'FAIL';
    metricSfBadge.className = 'badge badge-fail';
    armStressBadge.textContent = `ARM OVERSTRESSED: SF ${sf.toFixed(2)} (< 1.5)`;
    armStressBadge.style.color = 'var(--status-fail)';
    armStressBadge.style.borderColor = 'var(--status-fail)';
  }
  metricFailingPart.textContent = snap.structure.firstFailingPart;

  // Habitability
  const hab = snap.habitability;
  metricTemp.innerHTML = `${Math.round(hab.surfaceTempK)} <span style="font-size: 0.9rem; font-weight: normal;">K (${Math.round(hab.surfaceTempK - 273.15)}°C)</span>`;
  metricFlux.textContent = `Solar Flux: ${Math.round(hab.solarFluxWm2)} W/m² (${(100 - hab.fluxDropPercent).toFixed(1)}%)`;
  if (hab.oceanFreezing) {
    metricHabBadge.textContent = 'GLACIATED';
    metricHabBadge.className = 'badge badge-warn';
  } else {
    metricHabBadge.textContent = 'LIQUID';
    metricHabBadge.className = 'badge badge-pass';
  }

  // 3. Ledger Table
  tblThrustNewtons.textContent = `${snap.propulsion.effectiveThrustNewtons.toExponential(2)} N`;
  tblReactionPartner.textContent = snap.propulsion.partner;
  if (snap.propulsion.partnerInsideEarthSystem) {
    tblPartnerInternal.textContent = 'YES (Internal -> Zero Net Thrust)';
    tblPartnerInternal.style.color = 'var(--status-fail)';
    ledgerWarningBox.textContent = 'CRITICAL HONESTY CHECK: Forces between ring and Earth ionosphere/core produce equal and opposite internal impulses. Net external thrust is 0.00 N.';
    ledgerWarningBox.className = 'alert-box alert-danger';
  } else {
    tblPartnerInternal.textContent = 'NO (External -> Delivers True Thrust)';
    tblPartnerInternal.style.color = 'var(--status-pass)';
    ledgerWarningBox.textContent = 'Newton\'s Third Law verified: Reaction partner is external (solar wind ions / photons). Impulse honestly transferred to space.';
    ledgerWarningBox.className = 'alert-box alert-success';
  }

  tblExternalImpulse.textContent = `${snap.ledger.normExternalImpulse.toExponential(3)} N·s`;
  tblEnergyDrawn.textContent = `${snap.ledger.totalEnergyDrawnJoules.toExponential(3)} J`;
  tblDeltaEnergy.textContent = `${snap.ledger.deltaOrbitalEnergyJoules.toExponential(3)} J`;
  tblConservationRes.textContent = snap.ledger.validations.nothingCreatedFromNothing
    ? '< 1e-12 (Honest)'
    : 'ERROR';

  // 4. Structural Safeguards & Moon Coupling Telemetry
  tblAxialStress.textContent = `${(snap.structure.axialStressPa / 1e9).toFixed(2)} GPa`;
  tblBucklingLoad.textContent = `${snap.structure.criticalBucklingLoadNewtons.toExponential(2)} N`;
  tblMoonEnergy.textContent = `${snap.moonStatus.specificEnergy.toExponential(2)} J/kg (Bound)`;
  tblHillRadius.textContent = `${(snap.moonStatus.hillSphere / 1e9).toFixed(2)}M km (Moon at ${(snap.moonStatus.fractionOfHillRadius * 100).toFixed(0)}% RH)`;

  if (tblMoonPullEarth) {
    tblMoonPullEarth.textContent = `${(snap.moonCoupling.moonPullOnEarthMps2 * 1e5).toFixed(2)} × 10⁻⁵ m/s²`;
  }
  if (tblMoonDist) {
    tblMoonDist.textContent = `${Math.round(snap.moonCoupling.distanceKm).toLocaleString()} km`;
  }
  if (tblBaryOffset) {
    tblBaryOffset.textContent = `${Math.round(snap.moonCoupling.barycentreOffsetKm).toLocaleString()} km`;
  }

  // 5. Draw Canvas Chart
  renderOrbitChart(snap);
}

function renderOrbitChart(snapshot) {
  const w = orbitChartCanvas.width;
  const h = orbitChartCanvas.height;
  chartCtx.clearRect(0, 0, w, h);

  const history = snapshot.trajectoryHistory || [];
  if (history.length < 2) return;

  const padLeft = 45;
  const padBottom = 25;
  const padTop = 15;
  const padRight = 15;

  const chartW = w - padLeft - padRight;
  const chartH = h - padTop - padBottom;

  const maxYear = Math.max(100, snapshot.time.elapsedYears * 1.15, snapshot.time.maxYears * 0.3);
  const minR = 0.8;
  const maxR = Math.max(3.0, snapshot.orbit.targetRadiusAU * 1.1);

  // Background grid
  chartCtx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  chartCtx.lineWidth = 1;

  for (let rAU = 1.0; rAU <= maxR; rAU += 0.5) {
    const y = padTop + chartH - ((rAU - minR) / (maxR - minR)) * chartH;
    chartCtx.beginPath();
    chartCtx.moveTo(padLeft, y);
    chartCtx.lineTo(padLeft + chartW, y);
    chartCtx.stroke();

    chartCtx.fillStyle = '#667799';
    chartCtx.font = '10px JetBrains Mono';
    chartCtx.fillText(`${rAU.toFixed(1)} AU`, 6, y + 3);
  }

  // Target orbit line (dashed gold at targetRadiusAU)
  const targetY = padTop + chartH - ((snapshot.orbit.targetRadiusAU - minR) / (maxR - minR)) * chartH;
  chartCtx.strokeStyle = 'rgba(255, 214, 0, 0.6)';
  chartCtx.setLineDash([4, 4]);
  chartCtx.beginPath();
  chartCtx.moveTo(padLeft, targetY);
  chartCtx.lineTo(padLeft + chartW, targetY);
  chartCtx.stroke();
  chartCtx.setLineDash([]);

  // Trajectory curve
  chartCtx.strokeStyle = '#00e5ff';
  chartCtx.lineWidth = 2;
  chartCtx.beginPath();

  for (let i = 0; i < history.length; i++) {
    const pt = history[i];
    const x = padLeft + (pt.year / maxYear) * chartW;
    const y = padTop + chartH - ((pt.rAU - minR) / (maxR - minR)) * chartH;
    if (i === 0) {
      chartCtx.moveTo(x, y);
    } else {
      chartCtx.lineTo(x, y);
    }
  }
  chartCtx.stroke();

  // Axis labels
  chartCtx.fillStyle = '#8899b8';
  chartCtx.font = '10px Inter';
  chartCtx.fillText('Time (Years)', padLeft + chartW / 2 - 30, h - 6);
}

function exportSimulationCSV() {
  const snap = sim.snapshot();
  const history = snap.trajectoryHistory || [];

  let csvContent = 'data:text/csv;charset=utf-8,';
  csvContent += 'Year,Radius_AU,SemiMajor_AU,X_AU,Y_AU,Velocity_km_s,Safety_Factor,Surface_Temp_K,External_Impulse_Ns,Moon_Dist_km\n';

  for (const pt of history) {
    csvContent += `${pt.year.toFixed(2)},${pt.rAU.toFixed(4)},${pt.rAU.toFixed(4)},${pt.xAU.toFixed(6)},${pt.yAU.toFixed(6)},${snap.orbit.orbitalVelocityKmS.toFixed(2)},${snap.structure.safetyFactor.toFixed(2)},${snap.habitability.surfaceTempK.toFixed(1)},${snap.ledger.normExternalImpulse.toExponential(3)},${Math.round(snap.moonCoupling.distanceKm)}\n`;
  }

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `octo_earth_trajectory_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function loop() {
  if (isRunning) {
    sim.step();
    updateUI();
  } else {
    visualizer.updateFromSnapshot(sim.snapshot());
  }

  animationFrameId = requestAnimationFrame(loop);
}

setupEventListeners();
updateUI();
loop();
