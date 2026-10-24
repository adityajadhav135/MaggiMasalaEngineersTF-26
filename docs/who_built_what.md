# Who Built What Log — Planetary Propulsion Simulation

**Team**: MaggieMasalaEngineers26  
**Project**: Black Ant Robotics — Octo-Earth Planetary Propulsion Simulator  
**Challenge**: Transfinitte '26 NITT Hackathon  

---

## Contribution Matrix

| Team Member | Primary Roles & Architecture Ownership | Modules Created & Validated |
|---|---|---|
| **Lead Astrodynamicist & Physics Engineer** | - Symplectic 4th-order Yoshida integrator (`src/core/integrators.js`)<br>- N-Body gravitational dynamics & NASA JPL Horizons ephemerides (`src/core/nbody.js`)<br>- Encke deviation propagator (`src/core/encke.js`)<br>- Step 0 fundamental estimates (`src/estimates.js`) | `src/core/constants.js`<br>`src/core/vec3.js`<br>`src/core/nbody.js`<br>`src/core/integrators.js`<br>`src/core/encke.js`<br>`src/estimates.js` |
| **Electrodynamics & Ledger Architect** | - Momentum & energy ledger engine (`src/core/ledger.js`)<br>- Newton's Third Law action-reaction accounting<br>- Lorentz forces, Biot-Savart, closed loop field integrals (`src/core/em.js`)<br>- Propulsion concept models (`src/core/propulsion.js`)<br>- Declared hypothetical enablers (`src/core/enablers.js`) | `src/core/ledger.js`<br>`src/core/em.js`<br>`src/core/propulsion.js`<br>`src/core/enablers.js` |
| **Structural & Habitability Specialist** | - Octo-Earth 12,000 km arm structural stress analysis (`src/core/structure.js`)<br>- Euler column buckling & cantilever beam mechanics<br>- 8-arm articulated kinematics & balance tracking (`src/core/kinematics.js`)<br>- Planetary equilibrium temperature & biosphere habitability (`src/core/habitability.js`)<br>- Lunar orbital binding & Hill sphere retention | `src/core/structure.js`<br>`src/core/kinematics.js`<br>`src/core/habitability.js` |
| **Full-Stack & Visualization Engineer** | - Three.js 3D visualization with floating origin architecture (`src/viz/scene.js`)<br>- Responsive dashboard with telemetry cards & canvas plots (`src/ui/dashboard.js`, `index.html`, `index.css`)<br>- Automated benchmark test suite (`tests/benchmarks.test.js`)<br>- Batch experiment runner & reports (`src/run_experiments.js`)<br>- CSV telemetry exporter & documentation | `src/viz/scene.js`<br>`src/ui/dashboard.js`<br>`src/core/sim.js`<br>`src/run_experiments.js`<br>`tests/benchmarks.test.js`<br>`index.html`, `index.css` |

---

## Detailed Deliverable Log

1. **Step 0 Estimates (`src/estimates.js` & `results/estimates.json`)**:
   - Energy to raise Earth+Moon: $1.6885 \times 10^{33}\text{ J}$
   - Days of Sun's bolometric output: $51.05\text{ days}$
   - Slow spiral $\Delta v$: $11.66\text{ km/s}$
   - Hohmann burns: $6.20\text{ km/s} + 4.80\text{ km/s}$
   - Average power for 10,000 years: $5.3505 \times 10^{21}\text{ W}$ (5.35 ZW)
   - Constant force needed: $2.2335 \times 10^{17}\text{ N}$
   - Nominal single Octo-Arm Lorentz force: $60\text{ N}$ (gap $\sim 3.7 \times 10^{15}$)
2. **Physics Core (`src/core/`)**:
   - Pure ES modules, zero DOM/graphics imports, 64-bit doubles only.
   - Symplectic Yoshida-4 preserving orbital energy within $2.6 \times 10^{-13}$ over 100 orbits.
3. **Automated Verification (`tests/benchmarks.test.js`)**:
   - 14/14 automated tests passing via standard Node test runner (`node --test`).
4. **Three.js Visualizer (`src/viz/scene.js`)**:
   - Floating origin rendering to eliminate GPU vertex jitter at $1.5 \times 10^{11}\text{ m}$.
   - Real-time arm stress color coding (Green safe, Yellow warning, Red overstressed).
   - On-screen scale factors.
