# Planetary Propulsion Simulation Hackathon — Participant Guide

*Transcribed from `docs/Planetary_Propulsion.HackathonParticipantGuide.pdf`*  
*Authors: Manikandaraj Srinivasan, Vraddhiman Mehrotra*  
*Hackathon: Transfinitte '26 NITT Hackathon / Black Ant Robotics Challenge*  

---

## The One Idea to Remember
> **A planet only changes its orbit if something outside the Earth system pushes on it. Every force your machine makes must be traced to the body that receives the equal and opposite push. If that body is part of Earth, the force moves nothing.**

---

## 1. The Challenge in One Page
Your team builds a computer simulation of a machine that tries to move Earth to a new orbit, for example from 1 AU out to about 2.7 AU near the asteroid belt, without harming the planet or life on it.

### Reference Concept: Octo-Earth
- A structural ring built around Earth along a great circle.
- Eight articulated arms rooted on the ring at equal 45° spacing, all at the same mounting radius.
- Arms up to about 12,000 km long, with segments, hinges, motors and a gripper at each tip.
- Conductors in the arms carry current that interacts with magnetic fields through the Lorentz force.
- The arms extend together on coordinated trajectories and keep the system balanced.

You may simulate Octo-Earth, change it, or propose another concept that acts on a planet-sized body: a gravity tractor, steered asteroid flybys, a mass driver, a solar sail or mirror array, a magnetic sail.

### Winning Conditions (All Required)
1. **Earth reaches its target orbit**: Within 10,000 simulated years.
2. **Earth stays safe**: Every threshold in the rulebook appendix holds for the whole run.
3. **The structure survives**: Every structural safety factor stays at or above 1.5.
4. **The code is validated**: Every applicable benchmark passes.
5. **The physics is honest**: Every force booked with its reaction; energy and momentum conserved.
6. **No unresolved flags**: Only flags caused by your declared hypothetical enablers are allowed.

*Entries that honestly show their concept failing are still scored and can win other awards.*

---

## 2. The Physics You Need

### 2.1 Gravity and Orbits
Each body accelerates toward every other body. Model at least the Sun, Earth and Moon; adding the planets costs little.
$$a_i = \sum_{j \neq i} \frac{G m_j (r_j - r_i)}{|r_j - r_i|^3}$$

An orbit's size is its semi-major axis $a$, fixed by the specific orbital energy $\varepsilon$. Raising $a$ means adding energy:
$$\varepsilon = \frac{v^2}{2} - \frac{\mu}{r} = -\frac{\mu}{2a}$$
$$\frac{da}{dt} = \frac{2a^2 (v \cdot a_{\text{push}})}{\mu}$$
*(Gauss's planetary equation: tells how fast a small push along the velocity raises the orbit. Use it to check your integrator).*

### 2.2 Momentum and Reaction Forces (Newton's Third Law)
| The arm pushes on... | Reaction lands on... | Moves Earth? |
| :--- | :--- | :--- |
| **Earth's own magnetic field** | Currents in Earth's liquid core | **No: internal** |
| **Another arm, or the ring** | The same structure | **No: internal** |
| **Ionosphere or magnetospheric plasma** | Plasma held by Earth's gravity and field | **Unclear: must be modeled** |
| **Solar wind or interstellar plasma beyond magnetosphere** | Plasma carried away into space | **Yes, if circuit truly closes there** |
| **Sunlight, an asteroid's gravity, ejected mass** | Photons, the asteroid, the ejecta | **Yes** |

### 2.3 The Lorentz Force
$$F = I L \times B \quad \left(\text{integrate } dF = I dl \times B \text{ along each conductor}\right)$$
- Current needs a closed path. A closed loop in a uniform field feels zero net force; only field gradients or an external return path give a net push.
- Evenly spaced arms cancel each other's push in a uniform field. Symmetry that is good for balance is bad for thrust.
- Fields have sources. A field is not a wall to push against; its momentum partner is the current or plasma that carries it.

### 2.4 Structures
$$\sigma = \frac{N}{A} \pm \frac{M c}{I}, \quad \text{safety factor} = \frac{\text{allowable stress}}{\text{actual stress}}, \quad P_{\text{cr}} = \frac{\pi^2 E I}{L^2}$$
- Loads: weight (gravity falls with altitude), Earth's rotation (centrifugal and Coriolis effects), inertia of moving joints, Lorentz forces, heat.
- A column of any material can stand only about $\sigma / (\rho g)$ tall under its own weight (steel: few km; nanotubes: few thousand km).
- A 12,000 km arm is longer than Earth's radius: gravity varies along it and natural vibration periods can be hours or years.

### 2.5 Keeping Earth Habitable
$$S = \frac{L_\odot}{4\pi r^2}, \quad T_{\text{eq}} = \left[\frac{S (1 - A)}{4\sigma}\right]^{1/4} \approx 254\text{ K} \times \left(\frac{1\text{ AU}}{r}\right)^{1/2}$$
At 2.7 AU the equilibrium temperature falls to about 155 K (-118°C), so without artificial heating, the oceans freeze.

### 2.6 Numerical Precision
- Use 64-bit (double) numbers for orbits and fields. Earth's distance from the Sun ($1.5 \times 10^{11}\text{ m}$) resolves to $\sim 3 \times 10^{-5}\text{ m}$ in 64-bit double, but only $\sim 10\text{ km}$ in 32-bit floats.
- Track deviations from unpushed reference orbit (Encke's method) if needed.
- Use a symplectic integrator (Leapfrog, Yoshida-4) for long orbit runs. Halve the time step ($h$ vs $h/2$) and show the answer converges.

---

## 3. The Numbers that Decide Everything
- **Energy to raise Earth-Moon from 1 AU to 2.7 AU**: $\approx 1.7 \times 10^{33}\text{ J}$ ($\Delta E = \frac{\mu m}{2} (1/a_1 - 1/a_2)$)
- **...same in days of Sun's entire output**: $\approx 50\text{ days}$ ($\Delta E / (3.828 \times 10^{26}\text{ W})$)
- **Velocity change, slow spiral**: $\approx 11.6\text{ km/s}$ ($|v_1 - v_2|$)
- **Hohmann transfer (two burns)**: $\approx 6.2 + 4.8\text{ km/s}$
- **Average power to finish within 10,000 years**: $\approx 5.4 \times 10^{21}\text{ W}$ ($5.4\text{ ZW}$)
- **Constant force needed for spiral**: $\approx 2.2 \times 10^{17}\text{ N}$ ($m \Delta v / t$)
- **Lorentz force ($1\text{ MA} \times 12,000\text{ km} \times 5\text{ nT}$)**: $\approx 60\text{ N}$
- **Conclusion**: A concept producing tens of newtons needs about $10^{15}\times$ more force.

---

## 6. The Ten Validation Benchmarks

| # | Test | Expected Value | Tolerance |
| :-: | :--- | :--- | :--- |
| **1** | Wire, $I = 10\text{ A}$, $L = 2\text{ m}$ (+x), $B = 0.5\text{ T}$ (+y) | $10\text{ N}$ along +z | $10^{-9}$ |
| **2** | Closed loop in a uniform field | Net force = 0 | $10^{-9}$ of $I \cdot L \cdot B$ |
| **3** | Long wire, $1\text{ kA}$ at $1\text{ m}$ | $2.000 \times 10^{-4}\text{ T}$ ($\mu_0 I / (2\pi r)$) | $10^{-6}$ |
| **4** | Kepler orbit, $a = 1\text{ AU}$, $e = 0.3$, 10 periods | Back to start | $10^{-6}\text{ a}$; energy $10^{-9}$ |
| **5** | Solar system, 5 years, no push | Energy constant | $10^{-9}$ |
| **6** | Earth–Moon barycentre period | 365.256 days | 0.1 day |
| **7** | Hohmann 1 $\to$ 1.524 AU | $2.94 + 2.65\text{ km/s}$, $\sim 259\text{ days}$ | $0.02\text{ km/s}$; 2 days |
| **8** | Push $10^{-8}\text{ m/s}^2$ along velocity, 1 year | $a$ grows $\sim 3,170\text{ km}$ | 1% |
| **9** | Cantilever under self-weight | $q L^2 / 2$ and $q L^4 / (8 E I)$ | 1% |
| **10** | Equilibrium temperature, 1 AU, albedo 0.306 | $\sim 254\text{ K}$ | 2 K |

---

## 7. Hypothetical Enablers and Energy Bonus
Teams may declare **up to three hypothetical enablers**, each with a stated bound:
- **Allowed when bounded & labeled**:
  - Power source up to stated wattage (waste heat still radiated)
  - Ideal energy storage at stated energy density
  - Ideal nanotube or graphene arms (50–130 GPa)
  - Room-temperature superconductor up to stated current density
  - Ring and arms already built at start
  - Free raw material delivered where needed
  - Bounded external field carried by stated plasma
- **Never allowed (REJECT)**:
  - Reactionless thrust ("a force appears on Earth")
  - Breaking conservation laws (negative mass, free energy, faster than light)
  - Switching off gravity, inertia, or Earth's magnetic field
  - Assuming the outcome ("climate stays constant")
  - Ignoring a load ("arms carry any stress")

