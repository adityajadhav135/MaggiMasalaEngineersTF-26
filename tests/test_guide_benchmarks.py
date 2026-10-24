"""Automated pytest test suite executing the 10 official hackathon benchmarks.

Directly verifies acceptance criteria and tolerances from Page 9 of
Planetary_Propulsion.HackathonParticipantGuide.pdf.
"""

from src.benchmarks import (
    run_benchmark_1,
    run_benchmark_2,
    run_benchmark_3,
    run_benchmark_4,
    run_benchmark_5,
    run_benchmark_6,
    run_benchmark_7,
    run_benchmark_8,
    run_benchmark_9,
    run_benchmark_10,
)
from src.enablers import ALLOWED_PRESETS, EnablerRegistry, HypotheticalEnabler, validate_enabler


def test_benchmark_1_lorentz_wire():
    """#1: Wire, I = 10 A, L = 2 m (x), B = 0.5 T (y) -> 10 N along +z (tol 10^-9)."""
    rec = run_benchmark_1()
    assert rec.passed is True
    assert rec.details["error"] < 1e-9


def test_benchmark_2_closed_loop():
    """#2: Closed loop in a uniform field -> Net force 0 (tol 10^-9 of I*L*B)."""
    rec = run_benchmark_2()
    assert rec.passed is True
    assert rec.details["error"] < rec.details["tolerance"]


def test_benchmark_3_biot_savart():
    """#3: Long wire, 1 kA at 1 m -> 2.000 * 10^-4 T (tol 10^-6)."""
    rec = run_benchmark_3()
    assert rec.passed is True
    assert rec.details["error"] < 1e-6


def test_benchmark_4_kepler_orbit():
    """#4: Kepler orbit, a = 1 AU, e = 0.3, 10 periods -> Back to start (tol 10^-6 a, energy 10^-9)."""
    rec = run_benchmark_4()
    assert rec.passed is True
    assert rec.details["pos_error_a"] < 1e-6
    assert rec.details["energy_drift"] < 1e-9


def test_benchmark_5_solar_system():
    """#5: Solar system, 5 years, no push -> Energy constant (tol 10^-9)."""
    rec = run_benchmark_5(short_run_steps=2000)
    assert rec.passed is True
    assert rec.details["max_drift"] < 1e-9


def test_benchmark_6_earth_moon_barycentre_period():
    """#6: Earth–Moon barycentre period -> 365.256 days (tol 0.1 day)."""
    rec = run_benchmark_6()
    assert rec.passed is True
    assert rec.details["error_days"] < 0.1


def test_benchmark_7_hohmann_transfer():
    """#7: Hohmann 1 -> 1.524 AU -> 2.94 + 2.65 km/s, ~259 days (tol 0.02 km/s, 2 days)."""
    rec = run_benchmark_7()
    assert rec.passed is True
    assert abs(rec.details["dv1_kms"] - 2.94) <= 0.02
    assert abs(rec.details["dv2_kms"] - 2.65) <= 0.02
    assert abs(rec.details["transfer_days"] - 259.0) <= 2.0


def test_benchmark_8_gauss_push():
    """#8: Push 10^-8 m/s^2 along velocity, 1 year -> a grows ~3,170 km (tol 1%)."""
    rec = run_benchmark_8()
    assert rec.passed is True
    assert rec.details["pct_diff"] <= 1.0


def test_benchmark_9_cantilever():
    """#9: Cantilever under self-weight -> q*L^2 / 2 and q*L^4 / (8*E*I) (tol 1%)."""
    rec = run_benchmark_9()
    assert rec.passed is True
    assert rec.details["error_pct"] <= 1.0


def test_benchmark_10_equilibrium_temp():
    """#10: Equilibrium temperature, 1 AU, albedo 0.306 -> ~254 K (tol 2 K)."""
    rec = run_benchmark_10()
    assert rec.passed is True
    assert rec.details["diff_K"] <= 2.0


def test_enablers_validation_and_rejections():
    """Verify enablers engine accepts bounded items and rejects illegal physics violations."""
    registry = EnablerRegistry()
    for preset in ALLOWED_PRESETS:
        accepted = registry.add_enabler(preset)
        assert accepted is True

    # Reject reactionless thrust
    valid, reason = validate_enabler(
        "EM-Drive", "10 kN thrust with no reaction mass", "reactionless drive"
    )
    assert valid is False
    assert "REJECTED" in reason

    # Reject negative mass
    valid, reason = validate_enabler(
        "Exotic Matter", "negative mass shell", "cancels inertia"
    )
    assert valid is False

    # Reject climate constancy assumption
    valid, reason = validate_enabler(
        "Atmosphere assumption", "climate stays constant", "assumed constant"
    )
    assert valid is False

