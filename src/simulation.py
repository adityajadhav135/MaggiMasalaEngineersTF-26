"""Simulation Orchestrator & Experiment Execution Pipeline.

Coordinates numerical orbit propagation, physical mechanism analysis,
biosphere impact modeling, and automated benchmark validation.
Generates tabular dataframes ready for CSV export and UI rendering.
"""

from dataclasses import dataclass
from typing import Any, Dict, List, Optional
import numpy as np
import pandas as pd

from src.constants import (
    MAX_SIMULATED_YEARS,
    ORBIT_INITIAL_AU_DEFAULT,
    ORBIT_TARGET_AU_DEFAULT,
    SAFETY_FACTOR_REQUIRED,
)
from src.mechanism import (
    compute_orbital_energy_delta,
    compute_transfer_power_and_thrust,
    evaluate_biosphere_consequences,
    evaluate_electrodynamic_feasibility,
    evaluate_structural_safety,
)
from src.orbit import (
    benchmark_kepler_conservation,
    simulate_orbit_scipy,
)
from src.validation import BenchmarkResult, ValidationSuite


@dataclass
class SimulationConfig:
    """Configuration parameters for a simulation run."""
    initial_r_au: float = ORBIT_INITIAL_AU_DEFAULT
    target_r_au: float = ORBIT_TARGET_AU_DEFAULT
    duration_years: float = 5000.0
    thrust_accel_ms2: float = 4.0e-8
    thrust_active: bool = True
    integrator_method: str = "DOP853"
    max_steps: int = 4000
    rtol: float = 1e-9
    atol: float = 1e-11
    stop_at_target: bool = True


class OrbitalSimulationPipeline:
    """End-to-end pipeline executing the orbital trajectory and physics evaluations."""

    def __init__(self, config: SimulationConfig):
        self.config = config
        self._validate_config()

    def _validate_config(self) -> None:
        """Validate input parameters against physical constraints and rulebook bounds."""
        cfg = self.config
        if cfg.initial_r_au <= 0:
            raise ValueError(f"Initial radius must be positive, got {cfg.initial_r_au} AU.")
        if cfg.target_r_au <= 0:
            raise ValueError(f"Target radius must be positive, got {cfg.target_r_au} AU.")
        if cfg.target_r_au <= cfg.initial_r_au and cfg.thrust_accel_ms2 > 0:
            raise ValueError(
                f"Target radius ({cfg.target_r_au} AU) must be greater than initial radius ({cfg.initial_r_au} AU)."
            )
        if cfg.duration_years <= 0:
            raise ValueError(f"Duration must be strictly positive, got {cfg.duration_years} years.")
        if cfg.duration_years > MAX_SIMULATED_YEARS:
            raise ValueError(
                f"Duration exceeds challenge maximum rule of {MAX_SIMULATED_YEARS:,.0f} years, "
                f"got {cfg.duration_years:,.0f} years."
            )
        if cfg.thrust_accel_ms2 < 0:
            raise ValueError(f"Thrust acceleration cannot be negative, got {cfg.thrust_accel_ms2}")

    def run(self) -> Dict[str, Any]:
        """Execute simulation, run mechanism analysis, and produce benchmark matrix."""
        cfg = self.config

        # 1. Mechanism & Energy Accounting (Decoupled from ODE integrator)
        energy_data = compute_orbital_energy_delta(cfg.initial_r_au, cfg.target_r_au)
        transfer_data = compute_transfer_power_and_thrust(
            cfg.initial_r_au, cfg.target_r_au, cfg.duration_years
        )
        electro_data = evaluate_electrodynamic_feasibility(transfer_data["total_thrust_N"])
        struct_data = evaluate_structural_safety(transfer_data["thrust_per_arm_N"])
        biosphere_data = evaluate_biosphere_consequences(cfg.target_r_au)

        mech_analysis = {
            "energy": energy_data,
            "transfer": transfer_data,
            "electrodynamic_feasibility": electro_data,
            "structural_safety": struct_data,
            "biosphere": biosphere_data,
        }

        # 2. Orbital Trajectory Integration
        effective_thrust = cfg.thrust_accel_ms2 if cfg.thrust_active else 0.0
        orbit_raw = simulate_orbit_scipy(
            r0_au=cfg.initial_r_au,
            target_r_au=cfg.target_r_au,
            duration_years=cfg.duration_years,
            thrust_accel_ms2=effective_thrust,
            max_steps=cfg.max_steps,
            rtol=cfg.rtol,
            atol=cfg.atol,
            method=cfg.integrator_method,
            stop_at_target=cfg.stop_at_target,
        )

        orbit_raw["thrust_active"] = bool(effective_thrust > 0)
        orbit_raw["duration_years"] = cfg.duration_years
        orbit_raw["target_r_au"] = cfg.target_r_au
        orbit_raw["rtol"] = cfg.rtol

        # 3. Automated Benchmark Verification
        validator = ValidationSuite(sim_results=orbit_raw, mech_analysis=mech_analysis)
        benchmarks = validator.run_all_benchmarks()

        # 4. Compile Time-Series DataFrame
        df = pd.DataFrame(
            {
                "Time (Years)": orbit_raw["t_years"],
                "Radius (AU)": orbit_raw["radius_au"],
                "Heliocentric X (AU)": orbit_raw["pos_x_au"],
                "Heliocentric Y (AU)": orbit_raw["pos_y_au"],
                "Velocity (km/s)": orbit_raw["speed_ms"] / 1000.0,
                "Specific Energy (MJ/kg)": orbit_raw["specific_energy_Jkg"] / 1.0e6,
                "Energy Drift (|dE/E0|)": np.abs(orbit_raw["specific_energy_drift"]),
                "Specific Angular Momentum (m^2/s)": orbit_raw["specific_ang_mom"],
                "Angular Momentum Drift (|dh/h0|)": np.abs(orbit_raw["ang_mom_drift"]),
            }
        )

        return {
            "config": cfg,
            "orbit": orbit_raw,
            "mechanism": mech_analysis,
            "benchmarks": benchmarks,
            "dataframe": df,
            "target_reached": orbit_raw["target_reached"],
            "target_time_years": orbit_raw["target_time_years"],
            "final_radius_au": orbit_raw["final_radius_au"],
            "final_semi_major_axis_au": orbit_raw["final_semi_major_axis_au"],
        }

