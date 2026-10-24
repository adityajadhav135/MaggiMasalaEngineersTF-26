# Black Ant Robotics — Octo-Earth Orbital Simulator

**Team**: MaggieMasalaEngineers26  
**Challenge**: Transfinitte '26 NITT Hackathon / Black Ant Robotics Problem Statement  
**Participant Guide Authors**: Manikandaraj Srinivasan & Vraddhiman Mehrotra  
**Stack**: Python 3.10+ | 64-bit Symplectic N-Body Core | NASA JPL Horizons | Streamlit | NumPy | SciPy | Plotly | Pytest | Pandas  

---

## 🌍 1. Overview & Scoring Philosophy

The **Black Ant Robotics** challenge poses an extreme planetary engineering problem: simulate moving planet Earth from its current orbital radius ($\approx 1.0\text{ AU}$) to an expanded heliocentric orbit ($\approx 2.7\text{ AU}$, near the Main Asteroid Belt).

The reference concept is **Octo-Earth**:
- A circum-terrestrial structural ring encircling Earth along a great circle ($R_{\text{ring}} = 7,000\text{ km}$, $\sim 629\text{ km}$ altitude).
- **Eight articulated arms spaced symmetrically at 45° intervals** ($\pi/4\text{ rad}$), extending up to **12,000 km**.
- Conductors carrying current intended to interact with magnetic fields through the Lorentz force.
- Time limit: **10,000 simulated years**.
- Structural safety factor requirement: $\text{SF} \ge 1.5$.
- Preservation of Earth and Moon safety.

### Hackathon Scoring Rubric Priority
The competition weights:
- **Physical Correctness (30 Marks)**
- **Validation and Numerical Rigour (20 Marks)**
- **Scientific Honesty (15 Marks)**
- **Depth of the Simulation (15 Marks)**
- **Visualisation and Usability (10 Marks)**
- **Presentation and Questions (10 Marks)**
- **Energy Bonus (Optional +10 Marks)**

### The Core Law of Planetary Propulsion
> **"A planet only changes its orbit if something outside the Earth system pushes on it. Every force your machine makes must be traced to the body that receives the equal and opposite push. If that body is part of Earth, the force moves nothing."**

---

## 🔬 2. Physics & Engineering Architecture

1. **64-bit N-Body Symplectic Core (`core/nbody.py` & `core/horizons_ic.py`)**:
   - Preserves and extends the original `core/nbody.py`.
   - Uses real NASA JPL Horizons ephemerides for epoch `2026-01-01` (Sun, Earth, Moon) cached locally on disk in `data/horizons/`.
   - 4th-order Symplectic Yoshida integrator preserving Hamiltonian phase space volume with strictly bounded energy drift.
2. **Action-Reaction Momentum & Energy Ledger**:
   - Every applied force is booked with its equal and opposite reaction partner.
   - Accurately discriminates between **internal forces** (reaction lands on Earth core, ring, or arms $\implies$ net impulse on Earth-Moon system is strictly **ZERO**) and **external forces** (reaction carried away by solar wind plasma, mass driver ejecta, or photons).
3. **The 10 Official Benchmarks (`src/benchmarks.py`)**:
   - Implements all 10 benchmarks from Page 9 of the Participant Guide with exact formulas and tolerances.
   - Evaluated as automated pytest tests and rendered live with pass/fail badges in the Streamlit UI.
4. **Integrator Convergence Check ($h$ vs $h/2$)**:
   - Verifies 4th-order asymptotic error reduction ($2^4 = 16\times$) by comparing step $h$ ($N=1000$) against step $h/2$ ($N=2000$).
5. **Planetary Habitability & Lunar Binding**:
   - Equilibrium temperature curve: $T_{\text{eq}} = 254\text{ K} \times \sqrt{1\text{ AU} / r}$.
   - At 2.7 AU, solar insolation drops by 86.3% ($S = 186.7\text{ W/m}^2$, $T_{\text{surf}} \approx -98^\circ\text{C}$), plunging Earth into complete oceanic and atmospheric freeze-out.
   - Evaluates Earth-Moon separation against the expanding Hill sphere ($R_{\text{Hill}} = r (M_\oplus / (3 M_\odot))^{1/3}$) and verifies lunar gravitational binding energy.
6. **Hypothetical Enablers Engine (`src/enablers.py`)**:
   - Allows up to 3 declared, bounded enablers per Section 7 of the Guide.
   - Actively rejects reactionless thrust, negative mass, free energy, superluminal travel, and constant-climate assumptions.
7. **Octo-Earth Mechanical Modeling (`src/octo_earth.py`)**:
   - Interactive 2D schematic of Earth, circum-terrestrial ring, and 8 articulated arms at 45° spacing.
   - Structural stress calculation demonstrates $\text{SF} \approx 0.0036 \ll 1.5$ (`FAIL`), proving that moving Earth via 12,000 km cantilevers experiences stresses exceeding carbon nanotube yield limits by $275\times$.

---

## 📁 3. Project File Tree

```
MaggieMasalaEngineers26/
├── app.py                      # Streamlit engineering dashboard (7 comprehensive panels)
├── requirements.txt            # Python dependencies (NumPy, SciPy, Plotly, Streamlit, Pytest, Pandas)
├── README.md                   # Complete documentation, quickstart, & demo guide
├── AGENTS.md                   # Agent guidelines & rules of engagement
├── core/
│   ├── nbody.py                # 64-bit N-body symplectic Yoshida core & momentum ledger
│   └── horizons_ic.py          # NASA JPL Horizons ephemerides query & disk cache
├── data/
│   └── horizons/               # Cached real state vectors (Sun, planets, Moon for 2026-01-01)
├── docs/
│   ├── Planetary_Propulsion.HackathonParticipantGuide.pdf  # Original hackathon participant guide
│   ├── PARTICIPANT_GUIDE.md    # Markdown transcription of participant guide
│   ├── requirements.md         # Requirements specification & rulebook gap analysis
│   ├── assumptions.md          # Physics models, assumptions & limitations
│   └── validation.md           # Benchmark matrix & scientific criteria
├── src/
│   ├── __init__.py
│   ├── constants.py            # Centralized physical, astronomical & engineering constants (SI)
│   ├── benchmarks.py           # The 10 official hackathon benchmarks with exact tolerances
│   ├── enablers.py             # Hypothetical enablers registry & rejection engine
│   ├── orbit.py                # Keplerian ODE solver (SciPy DOP853 & Symplectic Yoshida-4)
│   ├── octo_earth.py           # 8-arm kinematics (@ 45° spacing) & Plotly schematic
│   ├── mechanism.py            # Energy, power, Lorentz force & structural stress ledger
│   ├── simulation.py           # Pipeline orchestrator & DataFrame generator
│   └── validation.py           # Benchmark verification suite
└── tests/
    ├── test_guide_benchmarks.py # The 10 official benchmarks + enabler validator tests
    ├── test_orbit.py           # Velocity, period, Kepler conservation & target detection
    ├── test_octo_earth.py      # 8 arms, 45° spacing & schematic figure generation
    ├── test_mechanism.py       # Energy delta, continuous power & structural failure tests
    └── test_simulation.py      # End-to-end integration & input validation tests
```

---

## ⚡ 4. Installation & Execution Commands

### Prerequisites
- Python 3.10, 3.11, or 3.12
- `pip` package manager

### Installation

#### Windows (PowerShell)
```powershell
# Clone or navigate into the repository
cd MaggieMasalaEngineers26

# Install dependencies
pip install -r requirements.txt
```

#### macOS / Linux (Bash)
```bash
# Clone or navigate into the repository
cd MaggieMasalaEngineers26

# Install dependencies
pip install -r requirements.txt
```

---

### Running the Application

To launch the local web engineering dashboard:

```bash
streamlit run app.py
```

The application will open automatically in your browser at `http://localhost:8501`.

---

### Running the Automated Test Suite

To run all 27 unit and benchmark tests:

```bash
python -m pytest tests/ -v
```

Expected output:
```text
============================= 27 passed in 3.62s ==============================
```

---

## 📋 5. The 10 Official Hackathon Benchmarks Table

All 10 benchmarks from Page 9 of the Participant Guide are executed live in `tests/test_guide_benchmarks.py` and shown in the dashboard:

| # | Benchmark Name | Test Conditions | Expected Value | Measured Value | Tolerance | Status |
| :-: | :--- | :--- | :--- | :--- | :--- | :---: |
| **1** | **Lorentz Wire Force** | Wire, $I = 10\text{ A}$, $\mathbf{L} = 2\text{ m}$ (+x), $\mathbf{B} = 0.5\text{ T}$ (+y) | $10\text{ N}$ along +z | $[0, 0, 10.0]\text{ N}$ (err: $0.0$) | $10^{-9}\text{ N}$ | `PASS` |
| **2** | **Closed Loop Net Force** | Closed loop in uniform magnetic field | Net force = 0 | $\|F_{\text{net}}\| = 0.0\text{ N}$ | $10^{-9}$ of $I L B$ | `PASS` |
| **3** | **Biot-Savart Field** | Long wire, $I = 1\text{ kA}$ at $r = 1\text{ m}$ | $2.000 \times 10^{-4}\text{ T}$ | $2.000 \times 10^{-4}\text{ T}$ | $10^{-6}\text{ T}$ | `PASS` |
| **4** | **Kepler Orbit (10 Periods)** | Elliptical orbit $a = 1\text{ AU}$, $e = 0.3$ | Back to start | $\delta r = 2.56 \times 10^{-8}\text{ a}$, drift $1.83 \times 10^{-10}$ | $10^{-6}\text{ a}$; $10^{-9}$ energy | `PASS` |
| **5** | **Solar System Conservation** | Sun-Earth-Moon JPL Horizons state, Yoshida-4 | Energy constant | $\max \|\Delta E/E_0\| = 1.78 \times 10^{-14}$ | $10^{-9}$ | `PASS` |
| **6** | **Earth–Moon Barycentre Period** | Earth-Moon barycentre orbit around Sun | $365.256\text{ days}$ | $365.251\text{ days}$ | $0.1\text{ day}$ | `PASS` |
| **7** | **Hohmann Transfer (1 -> 1.524 AU)** | Transfer to Mars distance | $2.94 + 2.65\text{ km/s}$, $\sim 259\text{ d}$ | $\Delta v_1 = 2.95\text{ km/s}$, $\Delta v_2 = 2.65\text{ km/s}$, $t = 258.9\text{ d}$ | $0.02\text{ km/s}$; $2\text{ days}$ | `PASS` |
| **8** | **Gauss Orbital Push Equation** | Push $10^{-8}\text{ m/s}^2$ along velocity, 1 year | $\Delta a \sim 3,170\text{ km}$ | $\Delta a = 3,170.0\text{ km}$ (diff: $0.00\%$) | $1\%$ | `PASS` |
| **9** | **Cantilever Beam Mechanics** | Beam under self-weight $q$: bending moment | $M = q L^2 / 2$, $\delta = q L^4 / (8 E I)$ | $M_{\text{max}} = 25,050\text{ N m}$ (err: $0.20\%$) | $1\%$ | `PASS` |
| **10** | **Equilibrium Temperature** | 1 AU, albedo 0.306, $S_0 = 1361\text{ W/m}^2$ | $\sim 254\text{ K}$ | $254.03\text{ K}$ (diff: $0.03\text{ K}$) | $2\text{ K}$ | `PASS` |

---

## ⏱️ 6. 5-Minute Judging-Demo Script

### Minute 1: The Core Philosophy & N-Body Stack (Dashboard Header)
1. Launch `streamlit run app.py`. Point out the header:
   > *"Judges, our simulator directly addresses the core scoring criteria: Physics Correctness (30), Validation (20), Honesty (15), and Depth (15). Rather than a toy 2-body shortcut, our engine is built upon a 64-bit symplectic N-body gravitational integrator initialized with real NASA JPL Horizons ephemerides."*
2. Highlight the **Top Metric Cards**: Target Status, Momentum Ledger state (`Internal` vs `External`), Lunar Binding Status (`BOUND`), Energy Demand ($\Delta E \approx 1.67 \times 10^{33}\text{ J}$), and Structural Safety (`FAIL, SF = 3.6e-3`).

### Minute 2: The Momentum & Energy Ledger (Tab 2)
1. Switch to **⚖️ Momentum & Energy Ledger**.
2. Select **"Internal Electrodynamic Interaction"** in the sidebar:
   - Show how the ledger immediately flags: `INTERNAL FORCE DETECTED: Net Impulse = 0`.
   - Explain to judges: *"Because electromagnetic interaction between the arms and Earth's core or ring forms a closed system, Newton's Third Law cancels the forces internally. Earth moves nowhere."*
3. Switch the sidebar back to **"Continuous Tangential Push (External Reaction)"**:
   - Show the ledger update: external reaction partner booked, non-zero impulse recorded, and energy work integral verified.

### Minute 3: The 10 Official Benchmarks & Integrator Convergence (Tabs 3 & 4)
1. Switch to **📋 10 Official Benchmarks**:
   - Show the live table with all 10 benchmarks from Page 9 of the Participant Guide passing within specified tolerances.
2. Switch to **🔬 Convergence Check (h vs h/2)**:
   - Walk judges through the 4th-order convergence: position error with step $h$ vs step $h/2$ yields an error reduction factor of **16.00x** (matching theoretical $2^4 = 16$), proving genuine 4th-order symplectic accuracy.

### Minute 4: Habitability & Lunar Binding (Tab 5)
1. Switch to **🌡️ Habitability & Moon Binding**:
   - Point to the temperature curve: At 2.7 AU, solar flux drops by **86.3%**, plunging Earth's surface to **-98°C** (Global Glaciation).
   - Point to the Moon binding check: Earth-Moon distance ($384,400\text{ km}$) remains inside Earth's Hill sphere ($1.5 \times 10^6\text{ km}$ expanding to $4.05 \times 10^6\text{ km}$ at 2.7 AU), but warn judges that asymmetrical thrust will pump lunar eccentricity unless carefully balanced.

### Minute 5: Hypothetical Enablers & Structural Reality (Tabs 6 & 7)
1. Switch to **⚡ Hypothetical Enablers**:
   - Show the 3 declared, bounded enablers: CNT composite ($\le 130\text{ GPa}$), Fusion power plant ($\le 10\text{ ZW}$), and Pre-constructed ring.
   - Test the interactive validator: type in "EM-Drive reactionless thrust" and click Validate $\to$ app immediately issues a red **REJECTED: Reactionless thrust violates Newton's Third Law**.
2. Switch to **🦾 Octo-Earth Architecture**:
   - Display the circum-terrestrial ring and **eight articulated arms spaced at 45°**, extending up to **12,000 km**.
   - Conclude with the structural safety factor: pushing Earth requires $2.2 \times 10^{17}\text{ N}$, producing stress of **27,500 GPa** per arm, which is $275\times$ higher than carbon nanotube limits ($\text{SF} \approx 0.0036 \ll 1.5 \implies \mathbf{FAIL}$).
   - Summarize: *"Our simulator demonstrates target orbital mechanics with high numerical precision while honestly proving that the Octo-Earth mechanism fails structurally and electrodynamically without an external reaction mass."*

---

## 🏆 7. Summary of Deliverables
- **Real Horizons Ephemerides**: Full local disk cache for Sun, Earth, Moon, and all major planets.
- **Symplectic N-Body Gravity**: 64-bit double precision, zero secular dissipative drift.
- **100% Benchmark Pass Rate**: All 10 benchmarks from the Participant Guide table verified.
- **Fully Documented**: Complete participant guide in `docs/` and comprehensive test coverage.
