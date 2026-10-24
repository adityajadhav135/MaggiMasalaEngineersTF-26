/**
 * Articulated arm kinematics and balance mechanics for Octo-Earth.
 * Models 8 arms spaced at 45° intervals on a structural ring around Earth.
 * Evaluates joint angles, segment vectors, tip positions, and center-of-mass balance.
 */

import * as vec3 from './vec3.js';
import { R_EARTH } from './constants.js';

export const OCTO_ARM_COUNT = 8;
export const OCTO_ARM_SPACING_RAD = (2.0 * Math.PI) / OCTO_ARM_COUNT; // 45 degrees (pi/4)

export class OctoArmKinematics {
  /**
   * @param {Object} [params]
   * @param {number} [params.ringRadius=7.0e6] - Mounting ring radius in meters (~629 km altitude)
   * @param {number} [params.maxArmLength=12.0e6] - Total arm length when fully extended (12,000 km)
   * @param {number} [params.segmentCount=3] - Number of articulated links per arm
   */
  constructor({
    ringRadius = 7.0e6,
    maxArmLength = 12.0e6,
    segmentCount = 3,
  } = {}) {
    this.ringRadius = ringRadius;
    this.maxArmLength = maxArmLength;
    this.segmentCount = segmentCount;
    // Segment length fractions (e.g. 50% main spar, 30% forearm, 20% wrist/gripper)
    this.segmentFractions = [0.5, 0.3, 0.2];
  }

  /**
   * Compute geometry of all 8 arms for a given extension factor and ring rotation.
   *
   * @param {number} extensionFraction - Value between 0.0 (stowed) and 1.0 (fully extended)
   * @param {number} [ringRotationRad=0.0] - Azimuthal rotation angle of the ring in radians
   * @param {Array<number>} [armExtensionBiases] - Optional per-arm length biases for asymmetric studies
   * @returns {Object} Arm geometry, joint nodes, tip positions, and center-of-mass balance
   */
  evaluate({
    extensionFraction = 0.8,
    ringRotationRad = 0.0,
    armExtensionBiases = null,
  } = {}) {
    const extClamped = Math.max(0.05, Math.min(1.0, extensionFraction));
    const arms = [];
    const comSum = vec3.create(0, 0, 0);

    for (let i = 0; i < OCTO_ARM_COUNT; i++) {
      const baseAngle = i * OCTO_ARM_SPACING_RAD + ringRotationRad;
      const bias = armExtensionBiases ? (armExtensionBiases[i] || 1.0) : 1.0;
      const effectiveLength = this.maxArmLength * extClamped * bias;

      // Base mount on the ring
      const rootPos = vec3.create(
        this.ringRadius * Math.cos(baseAngle),
        this.ringRadius * Math.sin(baseAngle),
        0.0
      );

      // Links: Link 1 extends radially/forward; Link 2 slightly hinged; Link 3 tipped
      // Articulated joint bend angles:
      const jointAngle1 = (1.0 - extClamped) * 0.4;
      const jointAngle2 = -(1.0 - extClamped) * 0.5;

      const segLengths = this.segmentFractions.map((f) => f * effectiveLength);

      // Node 0: Root on ring
      const nodes = [vec3.clone(rootPos)];

      // Node 1: Shoulder to Elbow
      const angle1 = baseAngle + jointAngle1;
      const elbowPos = vec3.create(
        nodes[0][0] + segLengths[0] * Math.cos(angle1),
        nodes[0][1] + segLengths[0] * Math.sin(angle1),
        0.0
      );
      nodes.push(elbowPos);

      // Node 2: Elbow to Wrist
      const angle2 = angle1 + jointAngle2;
      const wristPos = vec3.create(
        nodes[1][0] + segLengths[1] * Math.cos(angle2),
        nodes[1][1] + segLengths[1] * Math.sin(angle2),
        0.0
      );
      nodes.push(wristPos);

      // Node 3: Wrist to Tip/Gripper
      const angle3 = angle2;
      const tipPos = vec3.create(
        nodes[2][0] + segLengths[2] * Math.cos(angle3),
        nodes[2][1] + segLengths[2] * Math.sin(angle3),
        0.0
      );
      nodes.push(tipPos);

      // Arm center-of-mass (approximate as average of nodes)
      const armCom = vec3.create(
        (nodes[0][0] + nodes[1][0] + nodes[2][0] + nodes[3][0]) / 4.0,
        (nodes[0][1] + nodes[1][1] + nodes[2][1] + nodes[3][1]) / 4.0,
        0.0
      );
      vec3.add(comSum, comSum, armCom);

      arms.push({
        armIndex: i,
        azimuthDeg: (baseAngle * 180.0) / Math.PI,
        root: rootPos,
        nodes,
        tip: tipPos,
        effectiveLength,
        com: armCom,
      });
    }

    // Balance check: Center-of-mass displacement from Earth center
    const systemCom = vec3.create(
      comSum[0] / OCTO_ARM_COUNT,
      comSum[1] / OCTO_ARM_COUNT,
      comSum[2] / OCTO_ARM_COUNT
    );
    const comOffsetMeters = vec3.norm(systemCom);
    const isBalanced = comOffsetMeters < 1.0; // Symmetrical 45 deg spacing balances to < 1 m

    return {
      ringRadius: this.ringRadius,
      ringThickness: 50.0, // meters
      arms,
      systemCom,
      comOffsetMeters,
      isBalanced,
      totalSpanDiameterMeters: 2.0 * (this.ringRadius + this.maxArmLength * extClamped),
    };
  }
}
