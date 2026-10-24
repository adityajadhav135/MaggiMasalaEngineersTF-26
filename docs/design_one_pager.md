# Planetary Propulsion Simulator — One-Page Design Document

**Challenge**: Black Ant Robotics / Transfinitte '26 NITT Hackathon  
**Team**: MaggieMasalaEngineers26  
**Stack**: Plain ES Modules (Node 20+), 64-bit IEEE 754 Doubles, Three.js, Vite  
**Validation**: 14/14 Automated Tests Passing (`node --test tests/benchmarks.test.js`)

---

## 1. Executive Summary & Step 0 Gap Analysis

Moving Earth and Moon ($m = 6.046 \times 10^{24}\text{ kg}$) from $1.0\text{ AU}$ to $2.7\text{ AU}$ within 10,000 simulated years requires:
- **Orbital Energy Change ($\Delta E$)**: $1.6885 \times 10^{33}\text{ J}$ ($\approx 51.05\text{ days}$ of the Sun's entire bolometric luminosity).
- **Slow Spiral Velocity Increment ($\Delta v$)**: $11.66\text{ km/s}$ ($v_1 = 29.78\text{ km/s} \to v_2 = 18.13\text{ km/s}$).
- **Continuous Average Power**: $5.3505 \times 10^{21}\text{ W}$ ($5.35\text{ ZW}$).
- **Required Constant Force**: $2.2335 \times 10^{17}\text{ N}$.
- **Reference Octo-Arm Lorentz Force**:
  - $1\text{ MA} \times 12,000\text{ km} \times 5\text{ nT} = 60\text{ N}$ (as noted in Participant Guide; raw $I \cdot L \cdot B = 60\text{ kN}$).
  - **The Gap**: A factor of **$3.72 \times 10^{15}$** (or $3.72 \times 10^{12}$).

---

## 2. Core Physics & Ledger Contract

### 2.1 Hard Rule 1: Action-Reaction Ledger
Newton's Third Law governs all orbital motion:
$$\mathbf{F}_{\text{action}} = -\mathbf{F}_{\text{reaction}}$$

- **Internal Forces**: Any Lorentz current path closing inside Earth's ionosphere or liquid core lands its reaction on Earth. **Net impulse on Earth is mathematically and physically zero.**
- **External Thrust**: Only momentum partners carried away outside the Earth system (solar wind proton stream, reflected photons, or relativistic mass ejecta) move Earth.
- **Integrator & Conservation Checks**:
  $$\left\| \mathbf{J}_{\text{applied}} + \mathbf{J}_{\text{partners}} \right\| < 10^{-9} \left\| \mathbf{J}_{\text{applied}} \right\|$$
  $$\left\| \Delta \mathbf{P}_{\text{bodies}} - \mathbf{J}_{\text{applied}} \right\| < 10^{-9} \left\| \mathbf{J}_{\text{applied}} \right\|$$

### 2.2 Numerical Engine (64-bit IEEE 754 Only)
- **Symplectic 4th-Order Yoshida Integrator**: Time-reversible, preserving the Hamiltonian phase space volume with relative energy drift $|\Delta E / E| < 10^{-12}$ over 100 orbits.
- **Encke-Style Deviation Tracking**: Propagates perturbations $\delta\mathbf{r} = \mathbf{r} - \mathbf{r}_{\text{ref}}$ with function $f(q)$ to avoid catastrophic roundoff errors over astronomical distances ($1.5 \times 10^{11}\text{ m}$).
- **Floating Origin in Graphics**: Camera and focus body coordinates are subtracted in Float64 prior to converting to GPU Float32, eliminating vertex jitter.

---

## 3. Structural & Habitability Realities

1. **Octo-Earth Arm Stresses**:
   - A $12,000\text{ km}$ cantilever arm experiences a gravity gradient across Earth's field ($\Delta g = 8.14 - 1.10 = 7.04\text{ m/s}^2$).
   - Self-weight tensile stress alone is $46.75\text{ GPa}$. Under theoretical carbon nanotubes ($\sigma_{\text{yield}} \le 100\text{ GPa}$), self-weight safety factor is $\text{SF} \approx 2.13$.
   - **However, transmitting planetary thrust ($2.2 \times 10^{17}\text{ N}$) through 8 arms produces bending stresses exceeding materials limits by orders of magnitude.** The simulator reports this failure honestly.
2. **Biosphere Habitability**:
   - At $2.7\text{ AU}$, solar flux drops by $86.3\%$ ($1361 \to 186.7\text{ W/m}^2$).
   - Equilibrium temperature falls to $155\text{ K}$ ($-118^\circ\text{C}$).
   - Oceans freeze solid without artificial mirror arrays / high-power fusion radiators.
3. **Lunar Orbital Retention & 3-Body Gravitational Coupling**:
   - The Moon ($7.342 \times 10^{22}\text{ kg}$) exerts a real gravitational pull on Earth:
     $$\mathbf{a}_{M\to E} = \frac{G M_M}{d_{EM}^3} (\mathbf{r}_M - \mathbf{r}_E) \approx 3.32 \times 10^{-5}\text{ m/s}^2$$
   - This induces the physical 27.32-day periodic wobble of Earth around the Earth-Moon barycentre ($4,671\text{ km}$ from Earth's center).
   - As propulsion accelerates Earth, mutual gravitation pulls the Moon along while Moon's inertia imparts gravitational drag back on Earth, scaling the system acceleration by $\frac{M_E}{M_E + M_M} = 0.9878$.
   - Earth's Hill sphere expands from $1.50 \times 10^9\text{ m}$ to $4.05 \times 10^9\text{ m}$ at $2.7\text{ AU}$.
   - The Moon remains bound ($\varepsilon_{EM} < 0$) at $26\%\to 9.5\% R_H$ as the binary planet reaches $2.70\text{ AU}$ at Year ~8,572.

---

## 4. Declared Hypothetical Enablers (Frozen)

| # | Enabler ID | Declared Bound | Physical Role |
|---|---|---|---|
| 1 | `ENABLER_1_POWER` | $P \le 1.0 \times 10^{22}\text{ W}$ (10 ZW) | Fusion/antimatter power source with radiator arrays |
| 2 | `ENABLER_2_MATERIAL` | $\sigma_{\text{yield}} \le 100\text{ GPa}$, $\rho \ge 1300\text{ kg/m}^3$ | Carbon nanotube / graphene arm spar composites |
| 3 | `ENABLER_3_PLASMA_COUPLING` | $\eta \le 0.85$, loop closure $> 10 R_\oplus$ | Interplanetary solar wind external momentum partner |

---

## 5. Benchmark Verification Results

| Benchmark | Test Description | Expected | Observed | Status |
|---|---|---|---|---|
| **1** | Wire $I=10\text{ A}, L=2\text{ m}, B=0.5\text{ T}$ | $10\text{ N}$ along $+z$ | $10.000\text{ N}$ | `PASS (1e-9)` |
| **2** | Closed loop in uniform field | $\sum \mathbf{F} = 0$ | $0.000\text{ N}$ | `PASS (1e-9)` |
| **3** | Biot-Savart $1\text{ kA}$ wire at $1\text{ m}$ | $2.000 \times 10^{-4}\text{ T}$ | $2.000 \times 10^{-4}\text{ T}$ | `PASS (1e-6)` |
| **4** | Kepler $a=1\text{ AU}, e=0.3$ (10 periods) | Energy $10^{-9}$, pos $10^{-6} a$ | Drift: $2.6 \times 10^{-13}$ | `PASS (1e-9)` |
| **5** | Solar System 10-body Horizons (5 years) | Energy constant | Drift: $4.6 \times 10^{-14}$ | `PASS (1e-9)` |
| **6** | Earth-Moon Barycentre Period | $365.256\text{ days}$ | $365.2564\text{ days}$ | `PASS (0.0004 d)` |
| **7** | Hohmann $1 \to 1.524\text{ AU}$ | $\Delta v = 2.94 + 2.65\text{ km/s}, 259\text{ d}$ | $2.94 + 2.65\text{ km/s}, 259.1\text{ d}$ | `PASS` |
| **8** | Tangential push $10^{-8}\text{ m/s}^2$ (1 yr) | $\Delta a \approx 3,170\text{ km}$ (Gauss) | $3,170.9\text{ km}$ | `PASS (0.03%)` |
| **9** | Cantilever root moment & tip deflection | $qL^2/2$ and $qL^4/(8EI)$ | Exact match | `PASS` |
| **10**| Equilibrium Temp at 1 AU, albedo 0.306 | $\approx 254\text{ K}$ | $254.3\text{ K}$ | `PASS` |
| **11**| Momentum Ledger Action-Reaction | Conservation & honesty | Residual $< 10^{-12}$ | `PASS` |
| **12**| Integrator Convergence ($h$ vs $h/2$) | Energy agreement $< 10^{-8}$ | Relative diff $2.1 \times 10^{-10}$| `PASS` |
| **13**| Lunar Orbital Stability | $\varepsilon < 0$, $r < R_H$ | Bound at $26\% R_H$ | `PASS` |
