"""Fetch real initial conditions (position, velocity) from NASA JPL Horizons
and cache them to disk so runs are reproducible and work offline.

Uses only the standard library. Needs internet the first time.

Usage:
    from core.horizons_ic import load_initial_conditions
    pos, vel, mass, names = load_initial_conditions("2026-01-01")
"""
import json
import os
import ssl
import urllib.parse
import urllib.request

try:
    import certifi
    SSL_CONTEXT = ssl.create_default_context(cafile=certifi.where())
except Exception:
    SSL_CONTEXT = ssl._create_unverified_context()

import numpy as np

G = 6.67430e-11
API = "https://ssd.jpl.nasa.gov/api/horizons.api"
CACHE_DIR = "data/horizons"

# name -> (Horizons ID, GM in km^3/s^2)
# Outer planets use system barycentres (IDs 5-8) with the whole system's GM,
# so their moons' mass is included. VERIFY the GM values against the
# Horizons / NASA fact-sheet values before the final submission.
BODIES = {
    "Sun":     ("10",  132712440041.94),
    "Mercury": ("199", 22031.868),
    "Venus":   ("299", 324858.592),
    "Earth":   ("399", 398600.435),
    "Moon":    ("301", 4902.800),
    "Mars":    ("4",   42828.375),
    "Jupiter": ("5",   126712764.8),
    "Saturn":  ("6",   37940585.2),
    "Uranus":  ("7",   5794556.4),
    "Neptune": ("8",   6836527.1),
}


def _query(body_id, epoch):
    """Raw Horizons answer for one body at one epoch (cached)."""
    os.makedirs(CACHE_DIR, exist_ok=True)
    path = os.path.join(CACHE_DIR, f"{body_id}_{epoch}.json")
    if os.path.exists(path):
        with open(path) as f:
            return json.load(f)

    stop = _next_day(epoch)
    params = {
        "format": "json",
        "COMMAND": f"'{body_id}'",
        "OBJ_DATA": "'NO'",
        "MAKE_EPHEM": "'YES'",
        "EPHEM_TYPE": "'VECTORS'",
        "CENTER": "'500@0'",          # solar-system barycentre
        "START_TIME": f"'{epoch}'",
        "STOP_TIME": f"'{stop}'",
        "STEP_SIZE": "'1d'",
        "VEC_TABLE": "'2'",           # state vector (x, y, z, vx, vy, vz)
        "OUT_UNITS": "'KM-S'",
        "CSV_FORMAT": "'YES'",
    }
    url = API + "?" + urllib.parse.urlencode(params)
    try:
        with urllib.request.urlopen(url, timeout=60, context=SSL_CONTEXT) as resp:
            data = json.load(resp)
    except Exception:
        # Fallback for environments with strict intercepting SSL proxies
        unverified_ctx = ssl._create_unverified_context()
        with urllib.request.urlopen(url, timeout=60, context=unverified_ctx) as resp:
            data = json.load(resp)
    with open(path, "w") as f:
        json.dump(data, f)
    return data


def _next_day(epoch):
    from datetime import date, timedelta
    y, m, d = (int(x) for x in epoch.split("-"))
    return (date(y, m, d) + timedelta(days=1)).isoformat()


def parse_state(result_text):
    """Pull [x, y, z, vx, vy, vz] (km, km/s) from the Horizons text block."""
    start = result_text.index("$$SOE")
    end = result_text.index("$$EOE")
    first_line = result_text[start + len("$$SOE"):end].strip().splitlines()[0]
    fields = [f.strip() for f in first_line.split(",")]
    # fields: JDTDB, calendar date, X, Y, Z, VX, VY, VZ, (empty)
    return np.array([float(v) for v in fields[2:8]])


def load_initial_conditions(epoch="2026-01-01", names=None):
    """Return pos (m), vel (m/s), mass (kg), names for the chosen bodies."""
    names = names or list(BODIES)
    pos, vel, mass = [], [], []
    for name in names:
        body_id, gm = BODIES[name]
        state = parse_state(_query(body_id, epoch)["result"])
        pos.append(state[:3] * 1e3)           # km -> m
        vel.append(state[3:] * 1e3)           # km/s -> m/s
        mass.append(gm * 1e9 / G)             # GM (km^3/s^2) -> kg
    return np.array(pos, dtype=np.float64), np.array(vel, dtype=np.float64), np.array(mass, dtype=np.float64), names


if __name__ == "__main__":
    p, v, m, n = load_initial_conditions("2026-01-01", ["Sun", "Earth", "Moon"])
    for name, pi, vi in zip(n, p, v):
        print(f"{name:8s} r = {np.linalg.norm(pi):.6e} m   "
              f"v = {np.linalg.norm(vi):.3f} m/s")
