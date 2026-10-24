"""End-to-end integration tests for simulation pipeline and validation matrix."""

import pytest

from src.simulation import OrbitalSimulationPipeline, SimulationConfig


def test_simulation_pipeline_end_to_end():
    """Verify simulation runs from inputs through orbit integration to validation matrix."""
    cfg = SimulationConfig(
        initial_r_au=1.0,
        target_r_au=2.7,
        duration_years=100.0,
        thrust_accel_ms2=2.0e-6,
        thrust_active=True,
        max_steps=200,
        stop_at_target=True,
    )
    pipeline = OrbitalSimulationPipeline(cfg)
    results = pipeline.run()

    assert "orbit" in results
    assert "mechanism" in results
    assert "benchmarks" in results
    assert "dataframe" in results

    # Check dataframe columns
    df = results["dataframe"]
    assert "Time (Years)" in df.columns
    assert "Radius (AU)" in df.columns
    assert "Heliocentric X (AU)" in df.columns
    assert "Heliocentric Y (AU)" in df.columns
    assert len(df) > 10

    # Check benchmarks
    benchmarks = results["benchmarks"]
    assert len(benchmarks) == 10

    # Ensure all statuses are one of PASS, FAIL, NOT VALIDATED, NOT REACHED
    valid_statuses = {"PASS", "FAIL", "NOT VALIDATED", "NOT REACHED"}
    for bm in benchmarks:
        assert bm.status in valid_statuses, f"Unexpected status {bm.status} in {bm.benchmark_id}"

    # Specifically check that BM-08 (Appendix) is NOT VALIDATED
    bm08 = next(b for b in benchmarks if b.benchmark_id == "BM-08")
    assert bm08.status == "NOT VALIDATED"

    # BM-06 (Structural) must be FAIL
    bm06 = next(b for b in benchmarks if b.benchmark_id == "BM-06")
    assert bm06.status == "FAIL"

    # BM-07 (Electrodynamic reaction) must be FAIL
    bm07 = next(b for b in benchmarks if b.benchmark_id == "BM-07")
    assert bm07.status == "FAIL"


def test_simulation_pipeline_invalid_inputs():
    """Verify invalid configurations are rejected with informative errors."""
    # Negative initial radius
    with pytest.raises(ValueError, match="Initial radius must be positive"):
        OrbitalSimulationPipeline(SimulationConfig(initial_r_au=-1.0))

    # Target smaller than initial with thrust
    with pytest.raises(ValueError, match="Target radius .* must be greater"):
        OrbitalSimulationPipeline(SimulationConfig(initial_r_au=2.0, target_r_au=1.0, thrust_accel_ms2=1e-8))

    # Duration exceeding 10,000 years rulebook limit
    with pytest.raises(ValueError, match="Duration exceeds challenge maximum rule"):
        OrbitalSimulationPipeline(SimulationConfig(duration_years=15000.0))

    # Negative thrust acceleration
    with pytest.raises(ValueError, match="Thrust acceleration cannot be negative"):
        OrbitalSimulationPipeline(SimulationConfig(thrust_accel_ms2=-1e-8))

