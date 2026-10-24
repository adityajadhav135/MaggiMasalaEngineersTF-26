"""Unit tests for baseline orbital mechanics and numerical integrators."""

import numpy as np
import pytest

from src.constants import AU, MU_SUN, YEAR
from src.orbit import (
    benchmark_kepler_conservation,
    circular_velocity,     
    semi_major_axis_from_energy,
    simulate_orbit_scipy,
    specific_angular_momentum,
    specific_orbital_energy, orbital_period
)


def test_circular_velocity():
    """Verify circular velocity at 1 AU matches known value ~29.78 km/s."""
    v0 = circular_velocity(AU, MU_SUN)
    assert np.isclose(v0, 29784.69, atol=1.0)

    # Invalid non-positive radius raises ValueError
    with pytest.raises(ValueError):
        circular_velocity(0.0)
    with pytest.raises(ValueError):
        circular_velocity(-100.0)


def test_orbital_period():
    """Verify orbital period at 1 AU matches ~1 Julian year."""
    t = orbital_period(AU, MU_SUN)
    assert np.isclose(t, YEAR, rtol=1e-2)

    with pytest.raises(ValueError):
        orbital_period(-1.0)


def test_specific_energy_and_angular_momentum():
    """Verify specific energy and angular momentum for standard circular orbit."""
    r_vec = np.array([AU, 0.0])
    v0 = circular_velocity(AU, MU_SUN)
    v_vec = np.array([0.0, v0])

    energy = specific_orbital_energy(r_vec, v_vec, MU_SUN)
    # E = -mu / (2*a)
    expected_energy = -MU_SUN / (2.0 * AU)
    assert np.isclose(energy, expected_energy, rtol=1e-10)

    h = specific_angular_momentum(r_vec, v_vec)
    expected_h = AU * v0
    assert np.isclose(h, expected_h, rtol=1e-10)

    a = semi_major_axis_from_energy(energy, MU_SUN)
    assert np.isclose(a, AU, rtol=1e-10)


def test_kepler_conservation_benchmark():
    """Benchmark BM-01 & BM-02: verify energy and angular momentum conservation over 10 periods."""
    result = benchmark_kepler_conservation(
        a_au=1.0,
        eccentricity=0.0,
        num_periods=10,
        steps_per_period=1000,
    )
    # Symplectic Yoshida-4 drift must be well under 1e-5
    assert result["max_relative_energy_drift"] < 1e-5, (
        f"Energy drift {result['max_relative_energy_drift']} exceeded 1e-5"
    )
    assert result["max_relative_h_drift"] < 1e-5, (
        f"Angular momentum drift {result['max_relative_h_drift']} exceeded 1e-5"
    )
    assert result["final_position_error_rel"] < 1e-3


def test_simulate_orbit_scipy_unperturbed():
    """Verify SciPy solve_ivp conservative propagation for unperturbed orbit."""
    sol = simulate_orbit_scipy(
        r0_au=1.0,
        target_r_au=2.7,
        duration_years=10.0,
        thrust_accel_ms2=0.0,
        max_steps=500,
        method="DOP853",
    )
    assert sol["success"] is True
    # In unperturbed orbit, radius stays at ~1 AU
    assert np.allclose(sol["radius_au"], 1.0, atol=1e-4)
    # Energy drift should be minuscule
    max_drift = np.max(np.abs(sol["specific_energy_drift"]))
    assert max_drift < 1e-6
    # Target 2.7 AU is NOT reached
    assert sol["target_reached"] is False


def test_simulate_orbit_scipy_target_detection():
    """Verify target detection triggers when continuous thrust raises orbit to 2.7 AU."""
    # Use appropriate acceleration to reach 2.7 AU in test duration
    sol = simulate_orbit_scipy(
        r0_au=1.0,
        target_r_au=2.7,
        duration_years=200.0,
        thrust_accel_ms2=5.0e-6,  # fast test acceleration
        max_steps=500,
        method="DOP853",
        stop_at_target=True,
    )
    assert sol["success"] is True
    assert sol["target_reached"] is True
    assert sol["target_time_years"] is not None
    assert sol["final_radius_au"] >= 2.69