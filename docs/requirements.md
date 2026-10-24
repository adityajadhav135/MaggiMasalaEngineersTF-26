# Requirements Specification — Black Ant Robotics Hackathon MVP

**Project**: Black Ant Robotics — Octo-Earth Orbital Simulator  
**Team**: MaggieMasalaEngineers26  
**Challenge**: Transfinitte '26 NITT Hackathon / Black Ant Robotics Challenge  
**Status**: Active MVP  

---

## 1. Executive Summary & Challenge Context

The Black Ant Robotics challenge poses an extreme planetary engineering problem: simulate the transfer of planet Earth from its current orbital radius ($\approx 1.0\text{ AU}$) to an expanded orbit ($\approx 2.7\text{ AU}$, situated in the outer Main Asteroid Belt). 

The reference concept provided in the problem statement is **Octo-Earth**:
- A continuous equatorial or circum-terrestrial ring encircling Earth.
- Eight articulated robotic / structural arms spaced symmetrically at $45^\circ$ intervals.
- Arm length extending up to approximately $12,000\text{ km}$ into circumplanetary space.
- Conductive structures interacting with planetary and interplanetary magnetic fields to generate propulsive thrust.
- Alternative physical concepts are permitted.

The challenge explicitly requires:
1. Realistic physical simulation of orbital mechanics.
2. A hard mission time limit of **10,000 simulated years**.
3. Respecting planetary safety requirements (historically referenced in a competition appendix).
4. Structural safety factor $\text{SF} \ge 1.5$ on any proposed mechanical structure.
5. Strict adherence to energy conservation, momentum conservation, reaction-force accounting, and scientific honesty.
6. A clear distinction between genuine physical validation and illustrative UI demonstrations.
7. Verification through applicable benchmark tests (e.g. Keplerian two-body conservation).

---

## 2. Rulebook Gap Analysis & Documented Deficiencies

In accordance with competition instructions to maintain scientific integrity and explicitly record gaps rather than fabricate assumptions:

| Requirement Area | Rulebook Reference | Observed Status in Repository / Problem Statement | Impact on Simulation & Validation |
| :--- | :--- | :--- | :--- |
| **Safety Appendix Definitions** | "Earth-safety requirements defined in a rulebook appendix" | **MISSING**. No formal Appendix A/B provided with quantitative thresholds. | We cannot certify Earth-safety as a blanket "PASS". We define explicit proxy criteria (max surface acceleration $\le 10^{-4}\text{ m/s}^2$ to prevent catastrophic tidal/structural disruption on the biosphere, Hill sphere preservation, lunar orbital stability) and mark formal rulebook compliance as **NOT VALIDATED (Appendix Missing)**. |
| **Material Specifications** | Structural Safety Factor $\ge 1.5$ | **UNSPECIFIED**. No material density, ultimate tensile strength ($\sigma_{\text{uts}}$), or Young's modulus ($E$) specified for the $12,000\text{ km}$ arms. | Using known material limits (carbon nanotubes $\sim 100\text{ GPa}$, high-strength steel $\sim 2\text{ GPa}$), a $12,000\text{ km}$ cantilever or tether experiences self-weight / centrifugal stresses exceeding theoretical atomic bond limits by orders of magnitude. Reported as **STRUCTURAL FAILURE / INFEASIBLE under current materials**. |
| **Magnetic Field & Power Model** | "Conductors interacting with magnetic fields" | **INCOMPLETE**. Planetary magnetosphere ($B \sim 30\text{--}60\text{ }\mu\text{T}$ at surface, dropping as $1/r^3$) and interplanetary magnetic field ($B \sim 5\text{ nT}$ at 1 AU) provide negligible magnetic pressure ($\sim 10^{-11}\text{ Pa}$) against solar wind ($P_{\text{dyn}} \sim 2\text{ nPa}$). | Generating continuous thrust capable of accelerating $M_\oplus = 5.972 \times 10^{24}\text{ kg}$ requires an external reaction mass or reaction flux. Internal electromagnetic forces between ring and Earth cancel via Newton's 3rd Law. Mechanism marked as **NOT PHYSICALLY VALIDATED without external reaction mass / reaction anchor**. |
| **Moon & Biosphere Interactions** | Perturbation of lunar orbit, solar irradiance drop at 2.7 AU | **UNSPECIFIED** in problem brief. | Solar constant at 2.7 AU drops from $1361\text{ W/m}^2$ to $\sim 187\text{ W/m}^2$ (drop of 86.3%), plunging Earth into permanent global glaciation without artificial heating. Reported in planetary consequences panel. |

---

## 3. Functional Requirements

### FR-01: Baseline Two-Body Orbital Simulator
- **FR-01.1**: Model Earth as a point mass $M_\oplus = 5.9722 \times 10^{24}\text{ kg}$ orbiting fixed Sun $M_\odot = 1.98847 \times 10^{30}\text{ kg}$ with standard gravitational constant $G = 6.67430 \times 10^{-11}\text{ m}^3\text{kg}^{-1}\text{s}^{-2}$.
- **FR-01.2**: Implement central standard equation of motion $\ddot{\mathbf{r}} = -\frac{\mu_\odot}{|\mathbf{r}|^3} \mathbf{r} + \mathbf{a}_{\text{thrust}}$, where $\mu_\odot = G M_\odot$.
- **FR-01.3**: Support variable integration intervals up to 10,000 simulated years.
- **FR-01.4**: Integrate using robust numerical methods:
  - Symplectic Yoshida 4th-order integrator (for long-term energy preservation in Hamiltonian regimes).
  - Adaptive Runge-Kutta 4(5) / Dormand-Prince (`scipy.integrate.solve_ivp` `RK45` or `DOP853`) with user-specified relative and absolute error tolerances.
- **FR-01.5**: Track and compute instantaneous specific orbital energy $\varepsilon = \frac{v^2}{2} - \frac{\mu_\odot}{r}$ and specific angular momentum vector $\mathbf{h} = \mathbf{r} \times \mathbf{v}$.
- **FR-01.6**: Detect target orbital radius crossing ($r \ge 2.7\text{ AU}$ or circularization at $2.7\text{ AU}$) with zero-crossing terminal events.

### FR-02: Mechanism Model & Physics Accounting
- **FR-02.1**: **Decoupled Architecture**: Keep the physical mechanism calculations separate from the orbital numerical integrator.
- **FR-02.2**: **Energy Ledger**: Compute total mechanical energy change required:
  $$\Delta E = M_\oplus \left( -\frac{\mu_\odot}{2 r_{\text{target}}} - \left(-\frac{\mu_\odot}{2 r_{\text{initial}}}\right) \right) \approx 1.67 \times 10^{33}\text{ J}$$
- **FR-02.3**: **Power Ledger**: Compute required continuous power over mission duration:
  $$P_{\text{req}} = \frac{\Delta E}{\Delta t_{\text{transfer}}}$$
- **FR-02.4**: **Reaction Force & Momentum Ledger**: Enforce Newton's Third Law ($\mathbf{F}_{\text{action}} = -\mathbf{F}_{\text{reaction}}$). Track momentum imparted to any expelled reaction mass or solar wind stream. If no reaction mass is expelled, the net center-of-mass momentum change must be zero.
- **FR-02.5**: **Illustrative vs Genuine Actuation**: Any UI sliders for thrust acceleration must be explicitly labeled as *"Illustrative / Continuous Low-Thrust Canonical Baseline (Not Validated for Octo-Earth Arm Electrodynamics)"*.

### FR-03: Octo-Earth Geometry & Structural Modeling
- **FR-03.1**: Model a ring structure around Earth (radius $R_{\text{ring}} \ge R_\oplus = 6,371\text{ km}$, typically geocentric or low orbit $7,000\text{--}10,000\text{ km}$).
- **FR-03.2**: Model eight articulated arms spaced at $45^\circ$ ($\pi/4\text{ rad}$) azimuths, with lengths up to $L_{\text{arm}} = 12,000\text{ km}$.
- **FR-03.3**: Perform first-principles structural feasibility analysis:
  - Tensile / bending stress under acceleration $a$: $\sigma \approx \rho a L$.
  - Centrifugal and gravity gradient stresses across a $12,000\text{ km}$ structure in Earth's gravity field:
    $$\Delta g = G M_\oplus \left( \frac{1}{R_1^2} - \frac{1}{R_2^2} \right)$$
  - Calculate structural safety factor $\text{SF} = \sigma_{\text{yield}} / \sigma_{\text{max}}$.
  - If $\text{SF} < 1.5$, issue an explicit `FAIL` warning.

### FR-04: User Interface & Visualizations (Streamlit + Plotly)
- **FR-04.1**: Professional engineering dashboard titled **“Black Ant Robotics — Octo-Earth Orbital Simulator”**.
- **FR-04.2**: Sidebar parameters:
  - Initial radius (default $1.0\text{ AU}$, range $0.5\text{--}1.5\text{ AU}$).
  - Target radius (default $2.7\text{ AU}$, range $1.5\text{--}5.0\text{ AU}$).
  - Simulation duration (up to $10,000\text{ years}$, default $1,000\text{--}5,000\text{ years}$).
  - Integrator choice: Symplectic Yoshida-4 vs SciPy Adaptive RK45/DOP853.
  - Thrust magnitude / low-thrust acceleration rate ($a \sim 10^{-9}\text{--}10^{-7}\text{ m/s}^2$).
  - Mechanism selection: Continuous Tangential Low-Thrust (Illustrative), Octo-Earth Electrodynamic Arm (Physical Analysis), Solar Radiation Pressure Collector.
- **FR-04.3**: Visualizations:
  - 2D/3D Heliocentric Trajectory Plot (Sun at origin, initial orbit circle, target orbit circle, trajectory color-coded by velocity or time).
  - Octo-Earth Mechanism Schematic: Earth globe, equatorial ring, 8 articulated arms at $45^\circ$, orientation vectors.
  - Energy & Angular Momentum Drift vs Time.
  - Orbital Radius vs Time.
- **FR-04.4**: Metric Cards:
  - Mission status (Target Reached / Target Incomplete / Timeout).
  - Final orbital radius & semi-major axis.
  - Total elapsed time.
  - Energy delta ($\Delta E$) & Cumulative Power.
  - Maximum orbital energy drift ($\Delta E / E_0$).
- **FR-04.5**: Results & Validation Matrix:
  - Table of benchmark criteria with explicit tags: `PASS`, `FAIL`, `NOT VALIDATED`.
- **FR-04.6**: Export:
  - CSV download button for full computed time-series trajectory and conservation metrics.

---

## 4. Non-Functional Requirements
- **NFR-01: Reproducibility & Portability**: Runs on Python 3.10+ without external APIs, paid cloud services, or closed-source toolchains.
- **NFR-02: Numerical Stability**: The unperturbed two-body Kepler orbit benchmark must maintain relative energy drift $|\Delta E / E| < 10^{-5}$ over 10 orbital periods under the symplectic or high-order integrator.
- **NFR-03: Performance**: Interactive simulations up to 10,000 years must execute in under 5 seconds for responsive UI feedback.
- **NFR-04: Test Suite**: Comprehensive automated test coverage (`pytest`) verifying Keplerian conservation, circular velocity formulation, event detection, and structural calculation limits.

