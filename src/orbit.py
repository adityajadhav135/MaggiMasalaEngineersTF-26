"""Baseline Two-Body Orbital Mechanics & Numerical Integrators.

Models the heliocentric orbital motion of Earth under solar gravity
a = -mu * r_vec / |r|^3 with optional machine thrust acceleration.
Provides both adaptive Runge-Kutta (SciPy solve_ivp) and 4th-order Symplectic Yoshida integrators.
"""

from typing import Callable, Dict, Optional, Tuple, Union
import numpy as np
from scipy.integrate import solve_ivp

from src.constants import (
    AU,
    DAY,
    G,
    M_EARTH,
    M_SUN,
    MU_SUN,
    YEAR,
    au_to_m,
    m_to_au,
    years_to_s,
    s_to_years,
)


def circular_velocity(r_m: float, mu: float = MU_SUN) -> float:
    """Compute circular orbital velocity at radius r_m: v = sqrt(mu / r)."""
    if r_m <= 0:
        raise ValueError(f"Orbital radius must be positive, got {r_m} m.")
    return float(np.sqrt(mu / r_m))


def orbital_period(a_m: float, mu: float = MU_SUN) -> float:
    """Compute Keplerian orbital period: T = 2 * pi * sqrt(a^3 / mu)."""
    if a_m <= 0:
        raise ValueError(f"Semi-major axis must be positive for bound orbit, got {a_m} m.")
    return float(2.0 * np.pi * np.sqrt(a_m**3 / mu))


def specific_orbital_energy(r_vec: np.ndarray, v_vec: np.ndarray, mu: float = MU_SUN) -> float:
    """Compute specific mechanical orbital energy: epsilon = v^2 / 2 - mu / r."""
    r = float(np.linalg.norm(r_vec))
    if r <= 0:
        raise ValueError("Orbital distance must be strictly positive.")
    v_sq = float(np.dot(v_vec, v_vec))
    return 0.5 * v_sq - (mu / r)


def specific_angular_momentum(r_vec: np.ndarray, v_vec: np.ndarray) -> Union[float, np.ndarray]:
    """Compute specific angular momentum vector h = r x v (or scalar z-component in 2D)."""
    r_vec = np.asarray(r_vec, dtype=float)
    v_vec = np.asarray(v_vec, dtype=float)
    if r_vec.shape[-1] == 2:
        return float(r_vec[0] * v_vec[1] - r_vec[1] * v_vec[0])
    return np.cross(r_vec, v_vec)


def semi_major_axis_from_energy(energy: float, mu: float = MU_SUN) -> float:
    """Calculate semi-major axis from specific orbital energy: a = -mu / (2 * epsilon)."""
    if energy >= 0:
        return float(np.inf)
    return float(-mu / (2.0 * energy))


def two_body_ode(
    t: float,
    y: np.ndarray,
    mu: float,
    thrust_func: Optional[Callable[[float, np.ndarray, np.ndarray], np.ndarray]] = None,
) -> np.ndarray:
    """Two-body orbital equations of motion in 2D Cartesian plane: dy/dt = [vx, vy, ax, ay]."""
    r_vec = y[0:2]
    v_vec = y[2:4]
    r = np.linalg.norm(r_vec)
    if r == 0:
        raise ZeroDivisionError("Orbital distance reached zero (singularity).")

    # Standard gravitational acceleration: a_grav = -mu * r_vec / |r|^3
    a_grav = -mu * r_vec / (r**3)

    if thrust_func is not None:
        a_thrust = thrust_func(t, r_vec, v_vec)
        a_total = a_grav + a_thrust
    else:
        a_total = a_grav

    return np.array([v_vec[0], v_vec[1], a_total[0], a_total[1]], dtype=float)


def make_tangential_thrust_func(thrust_accel: float) -> Callable[[float, np.ndarray, np.ndarray], np.ndarray]:
    """Return a thrust acceleration function directed along the instantaneous velocity vector."""
    def thrust_func(t: float, r_vec: np.ndarray, v_vec: np.ndarray) -> np.ndarray:
        v = np.linalg.norm(v_vec)
        if v == 0:
            return np.zeros(2, dtype=float)
        return (thrust_accel * v_vec / v).astype(float)
    return thrust_func


def simulate_orbit_scipy(
    r0_au: float = 1.0,
    target_r_au: float = 2.7,
    duration_years: float = 1000.0,
    thrust_accel_ms2: float = 0.0,
    max_steps: int = 5000,
    rtol: float = 1e-9,
    atol: float = 1e-11,
    method: str = "DOP853",
    stop_at_target: bool = True,
) -> Dict[str, np.ndarray]:
    """Integrate 2D heliocentric orbit using SciPy solve_ivp with target crossing event detection.

    Returns dict containing time series for t, pos, vel, energy, angular_momentum, radius, and metadata.
    """
    if r0_au <= 0:
        raise ValueError(f"Initial radius r0_au must be positive, got {r0_au}")
    if duration_years <= 0:
        raise ValueError(f"Duration must be positive, got {duration_years}")

    r0_m = au_to_m(r0_au)
    v0_m = circular_velocity(r0_m, MU_SUN)
    t_span = (0.0, years_to_s(duration_years))

    # Initial state: on x-axis, velocity along +y axis
    y0 = np.array([r0_m, 0.0, 0.0, v0_m], dtype=float)

    thrust_fn = make_tangential_thrust_func(thrust_accel_ms2) if thrust_accel_ms2 != 0 else None

    # Event detection for reaching target orbit
    target_r_m = au_to_m(target_r_au)

    def target_event(t, y):
        r = np.linalg.norm(y[0:2])
        return r - target_r_m

    target_event.direction = 1.0  # triggered when crossing target outward
    target_event.terminal = bool(stop_at_target)

    t_eval = np.linspace(t_span[0], t_span[1], max_steps)

    try:
        sol = solve_ivp(
            fun=lambda t, y: two_body_ode(t, y, MU_SUN, thrust_fn),
            t_span=t_span,
            y0=y0,
            method=method,
            t_eval=t_eval,
            events=[target_event] if stop_at_target else None,
            rtol=rtol,
            atol=atol,
        )
    except Exception as exc:
        raise RuntimeError(f"Numerical solver failed during integration: {str(exc)}") from exc

    if not sol.success and len(sol.t) <= 1:
        raise RuntimeError(f"Solver terminated prematurely with message: {sol.message}")

    t_arr = sol.t
    pos_x = sol.y[0]
    pos_y = sol.y[1]
    vel_x = sol.y[2]
    vel_y = sol.y[3]

    # Compute derived quantities
    r_arr = np.sqrt(pos_x**2 + pos_y**2)
    v_arr = np.sqrt(vel_x**2 + vel_y**2)
    energies = 0.5 * (v_arr**2) - (MU_SUN / r_arr)
    ang_moms = pos_x * vel_y - pos_y * vel_x

    target_reached = bool(sol.t_events and len(sol.t_events[0]) > 0) or bool(np.any(r_arr >= target_r_m))
    target_time_years = float(s_to_years(sol.t_events[0][0])) if (sol.t_events and len(sol.t_events[0]) > 0) else None

    return {
        "success": sol.success,
        "message": sol.message,
        "t_s": t_arr,
        "t_years": s_to_years(t_arr),
        "pos_x_m": pos_x,
        "pos_y_m": pos_y,
        "pos_x_au": m_to_au(pos_x),
        "pos_y_au": m_to_au(pos_y),
        "vel_x_ms": vel_x,
        "vel_y_ms": vel_y,
        "speed_ms": v_arr,
        "radius_m": r_arr,
        "radius_au": m_to_au(r_arr),
        "specific_energy_Jkg": energies,
        "specific_energy_drift": (energies - energies[0]) / abs(energies[0]),
        "specific_ang_mom": ang_moms,
        "ang_mom_drift": (ang_moms - ang_moms[0]) / abs(ang_moms[0]),
        "target_reached": target_reached,
        "target_time_years": target_time_years,
        "final_radius_au": float(m_to_au(r_arr[-1])),
        "final_semi_major_axis_au": float(m_to_au(semi_major_axis_from_energy(energies[-1]))),
    }


# ---- Symplectic Integrator Implementation (Yoshida 4th Order) ----
_W1 = 1.0 / (2.0 - 2.0 ** (1.0 / 3.0))
_W0 = -(2.0 ** (1.0 / 3.0)) * _W1


def _leapfrog_step_2body(pos: np.ndarray, vel: np.ndarray, mu: float, dt: float) -> Tuple[np.ndarray, np.ndarray]:
    """Kick-drift-kick step for 2D 2-body orbit."""
    r = np.linalg.norm(pos)
    a1 = -mu * pos / (r**3)
    vel = vel + 0.5 * dt * a1
    pos = pos + dt * vel
    r = np.linalg.norm(pos)
    a2 = -mu * pos / (r**3)
    vel = vel + 0.5 * dt * a2
    return pos, vel


def yoshida4_step_2body(pos: np.ndarray, vel: np.ndarray, mu: float, dt: float) -> Tuple[np.ndarray, np.ndarray]:
    """Fourth-order symplectic Yoshida composition."""
    for w in (_W1, _W0, _W1):
        pos, vel = _leapfrog_step_2body(pos, vel, mu, w * dt)
    return pos, vel


def benchmark_kepler_conservation(
    a_au: float = 1.0,
    eccentricity: float = 0.0,
    num_periods: int = 10,
    steps_per_period: int = 2000,
    stepper: Callable = yoshida4_step_2body,
) -> Dict[str, float]:
    """Benchmark Keplerian two-body energy & angular momentum conservation over multiple orbits."""
    a_m = au_to_m(a_au)
    mu = MU_SUN
    period = orbital_period(a_m, mu)
    dt = period / steps_per_period
    total_steps = num_periods * steps_per_period

    # Initial periapsis state
    r_p = a_m * (1.0 - eccentricity)
    v_p = np.sqrt(mu * (1.0 + eccentricity) / r_p)

    pos = np.array([r_p, 0.0], dtype=float)
    vel = np.array([0.0, v_p], dtype=float)

    e0 = specific_orbital_energy(pos, vel, mu)
    h0 = specific_angular_momentum(pos, vel)

    pos_init = pos.copy()
    max_energy_drift = 0.0
    max_h_drift = 0.0

    for step in range(total_steps):
        pos, vel = stepper(pos, vel, mu, dt)
        e = specific_orbital_energy(pos, vel, mu)
        h = specific_angular_momentum(pos, vel)
        drift_e = abs((e - e0) / e0)
        drift_h = abs((h - h0) / h0)
        if drift_e > max_energy_drift:
            max_energy_drift = drift_e
        if drift_h > max_h_drift:
            max_h_drift = drift_h

    pos_error_rel = float(np.linalg.norm(pos - pos_init) / a_m)

    return {
        "max_relative_energy_drift": float(max_energy_drift),
        "max_relative_h_drift": float(max_h_drift),
        "final_position_error_rel": pos_error_rel,
        "initial_energy": float(e0),
        "initial_h": float(h0),
        "num_periods": num_periods,
    }

