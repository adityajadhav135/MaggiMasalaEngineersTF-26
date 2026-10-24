"""Central physical, astronomical, and engineering constants for the simulation.

All base values are maintained in standard SI units (m, kg, s, J, W, T, N).
Conversion helpers and reference mission parameters are provided.
"""

import numpy as np

# ---- Fundamental Astrodynamic & Physical Constants (SI) ----
G: float = 6.67430e-11                  # Gravitational constant, m^3 kg^-1 s^-2
AU: float = 1.495978707e11              # Astronomical Unit, m
DAY: float = 86400.0                    # Standard solar day, s
YEAR: float = 365.25 * DAY              # Julian year, s
SPEED_OF_LIGHT: float = 299792458.0     # Speed of light in vacuum, m/s

# ---- Solar & Planetary Mass / Gravitational Parameters ----
M_SUN: float = 1.98847e30               # Mass of the Sun, kg
M_EARTH: float = 5.9722e24              # Mass of Earth, kg
M_MOON: float = 7.342e22                # Mass of Moon, kg

MU_SUN: float = G * M_SUN               # Solar gravitational parameter, m^3 s^-2 (~1.327124e20)
MU_EARTH: float = G * M_EARTH           # Earth gravitational parameter, m^3 s^-2

# ---- Planetary Dimensions & Distances ----
R_EARTH: float = 6.371e6                # Mean volumetric radius of Earth, m (6,371 km)
R_MOON_ORBIT: float = 3.844e8           # Mean Earth-Moon semi-major axis, m (384,400 km)
SOLAR_LUMINOSITY: float = 3.828e26      # Solar bolometric luminosity, W
SOLAR_CONSTANT_1AU: float = 1361.0      # Solar irradiance at 1 AU, W m^-2

# ---- Space Environment at 1 AU ----
B_INTERPLANETARY: float = 5.0e-9        # Interplanetary Magnetic Field (IMF) at 1 AU, Tesla (5 nT)
P_SOLAR_WIND_DYN: float = 2.0e-9        # Solar wind dynamic pressure at 1 AU, Pascal (2 nPa)

# ---- Mission Reference Parameters (Black Ant Robotics Challenge) ----
ORBIT_INITIAL_AU_DEFAULT: float = 1.0   # Initial orbital radius, AU
ORBIT_TARGET_AU_DEFAULT: float = 2.7    # Target orbital radius (Outer Asteroid Belt), AU
MAX_SIMULATED_YEARS: float = 10000.0    # Time limit, simulated years

# ---- Octo-Earth Reference Concept Geometry & Mechanics ----
OCTO_NUM_ARMS: int = 8                  # Exactly 8 articulated arms
OCTO_ARM_SPACING_DEG: float = 45.0      # Symmetrical 45-degree azimuth spacing
OCTO_ARM_SPACING_RAD: float = np.deg2rad(45.0)  # pi / 4 radians
OCTO_ARM_LENGTH_MAX: float = 12.0e6     # Maximum arm length, m (12,000 km)
OCTO_RING_RADIUS: float = 7.0e6         # Ring circumplanetary radius, m (7,000 km, ~629 km altitude)

# ---- Structural Safety Requirements ----
SAFETY_FACTOR_REQUIRED: float = 1.5     # Required minimum safety factor SF >= 1.5
SIGMA_YIELD_CNT: float = 1.0e11         # Theoretical Carbon Nanotube tensile yield, Pa (100 GPa)
SIGMA_YIELD_STEEL: float = 5.0e8        # High-strength structural alloy yield, Pa (500 MPa)
DENSITY_CNT: float = 1300.0             # CNT composite mass density, kg m^-3
DENSITY_STEEL: float = 7800.0           # Structural steel mass density, kg m^-3


def au_to_m(r_au):
    """Convert Astronomical Units to meters (supports scalars and numpy arrays)."""
    return r_au * AU


def m_to_au(r_m):
    """Convert meters to Astronomical Units (supports scalars and numpy arrays)."""
    return r_m / AU


def years_to_s(t_years):
    """Convert Julian years to seconds (supports scalars and numpy arrays)."""
    return t_years * YEAR


def s_to_years(t_seconds):
    """Convert seconds to Julian years (supports scalars and numpy arrays)."""
    return t_seconds / YEAR
