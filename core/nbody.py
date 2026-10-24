
import numpy as np

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
    mass = np.array([M_SUN, M_EARTH, M_MOON])
    v_earth = np.sqrt(G * (M_SUN + M_EARTH) / AU)
    v_moon_rel = np.sqrt(G * (M_EARTH + M_MOON) / R_MOON)
    pos = np.array([[0.0, 0.0, 0.0],
                    [AU, 0.0, 0.0],
                    [AU + R_MOON, 0.0, 0.0]])
    vel = np.array([[0.0, 0.0, 0.0],
                    [0.0, v_earth, 0.0],
                    [0.0, v_earth + v_moon_rel, 0.0]])
    return (*to_barycentre_frame(pos, vel, mass), mass)


# ---- Benchmark 4: Kepler orbit, a = 1 AU, e = 0.3, 10 periods ----
def kepler_test(steps_per_orbit=2000, stepper=yoshida4_step):
    a, e = AU, 0.3
    m_test = 1.0                                    # negligible mass
    mass = np.array([M_SUN, m_test])
    mu = G * (M_SUN + m_test)
    r_p = a * (1 - e)
    v_p = np.sqrt(mu * (1 + e) / r_p)
    pos = np.array([[0.0, 0.0, 0.0], [r_p, 0.0, 0.0]])
    vel = np.array([[0.0, 0.0, 0.0], [0.0, v_p, 0.0]])
    pos, vel = to_barycentre_frame(pos, vel, mass)
    period = 2 * np.pi * np.sqrt(a ** 3 / mu)
    dt = period / steps_per_orbit
    start = pos[1] - pos[0]
    _, _, es, pos_f, _ = run(pos, vel, mass, dt, 10 * steps_per_orbit, stepper)
    err = np.linalg.norm((pos_f[1] - pos_f[0]) - start) / a
    return err, np.abs(es).max()


if __name__ == "__main__":
    # 1) Kepler benchmark, with a convergence check (h vs h/2)
    for spo in (1000, 2000):
        err, drift = kepler_test(spo)
        print(f"Kepler, {spo} steps/orbit: position error = {err:.2e} a, "
              f"max energy drift = {drift:.2e}")

    # 2) Sun-Earth-Moon baseline, 5 years, 1-hour step
    pos, vel, mass = sun_earth_moon()
    dt = 3600.0
    n = int(5 * YEAR / dt)
    _, _, es, pos_f, vel_f = run(pos, vel, mass, dt, n, yoshida4_step,
                                 record_every=240)
    print(f"\nSun-Earth-Moon, 5 years, dt = 1 h")
    print(f"max relative energy drift = {np.abs(es).max():.2e}")
    p = total_momentum(vel_f, mass)
    print(f"final total momentum = {np.linalg.norm(p):.2e} kg m/s "
          f"(should stay ~0)")