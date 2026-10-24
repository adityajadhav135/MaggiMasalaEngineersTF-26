"""Hypothetical Enablers Management & Validation Engine.

Implements Section 7 of the Hackathon Participant Guide:
Allows up to 3 declared hypothetical enablers, each strictly bounded and labeled.
Enforces automatic rejection of reactionless thrust, conservation-law violations,
and unbounded assumptions.
"""

from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple


@dataclass
class HypotheticalEnabler:
    """A declared hypothetical engineering or physical assumption."""
    enabler_id: str
    name: str
    category: str
    bound_statement: str
    physical_rationale: str
    is_valid: bool = True
    rejection_reason: Optional[str] = None


# Forbidden patterns per Section 7 "Never allowed"
FORBIDDEN_PATTERNS = [
    ("reactionless", "Reactionless thrust violates Newton's Third Law (F_action = -F_reaction)."),
    ("force appears on earth", "Cannot generate unpartnered forces on Earth without a reaction body."),
    ("negative mass", "Negative mass violates positive-energy theorems and conservation laws."),
    ("free energy", "Free energy / perpetual motion violates First Law of Thermodynamics."),
    ("faster than light", "Superluminal travel violates Special Relativity causality."),
    ("switch off gravity", "Gravitational coupling cannot be deactivated."),
    ("no gravity", "Gravity cannot be ignored or switched off."),
    ("zero inertia", "Inertial mass is fundamental to planetary momentum dynamics."),
    ("climate stays constant", "Cannot assume climate constancy when solar flux drops 86% at 2.7 AU."),
    ("infinite stress", "Structural members cannot sustain unbounded stress."),
    ("arms carry any stress", "Ignoring structural load capacity violates mechanics of materials."),
]

ALLOWED_PRESETS = [
    HypotheticalEnabler(
        enabler_id="EN-01",
        name="High-Yield Carbon Nanotube Composite",
        category="Material Science",
        bound_statement="Allowable tensile yield strength bounded at sigma <= 130 GPa (density rho = 1,300 kg/m^3)",
        physical_rationale="Upper theoretical atomic sp2 carbon-carbon bond limit for single-walled nanotube macro-bundles.",
        is_valid=True,
    ),
    HypotheticalEnabler(
        enabler_id="EN-02",
        name="Ultra-High Density Fusion Power Plant",
        category="Power Source",
        bound_statement="Continuous power output bounded at P <= 10^22 Watts (10 ZW), waste heat radiated externally",
        physical_rationale="Gigawatt-to-Zettawatt D-T fusion reactors deployed on orbital platforms radiating into 4 K space.",
        is_valid=True,
    ),
    HypotheticalEnabler(
        enabler_id="EN-03",
        name="Circum-terrestrial Ring Pre-Construction",
        category="Infrastructure",
        bound_statement="Ring and arm anchors assumed fully fabricated and assembled at 7,000 km altitude at t = 0",
        physical_rationale="Bypasses initial launch and assembly logistics; focuses exclusively on orbital transfer mechanics.",
        is_valid=True,
    ),
]


def validate_enabler(name: str, bound: str, rationale: str) -> Tuple[bool, Optional[str]]:
    """Validate a user-declared enabler against participant guide rules."""
    text_to_check = f"{name} {bound} {rationale}".lower()

    if not bound or len(bound.strip()) < 5:
        return False, "Enabler must have an explicit, quantitative numerical bound."

    for pattern, reason in FORBIDDEN_PATTERNS:
        if pattern in text_to_check:
            return False, f"REJECTED: {reason}"

    return True, None


class EnablerRegistry:
    """Manages up to 3 declared enablers for a competition simulation run."""

    def __init__(self, enablers: Optional[List[HypotheticalEnabler]] = None):
        self.enablers: List[HypotheticalEnabler] = []
        if enablers:
            for e in enablers[:3]:
                self.add_enabler(e)

    def add_enabler(self, enabler: HypotheticalEnabler) -> bool:
        """Add an enabler if under 3-item limit and valid."""
        if len(self.enablers) >= 3:
            return False

        valid, reason = validate_enabler(
            enabler.name, enabler.bound_statement, enabler.physical_rationale
        )
        enabler.is_valid = valid
        enabler.rejection_reason = reason
        self.enablers.append(enabler)
        return valid

    def get_summary(self) -> List[Dict[str, Any]]:
        """Return structured summary for UI display."""
        summary = []
        for e in self.enablers:
            summary.append(
                {
                    "id": e.enabler_id,
                    "name": e.name,
                    "category": e.category,
                    "bound": e.bound_statement,
                    "rationale": e.physical_rationale,
                    "valid": e.is_valid,
                    "status": "APPROVED (Bounded)" if e.is_valid else "REJECTED (Illegal)",
                    "rejection_reason": e.rejection_reason,
                }
            )
        return summary

