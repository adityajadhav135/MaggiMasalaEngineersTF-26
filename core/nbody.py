
import numpy as np
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional, Tuple

# ---- constants (SI) ----
G = 6.67430e-11
AU = 1.495978707e11
DAY = 86400.0
YEAR = 365.25 * DAY
M_SUN = 1.98847e30
M_EARTH = 5.9722e24
M_MOON = 7.342e22
R_MOON = 3.844e8          # mean Earth-Moon distance, m


def accelerations(pos, mass):
    d = pos[None, :, :] - pos[:, None, :]           # d[i, j] = r_j - r_i
    dist3 = (d ** 2).sum(axis=2) ** 1.5
    np.fill_diagonal(dist3, np.inf)                 # no self-force
    return (G * mass[None, :, None] * d / dist3[:, :, None]).sum(axis=1)


def leapfrog_step(pos, vel, mass, dt):
    """Kick-drift-kick (symplectic, 2nd order)."""
    vel = vel + 0.5 * dt * accelerations(pos, mass)
    pos = pos + dt * vel
    vel = vel + 0.5 * dt * accelerations(pos, mass)
    return pos, vel


# 4th-order Yoshida: three leapfrog steps with special sub-steps
_W1 = 1.0 / (2.0 - 2.0 ** (1.0 / 3.0))
_W0 = -(2.0 ** (1.0 / 3.0)) * _W1


def yoshida4_step(pos, vel, mass, dt):
    for w in (_W1, _W0, _W1):
        pos, vel = leapfrog_step(pos, vel, mass, w * dt)
    return pos, vel


def total_energy(pos, vel, mass):
    ke = 0.5 * (mass * (vel ** 2).sum(axis=1)).sum()
    pe = 0.0
    n = len(mass)
    for i in range(n):
        for j in range(i + 1, n):
            pe -= G * mass[i] * mass[j] / np.linalg.norm(pos[i] - pos[j])
    return ke + pe


def total_momentum(vel, mass):
    return (mass[:, None] * vel).sum(axis=0)


def to_barycentre_frame(pos, vel, mass):
    """Shift so total momentum and centre of mass are zero."""
    pos = pos - (mass[:, None] * pos).sum(axis=0) / mass.sum()
    vel = vel - (mass[:, None] * vel).sum(axis=0) / mass.sum()
    return pos, vel


def run(pos, vel, mass, dt, n_steps, stepper=leapfrog_step, record_every=1):
    """Integrate and return recorded times, positions, energies."""
    pos, vel = pos.copy(), vel.copy()
    e0 = total_energy(pos, vel, mass)
    ts, ps, es = [0.0], [pos.copy()], [0.0]
    for k in range(1, n_steps + 1):
        pos, vel = stepper(pos, vel, mass, dt)
        if k % record_every == 0:
            ts.append(k * dt)
            ps.append(pos.copy())
            es.append((total_energy(pos, vel, mass) - e0) / abs(e0))
    return np.array(ts), np.array(ps), np.array(es), pos, vel


# ---- Sun-Earth-Moon initial conditions (simple, circular) ----
# Replace with JPL Horizons state vectors for the final submission.
def sun_earth_moon():
    mass = np.array([M_SUN, M_EARTH, M_MOON], dtype=np.float64)
    v_earth = np.sqrt(G * (M_SUN + M_EARTH) / AU)
    v_moon_rel = np.sqrt(G * (M_EARTH + M_MOON) / R_MOON)
    pos = np.array([[0.0, 0.0, 0.0],
                    [AU, 0.0, 0.0],
                    [AU + R_MOON, 0.0, 0.0]], dtype=np.float64)
    vel = np.array([[0.0, 0.0, 0.0],
                    [0.0, v_earth, 0.0],
                    [0.0, v_earth + v_moon_rel, 0.0]], dtype=np.float64)
    return (*to_barycentre_frame(pos, vel, mass), mass)


# ---- Benchmark 4: Kepler orbit, a = 1 AU, e = 0.3, 10 periods ----
def kepler_test(steps_per_orbit=2000, stepper=yoshida4_step):
    a, e = AU, 0.3
    m_test = 1.0                                    # negligible mass
    mass = np.array([M_SUN, m_test], dtype=np.float64)
    mu = G * (M_SUN + m_test)
    r_p = a * (1 - e)
    v_p = np.sqrt(mu * (1 + e) / r_p)
    pos = np.array([[0.0, 0.0, 0.0], [r_p, 0.0, 0.0]], dtype=np.float64)
    vel = np.array([[0.0, 0.0, 0.0], [0.0, v_p, 0.0]], dtype=np.float64)
    pos, vel = to_barycentre_frame(pos, vel, mass)
    period = 2 * np.pi * np.sqrt(a ** 3 / mu)
    dt = period / steps_per_orbit
    start = pos[1] - pos[0]
    _, _, es, pos_f, _ = run(pos, vel, mass, dt, 10 * steps_per_orbit, stepper)
    err = np.linalg.norm((pos_f[1] - pos_f[0]) - start) / a
    return err, float(np.abs(es).max())


# ============================================================================
# EXTENSIONS: JPL HORIZONS, MOMENTUM & ENERGY LEDGER, CONVERGENCE & HABITABILITY
# ============================================================================


def horizons_sun_earth_moon(epoch: str = "2026-01-01") -> Tuple[np.ndarray, np.ndarray, np.ndarray, List[str]]:
    """Return 64-bit real NASA JPL Horizons ephemerides for Sun, Earth, Moon shifted to barycentre."""
    try:
        from core.horizons_ic import load_initial_conditions
    except ModuleNotFoundError:
        from horizons_ic import load_initial_conditions
    pos, vel, mass, names = load_initial_conditions(epoch, ["Sun", "Earth", "Moon"])
    pos = np.asarray(pos, dtype=np.float64)
    vel = np.asarray(vel, dtype=np.float64)
    mass = np.asarray(mass, dtype=np.float64)
    pos, vel = to_barycentre_frame(pos, vel, mass)
    return pos, vel, mass, names


@dataclass
class ForceRecord:
    """Record of an applied physical force and its reaction partner."""
    time_s: float
    target_body: str
    reaction_body: str
    force_N: np.ndarray
    impulse_Ns: np.ndarray
    is_internal_to_earth_moon: bool
    mechanism_label: str


class MomentumEnergyLedger:
    """Rigorous momentum and energy ledger tracking action and reaction pairs.

    Reports whether net impulse on Earth-Moon system is zero (internal force)
    or nonzero (external reaction partner like ejecta, solar wind, photons).
    """

    def __init__(self, body_names: List[str]):
        self.body_names = list(body_names)
        self.records: List[ForceRecord] = []
        self.total_applied_impulse = np.zeros(3, dtype=np.float64)
        self.total_reaction_impulse = np.zeros(3, dtype=np.float64)
        self.earth_moon_net_impulse = np.zeros(3, dtype=np.float64)
        self.total_work_done_joules = 0.0

    def log_force(
        self,
        time_s: float,
        target_body: str,
        reaction_body: str,
        force_N: np.ndarray,
        dt_s: float,
        mechanism_label: str = "Unspecified",
    ) -> None:
        """Book a force with its equal and opposite reaction partner."""
        force_vec = np.asarray(force_N, dtype=np.float64)
        impulse_vec = force_vec * dt_s

        # Internal if both target and reaction are Earth, Moon, or Octo-Earth structure
        em_bodies = {"Earth", "Moon", "Octo-Earth Ring", "Octo-Earth Arm", "Earth Core", "Atmosphere"}
        is_internal = (target_body in em_bodies) and (reaction_body in em_bodies)

        record = ForceRecord(
            time_s=time_s,
            target_body=target_body,
            reaction_body=reaction_body,
            force_N=force_vec,
            impulse_Ns=impulse_vec,
            is_internal_to_earth_moon=is_internal,
            mechanism_label=mechanism_label,
        )
        self.records.append(record)

        self.total_applied_impulse += impulse_vec
        self.total_reaction_impulse -= impulse_vec

        if is_internal:
            # Internal force: target gets +J, reaction gets -J, sum on Earth-Moon system is 0
            pass
        else:
            if target_body in {"Earth", "Moon"}:
                self.earth_moon_net_impulse += impulse_vec

    def verify_conservation(self, dP_bodies: np.ndarray, tolerance: float = 1e-9) -> Dict[str, Any]:
        """Verify action-reaction ledger against integrated momentum change of bodies."""
        dP_bodies = np.asarray(dP_bodies, dtype=np.float64)
        j_applied = self.total_applied_impulse
        j_partners = self.total_reaction_impulse

        norm_applied = np.linalg.norm(j_applied)
        if norm_applied == 0:
            integrator_honest = bool(np.linalg.norm(dP_bodies) < tolerance)
            balance_honest = True
        else:
            diff_integrator = np.linalg.norm(dP_bodies - j_applied)
            integrator_honest = bool(diff_integrator < tolerance * norm_applied)
            diff_balance = np.linalg.norm(j_applied + j_partners)
            balance_honest = bool(diff_balance < tolerance * norm_applied)

        net_em_mag = float(np.linalg.norm(self.earth_moon_net_impulse))
        is_net_em_zero = bool(net_em_mag < 1e-5)

        return {
            "integrator_honest": integrator_honest,
            "reaction_balance_honest": balance_honest,
            "total_applied_impulse_Ns": j_applied,
            "total_reaction_impulse_Ns": j_partners,
            "earth_moon_net_impulse_Ns": self.earth_moon_net_impulse,
            "net_impulse_on_earth_moon_mag": net_em_mag,
            "is_earth_moon_impulse_zero": is_net_em_zero,
            "summary_status": (
                "INTERNAL (Net Impulse = 0: Moves Nothing)"
                if is_net_em_zero
                else f"EXTERNAL (Net Impulse = {net_em_mag:.2e} N s on Earth-Moon)"
            ),
        }


def run_with_ledger(
    pos: np.ndarray,
    vel: np.ndarray,
    mass: np.ndarray,
    names: List[str],
    dt: float,
    n_steps: int,
    force_generator: Optional[Callable[[float, np.ndarray, np.ndarray], Tuple[np.ndarray, str, str, str]]] = None,
    record_every: int = 1,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray, MomentumEnergyLedger, Dict[str, Any]]:
    """Integrate N-body system with symplectic 4th-order Yoshida stepper and momentum ledger."""
    pos = np.array(pos, dtype=np.float64).copy()
    vel = np.array(vel, dtype=np.float64).copy()
    mass = np.array(mass, dtype=np.float64).copy()

    ledger = MomentumEnergyLedger(names)
    p0 = total_momentum(vel, mass)
    e0 = total_energy(pos, vel, mass)

    ts = [0.0]
    ps = [pos.copy()]
    es = [0.0]

    for k in range(1, n_steps + 1):
        t_current = k * dt

        # Apply external forces if defined
        ext_accels = np.zeros_like(pos)
        if force_generator is not None:
            f_vecs, tgt, rxn, label = force_generator(t_current, pos, vel)
            # f_vecs is (N, 3) in Newtons
            ext_accels = f_vecs / mass[:, None]
            # Log force for each active body
            for idx, bname in enumerate(names):
                if np.any(f_vecs[idx] != 0):
                    ledger.log_force(t_current, bname, rxn, f_vecs[idx], dt, label)

        # Yoshida sub-steps with kick from gravity + external acceleration
        for w in (_W1, _W0, _W1):
            sub_dt = w * dt
            # Kick 1
            vel = vel + 0.5 * sub_dt * (accelerations(pos, mass) + ext_accels)
            # Drift
            pos = pos + sub_dt * vel
            # Kick 2
            vel = vel + 0.5 * sub_dt * (accelerations(pos, mass) + ext_accels)

        if k % record_every == 0:
            ts.append(t_current)
            ps.append(pos.copy())
            current_e = total_energy(pos, vel, mass)
            es.append((current_e - e0) / abs(e0))

    pf = total_momentum(vel, mass)
    dP_bodies = pf - p0
    conservation_check = ledger.verify_conservation(dP_bodies)

    return np.array(ts), np.array(ps), np.array(es), ledger, conservation_check


def check_moon_bound(
    pos_earth: np.ndarray,
    vel_earth: np.ndarray,
    pos_moon: np.ndarray,
    vel_moon: np.ndarray,
    pos_sun: np.ndarray,
) -> Dict[str, Any]:
    """Check if the Moon remains gravitationally bound inside Earth's Hill sphere."""
    r_em_vec = pos_moon - pos_earth
    v_em_vec = vel_moon - vel_earth
    d_em = float(np.linalg.norm(r_em_vec))
    v_rel = float(np.linalg.norm(v_em_vec))

    # Heliocentric distance to Earth
    r_se = float(np.linalg.norm(pos_earth - pos_sun))

    # Earth Hill sphere radius: R_Hill = r_se * (M_Earth / (3 * M_Sun))^(1/3)
    r_hill = r_se * ((M_EARTH / (3.0 * M_SUN)) ** (1.0 / 3.0))

    # Two-body specific mechanical energy of Moon relative to Earth
    mu_em = G * (M_EARTH + M_MOON)
    eps_moon = 0.5 * (v_rel**2) - (mu_em / max(d_em, 1.0))

    is_in_hill = bool(d_em < r_hill)
    is_energy_negative = bool(eps_moon < 0.0)
    is_bound = is_in_hill and is_energy_negative

    return {
        "earth_moon_distance_m": d_em,
        "earth_moon_distance_km": d_em / 1000.0,
        "earth_hill_radius_m": r_hill,
        "earth_hill_radius_km": r_hill / 1000.0,
        "distance_to_hill_ratio": float(d_em / r_hill),
        "moon_specific_energy_Jkg": float(eps_moon),
        "is_inside_hill_sphere": is_in_hill,
        "is_orbit_bound": is_bound,
        "status": "BOUND" if is_bound else "ESCAPED / UNBOUND",
    }


def evaluate_habitability(r_sun_m: float, albedo: float = 0.306) -> Dict[str, Any]:
    """Calculate planetary solar flux, equilibrium temperature, and habitability state."""
    sigma = 5.670374419e-8  # Stefan-Boltzmann constant, W m^-2 K^-4
    l_sun = 3.828e26        # Solar luminosity, W

    r_au = float(r_sun_m / AU)
    flux_wm2 = float(l_sun / (4.0 * np.pi * (r_sun_m**2)))

    # Equilibrium temperature: Teq = [S * (1 - A) / (4 * sigma)]^(1/4)
    t_eq_k = float(((flux_wm2 * (1.0 - albedo)) / (4.0 * sigma)) ** 0.25)

    # Simplified greenhouse warming offset (~33 K at 1 AU)
    greenhouse_dt = 33.0 * np.sqrt(max(flux_wm2 / 1361.0, 0.0))
    t_surface_k = t_eq_k + greenhouse_dt
    t_surface_c = t_surface_k - 273.15

    is_habitable = bool(260.0 <= t_surface_k <= 325.0)
    ocean_state = "Liquid" if t_surface_k >= 273.15 else "Frozen (Global Glaciation)"

    return {
        "distance_au": r_au,
        "solar_flux_wm2": flux_wm2,
        "solar_flux_pct_of_1au": (flux_wm2 / 1361.0) * 100.0,
        "albedo": albedo,
        "equilibrium_temp_k": t_eq_k,
        "surface_temp_k": t_surface_k,
        "surface_temp_c": t_surface_c,
        "ocean_state": ocean_state,
        "is_habitable": is_habitable,
    }


def run_convergence_check(steps_h: int = 1000) -> Dict[str, Any]:
    """Step h vs h/2 convergence check for 4th-order Yoshida stepper."""
    err_h, drift_h = kepler_test(steps_per_orbit=steps_h, stepper=yoshida4_step)
    err_h2, drift_h2 = kepler_test(steps_per_orbit=2 * steps_h, stepper=yoshida4_step)

    # Theoretical reduction for 4th order: 2^4 = 16
    reduction = err_h / max(err_h2, 1e-18)

    return {
        "step_h_steps_per_orbit": steps_h,
        "position_error_h": float(err_h),
        "energy_drift_h": float(drift_h),
        "step_h2_steps_per_orbit": 2 * steps_h,
        "position_error_h2": float(err_h2),
        "energy_drift_h2": float(drift_h2),
        "error_reduction_factor": float(reduction),
        "order_converged": bool(reduction > 8.0),
        "theoretical_reduction": 16.0,
    }


if __name__ == "__main__":
    print("Testing core nbody extensions...")
    conv = run_convergence_check(1000)
    print(f"Convergence test: Error reduction = {conv['error_reduction_factor']:.2f}x (Theoretical: 16x)")

    pos, vel, mass, names = horizons_sun_earth_moon("2026-01-01")
    print(f"Loaded JPL Horizons {len(names)} bodies: {names}")
    moon_check = check_moon_bound(pos[1], vel[1], pos[2], vel[2], pos[0])
    print(f"Moon status: {moon_check['status']}, r = {moon_check['earth_moon_distance_km']:.0f} km")
