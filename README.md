# Planetary Propulsion Simulator — Black Ant Robotics

**Team**: MaggieMasalaEngineers26  
**Challenge**: Transfinitte '26 NITT Hackathon / Black Ant Robotics Challenge  
**Problem**: Software-only simulation of moving Earth and Moon from 1.0 AU to 2.7 AU within 10,000 simulated years.  
**Stack**: Plain ES Modules (Node 20+), 64-bit IEEE 754 Doubles, Three.js, Vite  
**Test Suite**: 14/14 Tests Pass (`node --test tests/benchmarks.test.js`) in 450 ms  

---

## 🚀 Quickstart: Setup, Run & Test

### 1. Requirements
- Node.js v20.0+ (Tested on Node.js v24.22.1 & npm v11.19.1)
- Modern web browser (Chrome, Edge, Firefox)

### 2. Install Dependencies
```bash
npm install
```

### 3. Step 0: Compute Estimates (Fundamental Gaps)
```bash
npm run estimates
```
*Computes energy, delta-v, average power, required force, and electrodynamic gap, saving to `results/estimates.json`.*

### 4. Run Automated Benchmark Test Suite
```bash
npm test
# Or directly:
node --test tests/benchmarks.test.js
```
*Executes all 10 official benchmarks + momentum ledger conservation test + integrator convergence test ($h$ vs $h/2$) + lunar binding stability test.*

### 5. Run Batch Experiments (Baseline Drift & Ledger Records)
```bash
node src/run_experiments.js
```
*Outputs structured reports to `results/baseline_drift.json` and `results/ledger_records.json`.*

### 6. Launch Interactive Three.js Simulator Web App
```bash
npm run dev
```
Open **http://127.0.0.1:3000** in your browser.

---

## 🏛 Architecture & Hard Rules Compliance

```
/src
  /core                 # NO DOM, NO three.js, Plain ES Modules (Node 20+)
    constants.js        # G, AU, M_sun, M_earth, M_moon, mu_sun, mu0, L_sun, sigma ...
    vec3.js             # High-performance Float64Array 3D vector arithmetic
    nbody.js            # N-body gravity, Kepler baseline, NASA JPL Horizons ephemerides
    integrators.js      # Symplectic 4th-order Yoshida, Dormand-Prince 5(4), convergence helper
    encke.js            # Encke-style deviation propagator relative to osculating orbit
    em.js               # Lorentz F = I(dl x B), Biot-Savart, closed-loop zero force theorem
    ledger.js           # Momentum + energy ledger (Action-Reaction Newton's 3rd Law accounting)
    propulsion.js       # Concept models: Octo-Earth internal, Solar Wind coupling, Photons
    structure.js        # Cantilever deflection, axial stress, Euler buckling, safety factors
    kinematics.js       # 8 articulated arms at 45° spacing, multi-segment joints, balance
    habitability.js     # Solar flux, Teq, surface temp, ocean freezing, Moon binding
    enablers.js         # Declared hypothetical enablers (<= 3, bounded, frozen after load)
    sim.js              # Orchestrator exposing read-only snapshot()
  /viz                  # Three.js 3D visualizer with floating origin (reads snapshot() only)
  /ui                   # Interactive dashboard controller, telemetry cards, canvas plots
/tests
  benchmarks.test.js    # All 10 benchmarks + ledger + convergence + Moon-bound tests
  generate_fixtures.js  # JPL Horizons cache parser for 10 bodies at epoch 2026-01-01
/results
  estimates.json        # Step 0 computed estimates
  baseline_drift.json   # 100-orbit Kepler and 10-year solar system energy conservation
  ledger_records.json   # Comparison of internal cancellation vs external momentum transfer
/docs
  design_one_pager.md   # Architectural design one-pager
  who_built_what.md     # Individual contribution log
  requirements.md       # Extracted challenge requirements
```

### Hard Rules Compliance Matrix

| Rule | Requirement | Implemented Solution |
|---|---|---|
| **Rule 1** | **Action-Reaction Ledger** | `src/core/ledger.js`: Every applied force books equal and opposite reaction partner. Internal reactions (lands on Earth) produce 0 net thrust. |
| **Rule 2** | **No Hard-Coded Results** | Every metric in UI and tests comes from running numerical integrations and physical equations. |
| **Rule 3** | **64-bit Physics Only** | Core uses JS `Number` / `Float64Array`. Never `Float32Array` in physics. |
| **Rule 4** | **Decoupled Physics Core** | `src/core` has zero DOM or Three.js imports; runs standalone in Node and passes `node --test`. Visuals call `sim.snapshot()` read-only. |
| **Rule 5** | **Convergence Test** | Verified in `tests/benchmarks.test.js`: step $h$ vs step $h/2$ energy agreement within $2.1 \times 10^{-10}$. |
| **Rule 6 & 7** | **Max 3 Bounded Enablers** | Exactly 3 enablers declared in `src/core/enablers.js`, deep-frozen with `Object.freeze()`. |
| **Rule 8** | **On-Screen Scale Labels** | Three.js displays exact scale factors and floating origin coordinates on screen. |

---

## 📊 Step 0 Fundamental Estimates

From running `npm run estimates`:

- **Orbital Energy Delta ($\Delta E$)**: $1.6885 \times 10^{33}\text{ J}$ ($\approx 1.7 \times 10^{33}\text{ J}$)
- **Solar Bolometric Equivalent**: $51.05\text{ days}$ of the Sun's total radiation output ($3.828 \times 10^{26}\text{ W}$)
- **Slow Spiral Velocity Increment**: $11.66\text{ km/s}$ ($|v_1 - v_2|$)
- **Hohmann Transfer Burns**: $6.20\text{ km/s} + 4.80\text{ km/s}$ ($T_{\text{transfer}} = 259.1\text{ days}$)
- **Average Power for 10,000 Years**: $5.3505 \times 10^{21}\text{ W}$ ($5.35\text{ ZW}$)
- **Constant Force Needed**: $2.2335 \times 10^{17}\text{ N}$
- **Single Octo-Arm Lorentz Force**:
  - Participant guide nominal: $60.0\text{ N}$ (Gap factor: **$3.72 \times 10^{15}$**)
  - Raw $I \cdot L \cdot B$ product ($1\text{ MA} \times 12,000\text{ km} \times 5\text{ nT}$): $60.0\text{ kN}$ (Gap factor: **$3.72 \times 10^{12}$**)

---

## 🧪 Validation Benchmarks

All 10 benchmarks from the Participant Guide pass with exact tolerances:

```
✔ 1. wire 10 A, L=2 m x, B=0.5 T y -> 10 N along +z
✔ 2. closed loop in uniform field -> net force 0 (1e-9 of I*L*B)
✔ 3. 1 kA wire at 1 m -> 2.000e-4 T (1e-6)
✔ 4. Kepler a=1 AU, e=0.3, 10 periods -> back to start, energy 1e-9
✔ 5. solar system 5 years, no push -> energy constant (1e-9)
✔ 6. Earth-Moon barycentre period 365.256 d (0.1 d)
✔ 7. Hohmann 1 -> 1.524 AU: 2.94 + 2.65 km/s, about 259 d
✔ 8. push 1e-8 m/s^2 along velocity for 1 yr -> a grows about 3170 km (1%)
✔ 9. cantilever self-weight: root moment qL^2/2, tip deflection qL^4/(8EI) (1%)
✔ 10. Teq at 1 AU, albedo 0.306 -> about 254 K (2 K)
✔ ledger: integrator honest + nothing from nothing (1e-9)
✔ convergence: h vs h/2 give same result within tolerance
✔ Moon stays bound after propulsion run
✔ orchestrator: PlanetaryPropulsionSim snapshot() exposes honest physics and ledger
```

---

## ⏱ 5-Minute Live Presentation Demo Script

### Minute 1: The Core Question & Step 0 Estimates
1. Open the app in browser at `http://127.0.0.1:3000/`.
2. Introduce the mission: Move Earth and Moon from 1.0 AU to 2.7 AU within 10,000 simulated years.
3. Show the **Step 0 Estimates** in the UI:
   - Energy required is $1.69 \times 10^{33}\text{ J}$ (51 days of the Sun's total output).
   - Constant force needed is $2.23 \times 10^{17}\text{ N}$.
   - Reference electrodynamic Lorentz force of 8 arms in the IMF produces only tens of Newtons. The gap is **$10^{15}$**!

### Minute 2: The Canonical Octo-Earth Reality Check (Scientific Honesty)
1. Select **"Octo-Earth (Canonical: Internal Loops -> 0 Thrust)"** from the concept dropdown.
2. Click **"Run Simulation"**.
3. Point to the **Momentum Ledger Panel**:
   - The arms exert forces on conductors, but the return circuit passes through Earth's ionosphere/core.
   - The ledger books the equal and opposite reaction partner on `earth_ionosphere_and_core`.
   - **Net external impulse is 0.00 N·s.**
   - Earth stays at **1.000 AU**; zero orbital change occurs!
   - Highlight the competition principle: **"A credible failure result is preferable to fabricated success."**

### Minute 3: External Momentum Partner & Successful Orbital Expansion
1. Switch to **"Octo-Earth (Solar Wind Plasma Coupling -> Thrust)"**.
2. Show that conductors extend beyond the magnetopause ($> 10 R_\oplus$) into the interplanetary solar wind.
3. Reaction partner changes to `solar_wind_ions` (External).
4. Click **"Fast Spiral"**:
   - Earth spirals outward past Mars (1.52 AU) toward the Asteroid Belt.
   - At year ~2,800, orbital radius crosses **2.70 AU**.
   - Mission status turns green: **`TARGET REACHED`**.

### Minute 4: 3D Visualization & Floating Origin
1. Click **"Earth & Octo-Ring Close-Up"** tab.
2. Rotate and inspect the 3D Earth globe, 7,000 km ring, and 8 articulated arms spaced at 45°.
3. Explain the **Floating Origin**: positions are computed in Float64 relative to Earth before conversion to GPU Float32, eliminating vertex jitter at $1.5 \times 10^{11}\text{ m}$.
4. Point out the **arm stress colors**: Green indicates safe under carbon nanotube limits ($SF \ge 1.5$), but under raw multi-petanewton planetary thrust loads, the system honestly reports structural overstress.

### Minute 5: Planetary Safeguards & Benchmark Validation
1. Highlight the **Biosphere & Habitability** card:
   - At 2.7 AU, solar flux drops by 86.3% ($187\text{ W/m}^2$). Without declared artificial solar mirrors, oceans freeze solid.
   - The toggle activates artificial heating to keep surface temperature at liquid water levels (~287 K).
2. Point out **Lunar Retention**: Moon remains inside Earth's Hill sphere ($26\% R_H$) with negative specific orbital energy.
3. Click **"Export CSV"** to demonstrate downloadable time-series trajectory and ledger records.
4. Conclude with the **14/14 automated test suite pass** proving mathematical and numerical rigour.
