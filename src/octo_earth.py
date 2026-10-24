"""Octo-Earth Mechanical Architecture & Schematic Modeling.

Defines the circum-terrestrial structural ring and eight articulated robotic/conductor
arms spaced at 45-degree intervals, extending up to 12,000 km.
Generates engineering schematics and kinematic joint coordinates.
"""

from dataclasses import dataclass
from typing import Dict, List, Tuple
import numpy as np
import plotly.graph_objects as go

from src.constants import (
    OCTO_ARM_LENGTH_MAX,
    OCTO_ARM_SPACING_DEG,
    OCTO_NUM_ARMS,
    OCTO_RING_RADIUS,
    R_EARTH,
)


@dataclass
class ArmJoints:
    """Kinematic coordinates for an articulated arm."""
    arm_index: int
    azimuth_deg: float
    base_xy: Tuple[float, float]
    elbow_xy: Tuple[float, float]
    tip_xy: Tuple[float, float]
    total_length_km: float


class OctoEarthModel:
    """Geometric and kinematic representation of the Octo-Earth mechanism."""

    def __init__(
        self,
        ring_radius_km: float = OCTO_RING_RADIUS / 1000.0,
        arm_length_km: float = OCTO_ARM_LENGTH_MAX / 1000.0,
        joint_angle_deg: float = 15.0,
    ):
        if arm_length_km <= 0 or arm_length_km > 20000.0:
            raise ValueError(f"Arm length must be in range (0, 20000] km, got {arm_length_km}")
        if ring_radius_km < (R_EARTH / 1000.0):
            raise ValueError(f"Ring radius ({ring_radius_km} km) must be >= Earth radius ({R_EARTH/1000.0} km)")

        self.r_earth_km = R_EARTH / 1000.0
        self.ring_radius_km = ring_radius_km
        self.arm_length_km = arm_length_km
        self.joint_angle_deg = joint_angle_deg
        self.num_arms = OCTO_NUM_ARMS
        self.arm_spacing_deg = OCTO_ARM_SPACING_DEG

    def compute_arm_kinematics(self) -> List[ArmJoints]:
        """Compute base, elbow, and tip 2D coordinates for all 8 articulated arms."""
        arms: List[ArmJoints] = []
        l1_km = self.arm_length_km * 0.5
        l2_km = self.arm_length_km * 0.5
        joint_rad = np.deg2rad(self.joint_angle_deg)

        for i in range(self.num_arms):
            phi_deg = i * self.arm_spacing_deg
            phi_rad = np.deg2rad(phi_deg)

            # Base coordinates on the circum-terrestrial ring
            bx = self.ring_radius_km * np.cos(phi_rad)
            by = self.ring_radius_km * np.sin(phi_rad)

            # Proximal segment (segment 1: straight radial outward)
            ex = bx + l1_km * np.cos(phi_rad)
            ey = by + l1_km * np.sin(phi_rad)

            # Distal segment (segment 2: articulated by joint_angle)
            # Alternate joint deflection clockwise / counter-clockwise for symmetry
            sign = 1.0 if (i % 2 == 0) else -1.0
            distal_angle = phi_rad + sign * joint_rad
            tx = ex + l2_km * np.cos(distal_angle)
            ty = ey + l2_km * np.sin(distal_angle)

            arms.append(
                ArmJoints(
                    arm_index=i + 1,
                    azimuth_deg=phi_deg,
                    base_xy=(bx, by),
                    elbow_xy=(ex, ey),
                    tip_xy=(tx, ty),
                    total_length_km=self.arm_length_km,
                )
            )

        return arms

    def get_summary_dict(self) -> Dict[str, float]:
        """Return key geometric metrics for logging and UI displays."""
        max_reach_km = self.ring_radius_km + self.arm_length_km
        return {
            "num_arms": self.num_arms,
            "arm_spacing_deg": self.arm_spacing_deg,
            "earth_radius_km": self.r_earth_km,
            "ring_radius_km": self.ring_radius_km,
            "arm_length_km": self.arm_length_km,
            "max_reach_radius_km": max_reach_km,
            "ring_circumference_km": 2.0 * np.pi * self.ring_radius_km,
            "joint_angle_deg": self.joint_angle_deg,
        }


def build_octo_earth_figure(
    ring_radius_km: float = OCTO_RING_RADIUS / 1000.0,
    arm_length_km: float = OCTO_ARM_LENGTH_MAX / 1000.0,
    joint_angle_deg: float = 15.0,
    show_magnetic_field: bool = True,
) -> go.Figure:
    """Generate an interactive Plotly engineering schematic of the Octo-Earth assembly."""
    model = OctoEarthModel(
        ring_radius_km=ring_radius_km,
        arm_length_km=arm_length_km,
        joint_angle_deg=joint_angle_deg,
    )
    arms = model.compute_arm_kinematics()

    fig = go.Figure()

    # 1. Earth Surface Disk
    theta = np.linspace(0, 2 * np.pi, 200)
    earth_x = model.r_earth_km * np.cos(theta)
    earth_y = model.r_earth_km * np.sin(theta)
    fig.add_trace(
        go.Scatter(
            x=earth_x,
            y=earth_y,
            mode="lines",
            fill="toself",
            fillcolor="rgba(30, 144, 255, 0.45)",
            line=dict(color="#1E90FF", width=2),
            name="Earth (R = 6,371 km)",
            hoverinfo="name",
        )
    )

    # 2. Structural Ring
    ring_x = model.ring_radius_km * np.cos(theta)
    ring_y = model.ring_radius_km * np.sin(theta)
    fig.add_trace(
        go.Scatter(
            x=ring_x,
            y=ring_y,
            mode="lines",
            line=dict(color="#FFD700", width=4, dash="solid"),
            name=f"Circum-terrestrial Ring (R = {model.ring_radius_km:,.0f} km)",
            hoverinfo="name",
        )
    )

    # 3. Eight Articulated Arms
    palette = [
        "#00FFCC", "#FF007F", "#00E5FF", "#FF9900",
        "#76FF03", "#D500F9", "#FF1744", "#2979FF"
    ]

    for arm in arms:
        bx, by = arm.base_xy
        ex, ey = arm.elbow_xy
        tx, ty = arm.tip_xy
        color = palette[(arm.arm_index - 1) % len(palette)]

        # Line from base -> elbow -> tip
        fig.add_trace(
            go.Scatter(
                x=[bx, ex, tx],
                y=[by, ey, ty],
                mode="lines+markers",
                line=dict(color=color, width=4),
                marker=dict(size=[6, 7, 9], symbol=["circle", "square", "diamond"], color=color),
                name=f"Arm {arm.arm_index} ({arm.azimuth_deg:.0f}°)",
                hovertemplate=(
                    f"<b>Arm {arm.arm_index}</b><br>"
                    f"Azimuth: {arm.azimuth_deg:.0f}°<br>"
                    f"Length: {arm.total_length_km:,.0f} km<br>"
                    "Base: (%{x:.0f}, %{y:.0f}) km<extra></extra>"
                ),
            )
        )

    # 4. Optional Ambient Magnetic Field Lines (Illustrative IMF Vectors)
    if show_magnetic_field:
        span = model.ring_radius_km + model.arm_length_km * 1.2
        for y_offset in np.linspace(-span * 0.8, span * 0.8, 5):
            fig.add_trace(
                go.Scatter(
                    x=[-span, span],
                    y=[y_offset, y_offset],
                    mode="lines",
                    line=dict(color="rgba(180, 180, 255, 0.25)", width=1, dash="dot"),
                    name="IMF / Magnetosphere Field Vector (B ~ 5 nT)",
                    hoverinfo="skip",
                    showlegend=bool(y_offset == 0.0),
                )
            )

    max_extent = (model.ring_radius_km + model.arm_length_km) * 1.15
    fig.update_layout(
        title=dict(
            text="Octo-Earth Architecture: Circum-Terrestrial Ring & 8 Articulated Arms (@ 45°)",
            font=dict(size=14, color="#E0E6ED"),
        ),
        xaxis=dict(
            title="Geocentric X (km)",
            range=[-max_extent, max_extent],
            zeroline=True,
            zerolinecolor="#444",
            gridcolor="rgba(255,255,255,0.08)",
        ),
        yaxis=dict(
            title="Geocentric Y (km)",
            range=[-max_extent, max_extent],
            scaleanchor="x",
            scaleratio=1,
            zeroline=True,
            zerolinecolor="#444",
            gridcolor="rgba(255,255,255,0.08)",
        ),
        template="plotly_dark",
        margin=dict(l=40, r=40, t=50, b=40),
        legend=dict(orientation="h", yanchor="bottom", y=-0.28, xanchor="center", x=0.5),
        height=520,
    )

    return fig
