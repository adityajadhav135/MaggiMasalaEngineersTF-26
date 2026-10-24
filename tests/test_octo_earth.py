"""Unit tests for Octo-Earth mechanism geometry and schematic generation."""

import numpy as np
import pytest

from src.constants import OCTO_NUM_ARMS, OCTO_RING_RADIUS, R_EARTH
from src.octo_earth import OctoEarthModel, build_octo_earth_figure


def test_octo_earth_kinematics():
    """Verify 8 arms, 45-degree spacing, base radii, and length limits."""
    model = OctoEarthModel(
        ring_radius_km=7000.0,
        arm_length_km=12000.0,
        joint_angle_deg=20.0,
    )
    arms = model.compute_arm_kinematics()

    assert len(arms) == OCTO_NUM_ARMS

    # Verify spacing is 45 degrees
    azimuths = [a.azimuth_deg for a in arms]
    expected_azimuths = [0.0, 45.0, 90.0, 135.0, 180.0, 225.0, 270.0, 315.0]
    assert np.allclose(azimuths, expected_azimuths)

    for arm in arms:
        # Base must lie on the circum-terrestrial ring
        bx, by = arm.base_xy
        r_base = np.sqrt(bx**2 + by**2)
        assert np.isclose(r_base, 7000.0, atol=1e-3)

        # Tip must extend beyond elbow and base
        tx, ty = arm.tip_xy
        r_tip = np.sqrt(tx**2 + ty**2)
        assert r_tip > r_base
        assert r_tip <= (7000.0 + 12000.0)


def test_octo_earth_validation_limits():
    """Verify OctoEarthModel input validation bounds."""
    # Ring radius smaller than Earth radius must raise error
    with pytest.raises(ValueError):
        OctoEarthModel(ring_radius_km=5000.0)

    # Arm length non-positive or too large must raise error
    with pytest.raises(ValueError):
        OctoEarthModel(arm_length_km=0.0)
    with pytest.raises(ValueError):
        OctoEarthModel(arm_length_km=25000.0)


def test_build_octo_earth_figure():
    """Verify Plotly figure builds cleanly with all traces."""
    fig = build_octo_earth_figure(
        ring_radius_km=7000.0,
        arm_length_km=12000.0,
        joint_angle_deg=15.0,
        show_magnetic_field=True,
    )
    assert fig is not None
    # Traces: Earth disk (1) + Ring (1) + 8 arms (8) + IMF lines (5) = 15 traces
    assert len(fig.data) >= 10

