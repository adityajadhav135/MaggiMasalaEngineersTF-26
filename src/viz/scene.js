/**
 * Three.js 3D Visualizer (src/viz/scene.js)
 * Clean, high-performance procedural Three.js rendering with floating origin:
 * - Heliocentric Solar System View (Sun, Earth, Moon with lunar orbit, 1.0 AU & 2.7 AU target rings)
 * - Earth & Octo-Ring Close-Up View (Earth globe, atmosphere halo, 7,000 km ring, 8 articulated arms with stress colors, orbiting Moon)
 * - ONLY Sun, Earth, Moon - no other planets or stars
 * - Procedural materials (no glb loading or scaling artifacts)
 * - Starfield background with 1,200 stars
 * - Floating origin: positions calculated in Float64 prior to passing Float32 to GPU
 */

import * as THREE from 'three';
import { AU } from '../core/constants.js';

export class SimulationVisualizer {
  constructor(canvasContainer) {
    this.container = canvasContainer;
    this.viewMode = 'solar'; // 'solar' | 'earth'
    this.AU_UNIT = 20.0; // 1 AU = 20 units in solar view

    this.initThree();
    this.buildSolarSystemScene();
    this.buildEarthOctoScene();

    this.onResize = this.onResize.bind(this);
    window.addEventListener('resize', this.onResize);
  }

  initThree() {
    this.width = this.container.clientWidth || 800;
    this.height = this.container.clientHeight || 550;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x060913);

    this.camera = new THREE.PerspectiveCamera(45, this.width / this.height, 0.1, 5000);
    this.camera.position.set(0, -65, 45);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.container.appendChild(this.renderer.domElement);

    // Procedural starfield background
    this.createStarfield();

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x334466, 1.3);
    this.scene.add(ambientLight);

    const sunPointLight = new THREE.PointLight(0xfffaed, 2.5, 3000);
    sunPointLight.position.set(0, 0, 0);
    this.scene.add(sunPointLight);

    // Mouse drag controls for interactive camera rotation & zoom
    this.isDragging = false;
    this.previousMousePosition = { x: 0, y: 0 };
    this.cameraSpherical = { radius: 75, theta: Math.PI / 4, phi: Math.PI / 3 };

    this.initControls();
  }

  createStarfield() {
    const starCount = 1200;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount * 3; i += 3) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = 900 + Math.random() * 400;

      positions[i] = r * Math.sin(phi) * Math.cos(theta);
      positions[i + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i + 2] = r * Math.cos(phi);
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color: 0x88aacc,
      size: 1.5,
      transparent: true,
      opacity: 0.8,
    });
    const stars = new THREE.Points(geometry, material);
    this.scene.add(stars);
  }

  buildSolarSystemScene() {
    this.solarGroup = new THREE.Group();
    this.scene.add(this.solarGroup);

    // 1. Sun Mesh & Glow Halo (ONLY Sun)
    const sunGeom = new THREE.SphereGeometry(2.5, 32, 32);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xffcc33 });
    this.sunMesh = new THREE.Mesh(sunGeom, sunMat);
    this.solarGroup.add(this.sunMesh);

    const glowGeom = new THREE.SphereGeometry(3.2, 16, 16);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0xffaa00,
      transparent: true,
      opacity: 0.25,
      side: THREE.BackSide,
    });
    this.sunMesh.add(new THREE.Mesh(glowGeom, glowMat));

    // 2. Reference Orbit Rings
    // Initial 1.0 AU orbit ring (blue cyan)
    const ring1Geom = new THREE.RingGeometry(this.AU_UNIT - 0.06, this.AU_UNIT + 0.06, 128);
    const ring1Mat = new THREE.MeshBasicMaterial({
      color: 0x2288ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.45,
    });
    const ring1 = new THREE.Mesh(ring1Geom, ring1Mat);
    this.solarGroup.add(ring1);

    // Target 2.7 AU orbit ring (golden dashed / glowing)
    const ring2Geom = new THREE.RingGeometry(this.AU_UNIT * 2.7 - 0.08, this.AU_UNIT * 2.7 + 0.08, 128);
    const ring2Mat = new THREE.MeshBasicMaterial({
      color: 0xffcc00,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.75,
    });
    const ring2 = new THREE.Mesh(ring2Geom, ring2Mat);
    this.solarGroup.add(ring2);

    // 3. Earth Group in Solar View (ONLY Earth)
    this.solarEarthGroup = new THREE.Group();
    this.solarGroup.add(this.solarEarthGroup);

    const earthGeom = new THREE.SphereGeometry(0.85, 32, 32);
    const earthMat = new THREE.MeshStandardMaterial({
      color: 0x2277cc,
      roughness: 0.5,
      metalness: 0.1,
    });
    this.solarEarthMesh = new THREE.Mesh(earthGeom, earthMat);
    this.solarEarthGroup.add(this.solarEarthMesh);

    // 4. Moon in Solar View (ONLY Moon)
    const moonGeom = new THREE.SphereGeometry(0.3, 16, 16);
    const moonMat = new THREE.MeshStandardMaterial({
      color: 0xaaaaaa,
      roughness: 0.8,
    });
    this.solarMoonMesh = new THREE.Mesh(moonGeom, moonMat);
    this.solarGroup.add(this.solarMoonMesh);

    // Lunar orbit line around Earth in solar view
    const lunarOrbitGeom = new THREE.RingGeometry(1.5 - 0.02, 1.5 + 0.02, 64);
    const lunarOrbitMat = new THREE.MeshBasicMaterial({
      color: 0x8899aa,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
    });
    this.solarLunarOrbitRing = new THREE.Mesh(lunarOrbitGeom, lunarOrbitMat);
    this.solarEarthGroup.add(this.solarLunarOrbitRing);

    // 5. Orbit Trail Line for Trajectory Expansion
    const maxTrailPoints = 600;
    this.trailGeometry = new THREE.BufferGeometry();
    this.trailPositions = new Float32Array(maxTrailPoints * 3);
    this.trailGeometry.setAttribute('position', new THREE.BufferAttribute(this.trailPositions, 3));
    const trailMaterial = new THREE.LineBasicMaterial({
      color: 0x00ffcc,
      transparent: true,
      opacity: 0.85,
    });
    this.trailLine = new THREE.Line(this.trailGeometry, trailMaterial);
    this.solarGroup.add(this.trailLine);
  }

  buildEarthOctoScene() {
    this.earthGroup = new THREE.Group();
    this.scene.add(this.earthGroup);
    this.earthGroup.visible = false;

    // Close-up scale: 1 unit = 1,000 km (1e6 m)
    // Earth radius: 6.371 units
    const rEarthUnits = 6.371;

    // Detailed Earth globe
    const earthGeom = new THREE.SphereGeometry(rEarthUnits, 48, 48);
    const earthMat = new THREE.MeshStandardMaterial({
      color: 0x1a66b8,
      roughness: 0.6,
      metalness: 0.1,
    });
    this.closeEarthMesh = new THREE.Mesh(earthGeom, earthMat);
    this.earthGroup.add(this.closeEarthMesh);

    // Atmosphere halo
    const atmoGeom = new THREE.SphereGeometry(rEarthUnits * 1.04, 32, 32);
    const atmoMat = new THREE.MeshBasicMaterial({
      color: 0x44aaff,
      transparent: true,
      opacity: 0.2,
      side: THREE.BackSide,
    });
    this.closeEarthMesh.add(new THREE.Mesh(atmoGeom, atmoMat));

    // Circum-terrestrial Ring: Radius = 7,000 km = 7.0 units
    const ringGeom = new THREE.TorusGeometry(7.0, 0.12, 16, 64);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0xcccccc,
      metalness: 0.8,
      roughness: 0.2,
    });
    this.ringMesh = new THREE.Mesh(ringGeom, ringMat);
    this.earthGroup.add(this.ringMesh);

    // 8 Articulated Arms at 45° intervals
    this.armMeshes = [];
    for (let i = 0; i < 8; i++) {
      const armGroup = new THREE.Group();
      const segments = [];

      for (let s = 0; s < 3; s++) {
        const segGeom = new THREE.CylinderGeometry(0.12 - s * 0.02, 0.14 - s * 0.02, 1.0, 12);
        const segMat = new THREE.MeshStandardMaterial({
          color: 0x00cc66,
          metalness: 0.5,
          roughness: 0.3,
        });
        const segMesh = new THREE.Mesh(segGeom, segMat);
        segments.push(segMesh);
        armGroup.add(segMesh);
      }

      // Tip Gripper sphere
      const gripGeom = new THREE.SphereGeometry(0.2, 12, 12);
      const gripMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
      const gripMesh = new THREE.Mesh(gripGeom, gripMat);
      armGroup.add(gripMesh);

      this.armMeshes.push({ group: armGroup, segments, tip: gripMesh });
      this.earthGroup.add(armGroup);
    }

    // Moon in close-up scene (Radius: 1.737 units)
    const moonGeom = new THREE.SphereGeometry(1.737, 24, 24);
    const moonMat = new THREE.MeshStandardMaterial({
      color: 0xaaaaaa,
      roughness: 0.8,
    });
    this.closeMoonMesh = new THREE.Mesh(moonGeom, moonMat);
    this.earthGroup.add(this.closeMoonMesh);

    // Lunar orbit ring in close-up
    const closeMoonOrbitGeom = new THREE.RingGeometry(24.0 - 0.04, 24.0 + 0.04, 64);
    const closeMoonOrbitMat = new THREE.MeshBasicMaterial({
      color: 0x667788,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide,
    });
    this.closeMoonOrbitRing = new THREE.Mesh(closeMoonOrbitGeom, closeMoonOrbitMat);
    this.earthGroup.add(this.closeMoonOrbitRing);
  }

  initControls() {
    const el = this.renderer.domElement;

    el.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.previousMousePosition = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      const deltaX = e.clientX - this.previousMousePosition.x;
      const deltaY = e.clientY - this.previousMousePosition.y;

      this.cameraSpherical.theta -= deltaX * 0.008;
      this.cameraSpherical.phi = Math.max(
        0.1,
        Math.min(Math.PI - 0.1, this.cameraSpherical.phi - deltaY * 0.008)
      );

      this.updateCameraPosition();
      this.previousMousePosition = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY > 0 ? 1.08 : 0.92;
      this.cameraSpherical.radius = Math.max(
        5.0,
        Math.min(350.0, this.cameraSpherical.radius * zoomFactor)
      );
      this.updateCameraPosition();
    });
  }

  updateCameraPosition() {
    const r = this.cameraSpherical.radius;
    const theta = this.cameraSpherical.theta;
    const phi = this.cameraSpherical.phi;

    this.camera.position.x = r * Math.sin(phi) * Math.sin(theta);
    this.camera.position.y = -r * Math.cos(phi);
    this.camera.position.z = r * Math.sin(phi) * Math.cos(theta);
    this.camera.lookAt(0, 0, 0);
  }

  setViewMode(mode) {
    this.viewMode = mode;
    if (mode === 'solar') {
      this.solarGroup.visible = true;
      this.earthGroup.visible = false;
      this.cameraSpherical.radius = 75;
      this.cameraSpherical.phi = Math.PI / 3.2;
    } else {
      this.solarGroup.visible = false;
      this.earthGroup.visible = true;
      this.cameraSpherical.radius = 32;
      this.cameraSpherical.phi = Math.PI / 2.5;
    }
    this.updateCameraPosition();
  }

  /**
   * Update visual scene from a simulation snapshot.
   * Floating origin is strictly enforced: relative vectors are converted from Float64.
   *
   * @param {Object} snapshot - Simulation snapshot from sim.snapshot()
   */
  updateFromSnapshot(snapshot) {
    if (!snapshot) return;

    // 1. Solar System View
    const earthPos = snapshot.positions.earth;
    const earthX = (earthPos[0] / AU) * this.AU_UNIT;
    const earthY = (earthPos[1] / AU) * this.AU_UNIT;
    const earthZ = (earthPos[2] / AU) * this.AU_UNIT;

    this.solarEarthGroup.position.set(earthX, earthY, earthZ);

    // Moon position in Solar View (relative to Earth)
    const moonPos = snapshot.positions.moon;
    const relMoonX = (moonPos[0] - earthPos[0]) / 3.844e8;
    const relMoonY = (moonPos[1] - earthPos[1]) / 3.844e8;
    const relMoonZ = (moonPos[2] - earthPos[2]) / 3.844e8;

    // Scaled lunar orbit separation in solar view: 1.5 units
    this.solarMoonMesh.position.set(
      earthX + relMoonX * 1.5,
      earthY + relMoonY * 1.5,
      earthZ + relMoonZ * 1.5
    );

    // Update trajectory history trail
    const history = snapshot.trajectoryHistory || [];
    const count = Math.min(history.length, 600);
    const positions = this.trailPositions;

    for (let i = 0; i < count; i++) {
      positions[i * 3] = history[i].xAU * this.AU_UNIT;
      positions[i * 3 + 1] = history[i].yAU * this.AU_UNIT;
      positions[i * 3 + 2] = history[i].zAU * this.AU_UNIT;
    }
    this.trailGeometry.setDrawRange(0, count);
    this.trailGeometry.attributes.position.needsUpdate = true;

    // 2. Earth-Octo Close-up View (Centered on Earth floating origin)
    if (this.viewMode === 'earth') {
      this.closeEarthMesh.rotation.z += 0.005;

      // Color code arms based on actual structural safety factor:
      // SF >= 1.5: Green (0x00cc66)
      // 1.0 <= SF < 1.5: Amber (0xffbb00)
      // SF < 1.0: Overstress/Rupture Red (0xff1744)
      const sf = snapshot.structure.safetyFactor;
      let armColor = 0x00cc66;
      if (sf < 1.0) {
        armColor = 0xff1744;
      } else if (sf < 1.5) {
        armColor = 0xffbb00;
      }

      // Update 8 arms geometry from kinematics
      const armData = snapshot.kinematics?.arms || [];
      for (let i = 0; i < Math.min(8, armData.length); i++) {
        const arm = armData[i];
        const nodes = arm.nodes;
        const meshObj = this.armMeshes[i];

        // 3 link cylinders between nodes (unit = 1e6 m)
        for (let s = 0; s < 3; s++) {
          const p1 = nodes[s];
          const p2 = nodes[s + 1];

          const v1 = new THREE.Vector3(p1[0] / 1e6, p1[1] / 1e6, p1[2] / 1e6);
          const v2 = new THREE.Vector3(p2[0] / 1e6, p2[1] / 1e6, p2[2] / 1e6);

          const mid = new THREE.Vector3().addVectors(v1, v2).multiplyScalar(0.5);
          const len = v1.distanceTo(v2);

          const segMesh = meshObj.segments[s];
          segMesh.position.copy(mid);
          segMesh.scale.set(1, len, 1);
          segMesh.quaternion.setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            new THREE.Vector3().subVectors(v2, v1).normalize()
          );
          segMesh.material.color.setHex(armColor);
        }

        const tipPos = nodes[3];
        meshObj.tip.position.set(tipPos[0] / 1e6, tipPos[1] / 1e6, tipPos[2] / 1e6);
      }

      // Moon relative position in close-up
      const visualScale = 24.0 / 3.844e8; // scaled to 24 units radius
      this.closeMoonMesh.position.set(
        (moonPos[0] - earthPos[0]) * visualScale,
        (moonPos[1] - earthPos[1]) * visualScale,
        (moonPos[2] - earthPos[2]) * visualScale
      );
    }

    // Render frame
    this.renderer.render(this.scene, this.camera);
  }

  onResize() {
    this.width = this.container.clientWidth;
    this.height = this.container.clientHeight;
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.width, this.height);
  }

  destroy() {
    window.removeEventListener('resize', this.onResize);
    this.renderer.dispose();
  }
}
