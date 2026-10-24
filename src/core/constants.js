/**
 * Physical, astronomical, and engineering constants for the simulation.
 * Strict SI units (m, kg, s, J, W, T, N).
 * 64-bit IEEE 754 precision (standard JS Number).
 */

export const G = 6.67430e-11;               // Gravitational constant, m^3 kg^-1 s^-2
export const AU = 1.495978707e11;           // Astronomical Unit, m
export const DAY = 86400.0;                 // Standard day, s
export const YEAR = 365.25 * DAY;           // Julian year, s
export const SPEED_OF_LIGHT = 299792458.0;  // Speed of light, m/s

// Planetary and solar masses (kg)
export const M_SUN = 1.98847e30;            // Sun mass, kg
export const M_EARTH = 5.9722e24;           // Earth mass, kg
export const M_MOON = 7.342e22;             // Moon mass, kg
export const M_EARTH_MOON = M_EARTH + M_MOON;

// Standard gravitational parameters (m^3 s^-2)
export const MU_SUN = G * M_SUN;            // 1.3271244004193938e20
export const MU_EARTH = G * M_EARTH;        // 3.98600435e14
export const MU_MOON = G * M_MOON;          // 4.9028e12

// Electromagnetism & Radiation
export const MU_0 = 4.0 * Math.PI * 1e-7;   // Permeability of free space, H/m or T*m/A
export const L_SUN = 3.828e26;              // Solar bolometric luminosity, W
export const SIGMA_SB = 5.670374419e-8;     // Stefan-Boltzmann constant, W m^-2 K^-4
export const SOLAR_CONSTANT_1AU = L_SUN / (4.0 * Math.PI * AU * AU); // ~1361.0 W/m^2

// Dimensions and Environment
export const R_EARTH = 6.371e6;             // Earth volumetric mean radius, m
export const R_MOON = 1.7374e6;             // Moon radius, m
export const R_MOON_ORBIT = 3.844e8;        // Earth-Moon mean semi-major axis, m
export const B_IMF_1AU = 5.0e-9;            // Interplanetary magnetic field at 1 AU, Tesla (5 nT)
export const P_SOLAR_WIND_1AU = 2.0e-9;     // Solar wind dynamic pressure at 1 AU, Pa (2 nPa)

// Reference mission parameters
export const ORBIT_INITIAL_AU = 1.0;        // 1.0 AU
export const ORBIT_TARGET_AU = 2.7;         // 2.7 AU
export const MAX_SIMULATED_YEARS = 10000.0; // 10,000 years limit
export const REQUIRED_SAFETY_FACTOR = 1.5;  // Structural safety factor >= 1.5

// Unit conversion helpers
export const auToM = (au) => au * AU;
export const mToAu = (m) => m / AU;
export const yearsToS = (y) => y * YEAR;
export const sToYears = (s) => s / YEAR;
export const radToDeg = (rad) => (rad * 180.0) / Math.PI;
export const degToRad = (deg) => (deg * Math.PI) / 180.0;
