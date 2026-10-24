# AGENTS.md — Black Ant Robotics Hackathon Simulator

## 1. Mission

Build a polished, runnable hackathon MVP for the **Black Ant Robotics** software problem statement in the supplied competition brief.

The brief asks for a computer simulation of a concept intended to move Earth from approximately 1 AU to a target orbit such as 2.7 AU, while preserving planetary safety and satisfying the stated checks. The reference concept is **Octo-Earth**: a ring around Earth with eight articulated arms spaced 45° apart, arms up to approximately 12,000 km long, and a proposed current/magnetic-field interaction. The brief also permits alternative concepts. It says the winning condition includes reaching the target orbit within 10,000 simulated years, keeping Earth safe according to the rulebook appendix, maintaining structural safety factor ≥ 1.5, passing applicable benchmarks, and honest physics/energy/momentum accounting. The complete rulebook appendix must be consulted if available.

**Do not claim that a concept physically works unless the implemented model actually supports that conclusion.** If the mechanism model is illustrative or incomplete, label it clearly and explain what is not modelled. A credible failure result is preferable to fabricated success.

## 2. First actions

Before writing code:

1. Inspect the repository and identify existing files, framework, and conventions.
2. Locate and read the original Black Ant Robotics problem statement and any full rulebook/appendix supplied in the repository.
3. Extract the exact must-have requirements and evaluation criteria into `docs/requirements.md`.
4. Make a short implementation plan and then proceed without waiting for approval unless a genuinely blocking ambiguity exists.
5. Prefer a working end-to-end MVP over unnecessary abstractions.

Do not assume requirements that are absent from the supplied brief. Mark assumptions as assumptions.

## 3. Recommended default stack

Use this stack unless the existing repository clearly requires something else:

- Python 3.11 or newer (choose a version compatible with the installed scientific packages).
- Streamlit for the web UI.
- NumPy for vectors and numerical operations.
- SciPy for numerical integration (`scipy.integrate.solve_ivp`).
- Plotly for interactive charts and orbital visualisation.
- Matplotlib only if a static scientific plot is needed.
- pytest for automated tests.

Do not require paid APIs, cloud services, API keys, or external data for the MVP. The app should run locally.

## 4. MVP features

Implement these features in priority order:

### P0 — must work
- A clear title and short explanation of the challenge.
- A selectable simulation concept, with Octo-Earth as the default.
- Configurable initial orbital radius (default approximately 1 AU), target orbital radius (default approximately 2.7 AU), and simulation duration (maximum 10,000 simulated years).
- A numerically integrated baseline orbital model using documented equations and consistent units.
- A visual orbital trajectory and clear initial/target orbit indicators.
- Results/status panel: target reached or not reached, elapsed simulated time, current orbital radius, orbital energy, angular momentum, and model status.
- A transparent assumptions/limitations panel.
- Structural-safety panel showing the implemented estimate and clearly distinguishing a real calculated result from unavailable/not-yet-modelled data.
- Error handling for invalid inputs, integration failures, and numerical blow-ups.
- A README with install/run instructions.
- Tests for orbital baseline behaviour, energy/angular-momentum checks, and target-detection logic.

### P1 — aim to implement if time allows
- A simple Octo-Earth geometry view showing a ring and eight arms at 45° spacing.
- A simplified articulated-arm state/geometry model with clearly documented assumptions.
- A mechanism-force interface/module that is separate from the orbital integrator.
- A safety/constraint event log explaining why a run succeeded, failed, or is inconclusive.
- A downloadable CSV of time-series results.
- A polished, responsive Streamlit layout suitable for a live judging demo.

### P2 — only after P0/P1 are stable
- Additional mechanism concepts.
- Sensitivity-analysis controls.
- A simple 3D view.
- Extra charts or animations.

## 5. Scientific integrity and modelling rules

- Use SI units internally (metres, seconds, kilograms, newtons, joules) or use a clearly documented consistent unit system. If using AU and years for display, convert explicitly.
- Define constants in one module. Do not scatter magic numbers through the code.
- State the coordinate system, initial conditions, and all approximations.
- Use the Sun's gravitational parameter consistently in the two-body baseline.
- For an ideal circular orbit, initialise tangential velocity using `v = sqrt(mu / r)`.
- For the unforced two-body baseline, validate approximate conservation of specific orbital energy `epsilon = v^2/2 - mu/r` and specific angular momentum `h = r × v`.
- Use a numerical integrator with documented tolerances and handle solver failure.
- Do not apply an arbitrary acceleration to Earth and call it a working planetary-moving mechanism.
- If a simplified or hypothetical force is included for demonstrating the UI, label it **illustrative / not physically validated**, show the assumptions, and do not report a real successful mechanism.
- Account for reaction forces and energy/momentum exchange at the model boundary. If external energy or momentum enters the model, explicitly identify the source/sink.
- Do not invent material properties, force capacities, magnetic-field strengths, structural safety factors, or validation results. If values are placeholders, label them as placeholders.
- Do not present a basic axial stress calculation as a complete structural certification. Clearly list unmodelled failure modes such as buckling, bending, fatigue, joints, and dynamic loads.
- Treat the 1.5 safety factor and other competition criteria as requirements to implement only to the extent the actual definitions/data are available. Flag missing appendix definitions.
- The app must never label a run “successful” merely because a graph reaches the target radius. The mechanism, safety checks, and applicable validations must also pass.

## 6. Suggested repository layout

Keep the structure simple and modular:

```text
.
├── app.py
├── requirements.txt
├── README.md
├── AGENTS.md
├── docs/
│   ├── requirements.md
│   ├── assumptions.md
│   └── validation.md
├── src/
│   ├── __init__.py
│   ├── constants.py
│   ├── orbit.py
│   ├── octo_earth.py
│   ├── mechanism.py
│   ├── validation.py
│   └── simulation.py
└── tests/
    ├── test_orbit.py
    ├── test_validation.py
    └── test_simulation.py
```

Adjust if the repository already has a sensible structure; avoid gratuitous restructuring.

## 7. User experience

- Make the interface usable by a judge who has never seen the code.
- Explain what each parameter means and show its units.
- Include an obvious **Run simulation** action.
- Show a progress indicator for long computations.
- Clearly distinguish: `PASS`, `FAIL`, and `NOT VALIDATED`.
- Display warnings close to the result they affect.
- Avoid clutter, fake telemetry, fake success badges, and decorative charts that do not represent computed data.
- Make plots readable, labelled, and unit-aware.
- Include a demo scenario with documented inputs so the team can reproduce the same output live.

## 8. Code quality

- Keep physics calculations out of the Streamlit UI code.
- Use type hints for key functions where practical.
- Use small functions with meaningful names.
- Add docstrings to public functions, especially equations and unit conventions.
- Avoid one giant `app.py` if it makes the model hard to test.
- Add tests for every critical numerical or decision function.
- Never swallow exceptions silently. Show a concise UI error and log enough detail for debugging.
- Pin reasonable dependency ranges in `requirements.txt` once the app runs.
- Do not introduce a database unless a real requirement emerges.
- Do not add LLM/API features to the simulator; they are unnecessary for the core problem.

## 9. Definition of done

The MVP is done when:

1. A fresh user can install dependencies and launch it using the README.
2. The baseline orbital simulation runs reproducibly.
3. The plot and metrics are computed from actual simulation output.
4. Automated tests pass.
5. Inputs are validated and solver failures are handled.
6. Assumptions and limitations are visible in the app and docs.
7. No unsupported claim of physical feasibility or competition compliance is made.
8. The app has a concise demo path suitable for a 5-minute presentation.

## 10. Final response from the coding agent

When implementation is complete, report:
- What was built.
- Files created/changed.
- Exact commands to install, run, and test.
- Tests executed and their actual results.
- Known limitations and any unimplemented competition requirements.
- A 5-minute demo script.
- Any critical missing information from the full competition rulebook.

Do not claim tests passed unless you actually ran them.
