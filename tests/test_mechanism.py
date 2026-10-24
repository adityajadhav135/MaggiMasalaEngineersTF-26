"""Unit tests for physical mechanism analysis, energy ledger, and structural evaluation."""

import numpy as np
import pytest

from src.constants import (
    AU,
    M_EARTH,
    MU_SUN,
    SAFETY_FACTOR_REQUIRED,
    SIGMA_YIELD_CNT,
)
from src.mechanism import (
    compute_orbital_energy_delta,
    compute_transfer_power_and_thrust,
    evaluate_biosphere_consequences,
    evaluate_electrodynamic_feasibility,
    evaluate_structural_safety,
)


def test_orbital_energy_delta():
    """Verify energy required to raise Earth from 1.0 AU to 2.7 AU is ~1.67e33 Joules."""
    res = compute_orbital_energy_delta(1.0, 2.7)
    delta_e = res["total_energy_joules"]
    # Analytical: M_E * mu / 2 * (1/r0 - 1/rf)
    expected_delta_e = M_EARTH * (MU_SUN / 2.0) * ((1.0 / AU) - (1.0 / (2.7 * AU)))
    assert np.isclose(delta_e, expected_delta_e, rtol=1e-10)
    assert delta_e > 1.6e33
    assert delta_e < 1.8e33
    # Equivalent to ~50.4 days of total Sun luminosity
    assert np.isclose(res["sun_equivalent_days"], 50.4, atol=0.5)


def test_transfer_power_and_thrust():
    """Verify continuous power and required acceleration for a 10,000 year spiral."""
    res = compute_transfer_power_and_thrust(1.0, 2.7, duration_years=10000.0)
    # Power = Delta E / (10000 * YEAR)
    # 1.67e33 / (3.15e11) ~ 5.3e21 W = 5.29 ZW
    assert np.isclose(res["required_continuous_power_ZW"], 5.29, rtol=0.1)
    # Delta-V ~ 11.66 km/s
    assert np.isclose(res["delta_v_kms"], 11.66, atol=0.5)
    # Continuous acceleration ~ 3.7e-8 m/s^2
    assert res["required_acceleration_ms2"] > 3.0e-8
    assert res["required_acceleration_ms2"] < 4.5e-8
    # Total thrust force ~ 2.2e17 N
    assert res["total_thrust_N"] > 1.8e17


def test_electrodynamic_feasibility_deficit():
    """Verify electrodynamic analysis detects petamp requirement and massive deficit."""
    # With ~2.2e17 N required thrust
    res = evaluate_electrodynamic_feasibility(total_thrust_n=2.2e17)
    assert res["is_electrodynamically_feasible"] is False
    assert "FAIL" in res["verdict"]
    # Required current is in peta-amperes (> 1e17 A)
    assert res["required_current_petaamperes"] > 100.0
    # Deficit vs solar wind momentum flux is ~ 10^9
    assert res["force_deficit_ratio"] > 1.0e8


def test_structural_safety_evaluation():
    """Verify structural analysis correctly rejects safety factor SF < 1.5."""
    # Thrust per arm: ~2.75e16 N
    thrust_per_arm = 2.75e16
    res = evaluate_structural_safety(
        thrust_per_arm_n=thrust_per_arm,
        arm_length_m=12.0e6,
        cross_section_m2=1000.0,
        material_yield_pa=SIGMA_YIELD_CNT,
        required_sf=SAFETY_FACTOR_REQUIRED,
    )
    # Stress is ~27,500 GPa, CNT yield is 100 GPa => SF ~ 0.0036 << 1.5
    assert res["passes_structural_safety"] is False
    assert res["calculated_safety_factor"] < 0.05
    assert "FAIL" in res["verdict"]
    assert len(res["missing_structural_modes"]) >= 4


def test_biosphere_consequences():
    """Verify solar insolation drop at 2.7 AU is ~86%."""
    res = evaluate_biosphere_consequences(2.7)
    assert np.isclose(res["insolation_drop_percent"], 86.28, atol=0.5)
    assert res["estimated_surface_temp_c"] < -90.0
