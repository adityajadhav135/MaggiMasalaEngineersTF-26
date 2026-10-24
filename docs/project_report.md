# Black Ant Robotics Planetary Propulsion Simulator

**Project report**  
**Team:** MaggieMasalaEngineers26  
**Event:** Transfinitte '26 NITT Hackathon  
**Project type:** Interactive engineering simulation and feasibility study

## Abstract

This project explores the challenge of transferring the Earth-Moon system from a near-circular orbit at 1.0 AU to 2.7 AU within 10,000 simulated years. The software combines orbital propagation, a three-body Sun-Earth-Moon model, propulsion concept comparisons, energy and momentum accounting, structural estimates, lunar-orbit monitoring, and a browser-based 3D dashboard.

The simulator demonstrates that an idealized low-thrust trajectory can reach the target radius within the time limit when a continuous external thrust is assumed. This is a trajectory result, not proof that the proposed Octo-Earth electrodynamic system can provide that thrust. The current propulsion estimates show a very large gap between the required force and the reference Lorentz-force capability. Structural safety is likewise conditional on idealized section and load-sharing assumptions and must not be presented as a certified design result.

## Project Goals

- Model orbital motion and visualize a transfer from 1.0 AU toward 2.7 AU.
- Compare internal and external momentum-reaction concepts using an explicit action-reaction ledger.
- Estimate the energy, power, force, and structural demands of the mission.
- Monitor Earth-Moon coupling and habitability indicators during the simulated transfer.
- Keep numerical calculations testable independently of the web interface.

## System Overview

The project has two interfaces: a Vite and Three.js browser simulator and a Python/Streamlit analysis dashboard. The browser simulation's physics core is implemented in JavaScript ES modules and can be run under Node for automated testing.

| Area | Implementation |
|---|---|
| Orbital dynamics | Symplectic integration and Sun-Earth-Moon mutual gravitational coupling in `src/core/sim.js` |
| Propulsion concepts | Internal electrodynamic loops, solar-wind coupling, continuous tangential thrust, and photon momentum in `src/core/propulsion.js` |
| Conservation accounting | Energy and momentum/reaction-partner ledger in `src/core/ledger.js` |
| Structural estimate | Axial, gravity-gradient, bending, yield, and Euler-buckling calculations in `src/core/structure.js` |
| Visualization | Interactive controls, metrics, charts, and Three.js visualization in `src/ui/` and `src/viz/` |
| Python analysis | Orbital and mechanism calculations in `src/mechanism.py`, `src/simulation.py`, and `app.py` |
| Automated checks | Node benchmark and regression suite in `tests/benchmarks.test.js`; Python tests in `tests/` |

## Method

### Orbital transfer

The orbital model integrates gravitational motion and a configurable thrust acceleration. The interface allows the user to select a target radius and thrust rate, step the model, or run the transfer quickly. The current browser demonstration reached 2.70 AU at approximately 8,571 simulated years with an assumed continuous thrust acceleration around $3.6\times10^{-8}\,\mathrm{m/s^2}$.

That result is conditional on the assumed thrust being available and applied in the modeled direction. It does not demonstrate that the selected propulsion mechanism can produce the force or power required. Actual mission feasibility depends on the external momentum source, coupling efficiency, power source, and thermal rejection.

### Energy and force scale

Moving the Earth-Moon system outward requires orbital energy on the order of $1.69\times10^{33}\,\mathrm{J}$. The project estimates average power on the order of $5.35\times10^{21}\,\mathrm{W}$ over 10,000 years and force on the order of $2.2\times10^{17}\,\mathrm{N}$. These are mission-scale requirements, not capabilities demonstrated by the hardware concept.

The momentum ledger distinguishes internal forces, whose equal-and-opposite reactions remain within the Earth system, from external interactions. Internal closed-loop forces do not provide net propulsion to the Earth system. The solar-wind-coupling concept labels the solar wind as an external reaction partner, but its available momentum flux and achievable coupling remain inadequate or unvalidated at the required scale.

### Structural safety-factor estimate

The current browser structural model separates axial thrust from lateral bending. Under its selected design inputs it reports a yield safety factor of approximately **1.61**, above the numerical requirement of 1.5. This result depends on the assumed yield strength of 100 GPa, an effective cross-sectional area of 550,000 m², and a ring-support distribution factor of 125. The ring-support factor is a simplified model parameter, not a result established by a detailed structural load-path analysis.

Consequently, the displayed value is a conditional calculation for the model, not a verified safety factor for a realizable arm. The result does not establish that the structure can be built or that it meets buckling, joint, fatigue, thermal, dynamic, or other applicable criteria. It should be reported as **model passes under stated assumptions; engineering certification not established**.

## Current Demonstration Results

| Measure | Current demonstration / estimate | Interpretation |
|---|---:|---|
| Initial orbit | 1.0 AU | Configured starting orbit |
| Target orbit | 2.70 AU | Configured target radius |
| Time to target | About 8,571 years | Reached in the illustrative continuous-thrust run |
| Required orbital energy | About $1.69\times10^{33}$ J | Mission energy estimate |
| Average power over 10,000 years | About $5.35\times10^{21}$ W | Assumes continuous power delivery |
| Required force | About $2.2\times10^{17}$ N | Approximate mission thrust scale |
| Browser structural yield SF | About 1.61 | Conditional on current model inputs; not certification |
| Solar flux at 2.7 AU | About 187 W/m² | Approximately 86% below the 1 AU value |
| Moon | Bound in the demonstrated run | Numerical result for the modeled initial conditions and forcing |

## Verification

The current JavaScript test suite was run after the frontend structural-model change:

```text
15 tests passed, 0 failed
```

The suite includes orbital and electromagnetic benchmark calculations, energy and momentum-ledger checks, numerical convergence, lunar binding, the simulation snapshot contract, and a structural regression asserting that the configured axial-thrust case reports a safety factor above 1.5.

Passing tests verifies the implemented calculations against their tests. It does not independently validate the physical assumptions, material properties, propulsion performance, or structural design.

## Limitations and Work Remaining

1. **Propulsion feasibility:** The mission-scale force and power are far beyond the demonstrated reference electrodynamic capability. A real external momentum-transfer mechanism and power system are not established.
2. **Structural model:** The support-distribution factor and very large effective section are idealized. Detailed geometry, member-level forces, load combinations, buckling, joints, fatigue, thermal stresses, dynamics, and material allowables require independent engineering analysis.
3. **Planetary safety:** The supplied project materials do not include the full competition safety appendix. Formal compliance therefore remains unverified.
4. **Habitability and heat rejection:** Moving Earth to 2.7 AU sharply reduces solar flux. Artificial heating and its energy source, distribution, and waste-heat rejection are not validated by the trajectory model.
5. **Mission success interpretation:** Reaching the target radius is not equivalent to demonstrating a feasible propulsion system or a safe, habitable planetary transfer.
6. **Documentation consistency:** Some older design and validation documents describe earlier structural assumptions and still state that the design fails. Update them alongside this report before using a single structural result in a submission.

## Conclusion

The project provides an interactive, testable computational framework for exploring the orbital and engineering scales involved in moving Earth outward. Its strongest contribution is the combination of trajectory visualization with explicit energy, momentum, and feasibility checks. The model can produce a target-reaching trajectory under a hypothetical thrust input, but the propulsion mechanism and full structural design remain unproven. The current structural safety-factor result should be presented with its assumptions and limitations, not as evidence that the proposed hardware is safe or buildable.

## Reproduction

From the project root, install the Node dependencies, run the tests, then start the browser interface:

```bash
npm install
npm test
npm run dev
```

The Python/Streamlit analysis is available separately through `app.py`; use the Python dependencies listed in `requirements.txt`.