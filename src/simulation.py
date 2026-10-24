"""Constant-stress tapered arm design and safety-factor evaluation.

Design principle
----------------
Each of the N arms carries a tip load F_d (its share of the thrust needed to
change Earth's orbit within the mission time) plus its own weight in Earth's
gravity field. The arm is sized as a constant-stress (uniform-strength) taper:

    A(x) = (F_d / sigma_a) * exp(rho * dPhi(x) / sigma_a),   sigma_a = sigma_y / SF_d
    dPhi(x) = G*M_E * (1/r_base - 1/r(x))

so that axial stress equals sigma_a everywhere and SF = sigma_y / sigma_a = SF_d.

For an off-design tip load F, the section force is F + sigma_a*(A(x) - A_tip)
(the self-weight term is unchanged), giving stress
    sigma(x) = sigma_a + (F - F_d) / A(x)
whose maximum is at the tip (F > F_d) or the root (F < F_d).

Modeled failure mode: axial tension/compression yield only. Not modeled:
buckling, bending, thermal and dynamic effects (see MISSING_MODES).
"""

from dataclasses import dataclass
from typing import Any, Dict
import math

from src.constants import (
    DENSITY_CNT,
    G,
    M_EARTH,
    OCTO_ARM_LENGTH_MAX,
    OCTO_NUM_ARMS,
    OCTO_RING_RADIUS,
    SIGMA_YIELD_CNT,
)

DESIGN_SAFETY_FACTOR = 1.85
REQUIRED_SAFETY_FACTOR = 1.5

MISSING_MODES = [
    "Euler column buckling over the arm span under compressive reaction loads",
    "Transverse Coriolis bending from planetary and orbital rotation",
    "Aero-elastic / magnetohydrodynamic flutter",
    "Terminator thermal-gradient shock",
    "Stress concentration at articulation joints",
]


@dataclass(frozen=True)
class ArmDesign:
    design_load_n: float      # tip load per arm, F_d
    sigma_yield_pa: float
    sigma_allow_pa: float     # sigma_y / SF_d
    safety_factor_design: float
    arm_length_m: float
    density_kgm3: float
    potential_drop_jkg: float  # G*M*(1/r_base - 1/r_tip)
    area_tip_m2: float
    area_root_m2: float
    taper_ratio: float
    mass_kg: float


def design_arm(
    design_load_n: float,
    arm_length_m: float = OCTO_ARM_LENGTH_MAX,
    sigma_yield_pa: float = SIGMA_YIELD_CNT,
    density: float = DENSITY_CNT,
    safety_factor: float = DESIGN_SAFETY_FACTOR,
    r_base_m: float = OCTO_RING_RADIUS,
) -> ArmDesign:
    if not (math.isfinite(design_load_n) and design_load_n > 0):
        raise ValueError("design_load_n must be finite and positive")
    r_tip = r_base_m + arm_length_m
    dphi = G * M_EARTH * (1.0 / r_base_m - 1.0 / r_tip)
    sigma_a = sigma_yield_pa / safety_factor
    a_tip = design_load_n / sigma_a
    taper = math.exp(density * dphi / sigma_a)

    # Mass: integrate A(x)*rho dx numerically (fine trapezoid)
    n = 2000
    mass = 0.0
    prev = None
    for i in range(n + 1):
        r = r_base_m + arm_length_m * i / n
        a = a_tip * math.exp(density * G * M_EARTH * (1.0 / r_base_m - 1.0 / r) / sigma_a)
        if prev is not None:
            mass += 0.5 * (a + prev) * density * (arm_length_m / n)
        prev = a

    return ArmDesign(
        design_load_n=design_load_n,
        sigma_yield_pa=sigma_yield_pa,
        sigma_allow_pa=sigma_a,
        safety_factor_design=safety_factor,
        arm_length_m=arm_length_m,
        density_kgm3=density,
        potential_drop_jkg=dphi,
        area_tip_m2=a_tip,
        area_root_m2=a_tip * taper,
        taper_ratio=taper,
        mass_kg=mass,
    )


def design_from_mission(total_thrust_n: float, num_arms: int = OCTO_NUM_ARMS, **kw) -> ArmDesign:
    """Size one arm from the mission's total thrust requirement (constant a = dv/T)."""
    return design_arm(total_thrust_n / num_arms, **kw)


def evaluate_at_load(design: ArmDesign, load_n: float) -> Dict[str, Any]:
    """Safety factor of the fixed design under an actual tip load.

    Invalid (NaN/inf/negative) loads are rejected, never turned into SF = 0.
    Loads above the design envelope are reported as overload, not hidden.
    """
    if not (isinstance(load_n, (int, float)) and math.isfinite(load_n)) or load_n < 0:
        return {"valid": False, "safety_factor": float("nan"), "status": "INVALID_LOAD"}

    d = design
    if load_n >= d.design_load_n:
        sigma_max = d.sigma_allow_pa + (load_n - d.design_load_n) / d.area_tip_m2
    else:
        sigma_max = d.sigma_allow_pa - (d.design_load_n - load_n) / d.area_root_m2

    sf = d.sigma_yield_pa / sigma_max
    return {
        "valid": True,
        "load_n": load_n,
        "load_fraction_of_design": load_n / d.design_load_n,
        "max_stress_pa": sigma_max,
        "safety_factor": sf,
        "passes": sf >= REQUIRED_SAFETY_FACTOR,
        "status": "OK" if load_n <= d.design_load_n * (1 + 1e-9) else "OVERLOAD",
    }


def proof_report(design: ArmDesign) -> Dict[str, Any]:
    """Step-by-step derivation, intended for the report/presentation."""
    d = design
    at_design = evaluate_at_load(d, d.design_load_n)
    return {
        "steps": [
            f"1. Design load per arm F_d = {d.design_load_n:.3e} N (mission thrust / number of arms).",
            f"2. Allowable stress sigma_a = sigma_yield / SF_d = {d.sigma_yield_pa:.3e} / {d.safety_factor_design} = {d.sigma_allow_pa:.3e} Pa.",
            f"3. Self-weight potential drop along the arm: dPhi = GM(1/r_base - 1/r_tip) = {d.potential_drop_jkg:.3e} J/kg.",
            f"4. Tip area A_tip = F_d / sigma_a = {d.area_tip_m2:.3e} m^2.",
            f"5. Root area A_root = A_tip * exp(rho*dPhi/sigma_a) = {d.area_root_m2:.3e} m^2 (taper {d.taper_ratio:.2f}x).",
            "6. With this area profile the stress at every section equals sigma_a, so SF = sigma_yield / sigma_a.",
            f"7. Result: SF = {at_design['safety_factor']:.3f} (required >= {REQUIRED_SAFETY_FACTOR}).",
            "8. Thrust is constant (a = dv/T), so the load, and therefore SF, stays constant through the transfer.",
        ],
        "safety_factor": at_design["safety_factor"],
        "arm_mass_kg": d.mass_kg,
        "not_modeled": MISSING_MODES,
        "scope_note": "SF applies to axial yield only; the electrodynamic thrust mechanism is assessed separately.",
    }