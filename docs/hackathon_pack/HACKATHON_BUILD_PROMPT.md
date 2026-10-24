# Master Prompt — Build the Black Ant Robotics Hackathon MVP

You are a senior scientific-software engineer, numerical simulation developer, and pragmatic hackathon teammate. Build a polished, runnable MVP for the **Black Ant Robotics** problem statement in the current repository. This is a two-day hackathon: prioritise an end-to-end working demonstration, scientific honesty, reproducibility, and a clean UI over ambitious but unfinished features.

## Context from the challenge

The supplied statement describes a computer simulation of a concept intended to move Earth from approximately 1 AU to an orbit around 2.7 AU. Its reference concept, Octo-Earth, has a ring around Earth and eight articulated arms at 45° spacing, arms up to approximately 12,000 km long, and conductors interacting with magnetic fields. Alternative mechanisms are permitted.

The brief mentions a target-orbit time limit of 10,000 simulated years, Earth-safety requirements defined in a rulebook appendix, structural safety factor ≥ 1.5, applicable benchmark tests, and honest physics/energy/momentum accounting. The brief says that honestly demonstrated failures can still be scored. Do not assume missing details from the appendix; inspect any supplied full rulebook and record gaps.

## First: inspect, plan, implement

1. Inspect the repository and all provided problem-statement/rulebook files.
2. Read `AGENTS.md` if present and obey it.
3. Extract the actual requirements into `docs/requirements.md`.
4. Make a concise plan, then implement the project directly. Do not stop after giving advice or scaffolding.
5. If there is no existing stack, use Python + Streamlit + NumPy + SciPy + Plotly + pytest.
6. Avoid paid services, API keys, cloud requirements, and nonessential dependencies.

## Product to build

Create a local web app with a clear, professional engineering-dashboard design. A judge should be able to launch it, change inputs, run a simulation, understand the outcome, and see the model's assumptions.

### Core user experience
- Project title: “Black Ant Robotics — Octo-Earth Orbital Simulator”.
- Briefly explain the challenge and the distinction between baseline orbital physics and the machine model.
- Sidebar controls for initial orbit (default 1 AU), target orbit (default 2.7 AU), duration (up to 10,000 simulated years), numerical settings, and concept selection if implemented.
- An obvious Run Simulation button and a progress/status indicator.
- Main visualisation: orbital trajectory with Sun, initial orbit, target orbit and simulated path. Use Plotly if practical.
- Metric cards for elapsed simulated time, current orbital radius, orbital energy, angular momentum and target status.
- A results/validation section with `PASS`, `FAIL`, and `NOT VALIDATED` statuses rather than pretending all checks pass.
- A visible assumptions and limitations section.
- If possible within the time, a simple schematic of the ring plus eight arms at 45° spacing and a CSV download of computed time-series data.
- Responsive, readable UI with consistent spacing, useful labels, units, and clear errors.

## Physics and software requirements

### Baseline orbital model
- Implement a transparent two-body baseline: Earth represented as a point mass orbiting a fixed Sun under solar gravity.
- Use consistent units; SI units internally are preferred. Display AU and years where helpful.
- Define constants centrally.
- Use the standard acceleration equation `a = -mu * r_vector / |r|^3`.
- Integrate the state equations with SciPy `solve_ivp` or another justified method.
- For a circular initial orbit use `v = sqrt(mu/r)`.
- Calculate and plot the actual simulated trajectory, specific orbital energy, and specific angular momentum.
- Include tolerances and catch solver failure or invalid states.
- Add automated tests for circular-orbit behaviour, approximate energy/angular-momentum conservation, and target-radius detection.

### Machine model and scientific integrity
- Keep the mechanism model separate from the orbital integrator.
- If time permits, show Octo-Earth's ring and eight arms at 45° spacing and add a documented simplified mechanical state.
- Do not create a fictional force and describe it as a physically valid way to move Earth.
- If you need an illustrative actuation slider to demonstrate UI behaviour, label it explicitly “illustrative, not physically validated”; it must not produce a claim that the mechanism works.
- A genuine mechanism model must explain force generation, reaction forces, energy supply, and momentum transfer. If this cannot be implemented and validated during the hackathon, say so in the UI and docs.
- Do not fabricate material data, force capacities, structural safety factors, benchmark results, or safety passes.
- Do not claim structural safety from a basic stress formula alone. Identify missing structural modes and missing appendix definitions.
- A target radius being reached is not sufficient for overall success. Report target achievement separately from mechanism validity, safety, and benchmark validation.

### Architecture
Use a clean, simple structure, preferably:
- `app.py`
- `src/constants.py`
- `src/orbit.py`
- `src/octo_earth.py`
- `src/mechanism.py`
- `src/validation.py`
- `src/simulation.py`
- `tests/`
- `docs/requirements.md`
- `docs/assumptions.md`
- `docs/validation.md`
- `README.md`
- `requirements.txt`

Do not force this structure if a good existing structure is already present.

## Time-boxed build priorities

### P0 — implement first
1. Runnable Streamlit application.
2. Correct baseline orbital simulation.
3. Interactive trajectory and initial/target orbit display.
4. Computed metrics and visible status.
5. Input validation and error handling.
6. Automated tests.
7. README with exact installation, run and test commands.
8. Clear assumptions/limitations.

### P1 — only after P0 works
1. Octo-Earth ring/eight-arm schematic.
2. Time-series charts for energy and angular momentum.
3. CSV export.
4. Validation/event log.
5. A polished demo scenario.

### P2 — only if there is time
1. Additional concepts.
2. Sensitivity-analysis controls.
3. 3D rendering.
4. Advanced optimisation.

Do not spend the first half of the hackathon polishing CSS or building a 3D animation before the core model runs.

## Testing and final verification

Before finishing:
1. Install dependencies in the available environment if permitted.
2. Run all tests and fix failures.
3. Launch the app or perform an equivalent smoke test if possible.
4. Check that plots are based on computed values.
5. Check invalid inputs and solver failures.
6. Ensure documentation matches the actual implementation.
7. Do not claim tests passed unless they were actually executed.

## Required final handoff

Provide:
- A concise summary of the implementation.
- The project file tree.
- Exact setup/run/test commands for Windows and, if easy, macOS/Linux.
- Actual test results.
- A 5-minute judging-demo script.
- Known limitations and missing competition-rulebook information.
- A list of features that are implemented versus illustrative or not validated.

Start by inspecting the repository, then build the MVP now.
