import * as THREE from 'three';
import { AU } from '../core/constants.js';

const TEXTURE_BASE =
  'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/';

const EARTH_TEXTURE_URL = `${TEXTURE_BASE}earth_atmos_2048.jpg`;
const MOON_TEXTURE_URL = `${TEXTURE_BASE}moon_1024.jpg`;
const CLOUD_TEXTURE_URL = `${TEXTURE_BASE}earth_clouds_1024.png`;

const clamp = (value, min, max) =>
  Math.max(min, Math.min(max, value));

function vectorFromPoint(point) {
  if (Array.isArray(point) && point.length >= 3) {
    const values = point.slice(0, 3).map(Number);
    return values.every(Number.isFinite)
      ? new THREE.Vector3(...values)
      : null;
  }

  if (point && typeof point === 'object') {
    const x = Number(point.x ?? point[0]);
    const y = Number(point.y ?? point[1]);
    const z = Number(point.z ?? point[2]);

    if ([x, y, z].every(Number.isFinite)) {
      return new THREE.Vector3(x, y, z);
    }
  }

  return null;
}

export class SimulationVisualizer {
  constructor(container) {
    this.container =
      typeof container === 'string'
        ? document.querySelector(container)
        : container;

    if (!this.container) {
      throw new Error('SimulationVisualizer: container element not found.');
    }

    this.clock = new THREE.Clock();
    this.disposed = false;
    this.viewMode = 'solar';
    this.snapshot = null;

    // Match the reference-orbit scale: 1 AU is 18 Three.js units.
    // Physics remains in metres; only the renderer converts units.
    this.AU_UNIT = 18;
    this.hasSnapshotEarthPosition = false;
    this.hasSnapshotMoonPosition = false;

    this.objects = [];
    this.animationObjects = [];
    this.armObjects = [];
    this.textureMaterials = new Map();

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x02040d);

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.01, 5000);
    this.camera.position.set(0, 35, 65);

    this.initThree();
    this.createLighting();
    this.createStarfield();
    this.createSun();
    this.buildSolarSystemScene();
    this.buildEarthOctoScene();
    this.createTrajectoryLine();
    this.initControls();

    this.setViewMode('solar');
    this.onResize();

    this._resizeHandler = () => this.onResize();
    window.addEventListener('resize', this._resizeHandler);

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.onResize());
      this.resizeObserver.observe(this.container);
    }

    this._animate = () => {
      if (this.disposed) return;
      this.animationFrame = requestAnimationFrame(this._animate);
      this.updateFromSnapshot(this.snapshot);
    };

    this.animationFrame = requestAnimationFrame(this._animate);
  }

  initThree() {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.35;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.container.appendChild(this.renderer.domElement);
  }

  createLighting() {
    this.ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
    this.scene.add(this.ambientLight);

    this.sunLight = new THREE.PointLight(0xfff0d0, 5.0, 0, 1.3);
    this.sunLight.position.set(0, 0, 0);
    this.sunLight.castShadow = true;
    this.scene.add(this.sunLight);

    this.fillLight = new THREE.DirectionalLight(0x8dbbff, 0.7);
    this.fillLight.position.set(-15, 10, 20);
    this.scene.add(this.fillLight);
  }

  createStarfield() {
    const starCount = 6500;
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);

    const colorChoices = [
      new THREE.Color(0xffffff),
      new THREE.Color(0xaacbff),
      new THREE.Color(0xffe3bd),
      new THREE.Color(0xc5d8ff),
    ];

    for (let i = 0; i < starCount; i++) {
      const radius = 700 + Math.random() * 900;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.cos(phi);
      positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);

      const color = colorChoices[Math.floor(Math.random() * colorChoices.length)];

      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }

    const geometry = new THREE.BufferGeometry();

    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(positions, 3)
    );

    geometry.setAttribute(
      'color',
      new THREE.BufferAttribute(colors, 3)
    );

    this.starMaterial = new THREE.PointsMaterial({
      size: 1.5,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    });

    this.starfield = new THREE.Points(geometry, this.starMaterial);
    this.scene.add(this.starfield);
  }

  createEarthFallbackTexture() {
    const width = 1024;
    const height = 512;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    const image = ctx.createImageData(width, height);

    const landPatches = [
      { x: 0.18, y: 0.28, rx: 0.09, ry: 0.15 },
      { x: 0.24, y: 0.52, rx: 0.06, ry: 0.17 },
      { x: 0.40, y: 0.28, rx: 0.12, ry: 0.11 },
      { x: 0.47, y: 0.58, rx: 0.09, ry: 0.22 },
      { x: 0.70, y: 0.30, rx: 0.16, ry: 0.13 },
      { x: 0.77, y: 0.52, rx: 0.08, ry: 0.18 },
      { x: 0.89, y: 0.36, rx: 0.08, ry: 0.11 },
    ];

    for (let y = 0; y < height; y++) {
      const v = y / height;
      const latitudeBrightness = 0.78 + 0.22 * Math.sin(v * Math.PI);

      for (let x = 0; x < width; x++) {
        const u = x / width;
        const index = (y * width + x) * 4;

        const noise =
          Math.sin(x * 0.07) * 5 +
          Math.cos(y * 0.09) * 5 +
          Math.sin((x + y) * 0.035) * 7;

        let r = 12 + noise;
        let g = 70 + noise;
        let b = 145 + noise * 1.5;

        const isLand = landPatches.some((patch) => {
          const dx = (u - patch.x) / patch.rx;
          const dy = (v - patch.y) / patch.ry;

          const wobble =
            0.13 * Math.sin(u * 95 + v * 48) * Math.cos(v * 120);

          return dx * dx + dy * dy < 1 + wobble;
        });

        if (isLand) {
          r = 65 + noise * 1.8;
          g = 135 + noise * 1.6;
          b = 55 + noise;
        }

        if (v < 0.075 || v > 0.925) {
          r = 215 + noise;
          g = 230 + noise;
          b = 255;
        }

        image.data[index] = clamp(r * latitudeBrightness, 0, 255);
        image.data[index + 1] = clamp(g * latitudeBrightness, 0, 255);
        image.data[index + 2] = clamp(b * latitudeBrightness, 0, 255);
        image.data[index + 3] = 255;
      }
    }

    ctx.putImageData(image, 0, 0);
    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;

    for (let i = 0; i < 90; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;

      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.bezierCurveTo(x + 20, y - 10, x + 40, y + 12, x + 80, y - 4);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(
      this.renderer.capabilities.getMaxAnisotropy(),
      8
    );

    return texture;
  }

  createMoonFallbackTexture() {
    const size = 1024;

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#aaaaaa';
    ctx.fillRect(0, 0, size, size);

    const image = ctx.getImageData(0, 0, size, size);

    for (let i = 0; i < image.data.length; i += 4) {
      const value = clamp(165 + (Math.random() - 0.5) * 55, 65, 225);

      image.data[i] = value;
      image.data[i + 1] = value;
      image.data[i + 2] = value;
      image.data[i + 3] = 255;
    }

    ctx.putImageData(image, 0, 0);

    for (let i = 0; i < 350; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const radius = 3 + Math.random() * 32;

      const gradient = ctx.createRadialGradient(
        x - radius * 0.2,
        y - radius * 0.2,
        radius * 0.05,
        x,
        y,
        radius
      );

      gradient.addColorStop(0, 'rgba(45,45,45,0.75)');
      gradient.addColorStop(0.65, 'rgba(95,95,95,0.35)');
      gradient.addColorStop(1, 'rgba(225,225,225,0.2)');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(
      this.renderer.capabilities.getMaxAnisotropy(),
      8
    );

    return texture;
  }

  createSunFallbackTexture() {
    const size = 1024;

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext('2d');

    const gradient = ctx.createRadialGradient(
      size / 2,
      size / 2,
      30,
      size / 2,
      size / 2,
      size / 2
    );

    gradient.addColorStop(0, '#fffde0');
    gradient.addColorStop(0.2, '#fff0a0');
    gradient.addColorStop(0.48, '#ffbd37');
    gradient.addColorStop(0.75, '#ff7920');
    gradient.addColorStop(1, '#d8320b');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    for (let i = 0; i < 18000; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const radius = 1 + Math.random() * 7;
      const brightness = Math.random();

      ctx.fillStyle = brightness > 0.5
        ? `rgba(255,255,180,${Math.random() * 0.18})`
        : `rgba(180,45,0,${Math.random() * 0.12})`;

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;

    return texture;
  }

  createCloudFallbackTexture() {
    const size = 1024;

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, size, size);

    for (let i = 0; i < 1300; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const radius = 4 + Math.random() * 30;

      const gradient = ctx.createRadialGradient(x, y, 1, x, y, radius);

      gradient.addColorStop(0, 'rgba(255,255,255,0.55)');
      gradient.addColorStop(1, 'rgba(255,255,255,0)');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    return new THREE.CanvasTexture(canvas);
  }

  loadTextureWithFallback(url, fallbackTexture) {
    const loader = new THREE.TextureLoader();

    loader.load(
      url,
      (texture) => {
        if (this.disposed) {
          texture.dispose();
          return;
        }

        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = Math.min(
          this.renderer.capabilities.getMaxAnisotropy(),
          8
        );

        const material = this.textureMaterials.get(url);

        if (material) {
          const previousTexture = material.map;

          material.map = texture;
          material.needsUpdate = true;

          if (previousTexture && previousTexture !== fallbackTexture) {
            previousTexture.dispose();
          }
        }
      },
      undefined,
      (error) => console.warn(
        `Could not load texture: ${url}. Using procedural fallback.`,
        error
      )
    );

    return fallbackTexture;
  }

  createEarthMaterial() {
    const fallbackTexture = this.createEarthFallbackTexture();

    const material = new THREE.MeshStandardMaterial({
      map: fallbackTexture,
      color: 0xffffff,
      roughness: 0.88,
      metalness: 0,
      emissive: new THREE.Color(0x183858),
      emissiveIntensity: 0.35,
    });

    material.userData.fallbackTexture = fallbackTexture;
    this.textureMaterials.set(EARTH_TEXTURE_URL, material);
    this.loadTextureWithFallback(EARTH_TEXTURE_URL, fallbackTexture);

    return material;
  }

  createMoonMaterial() {
    const fallbackTexture = this.createMoonFallbackTexture();

    const material = new THREE.MeshStandardMaterial({
      map: fallbackTexture,
      color: 0xffffff,
      roughness: 1,
      metalness: 0,
      emissive: new THREE.Color(0x555555),
      emissiveIntensity: 0.3,
    });

    material.userData.fallbackTexture = fallbackTexture;
    this.textureMaterials.set(MOON_TEXTURE_URL, material);
    this.loadTextureWithFallback(MOON_TEXTURE_URL, fallbackTexture);

    return material;
  }

  createSun() {
    this.sunGroup = new THREE.Group();
    this.scene.add(this.sunGroup);

    const sunGeometry = new THREE.SphereGeometry(2.5, 96, 96);
    const sunTexture = this.createSunFallbackTexture();

    const sunMaterial = new THREE.MeshBasicMaterial({
      map: sunTexture,
      color: 0xffffff,
      toneMapped: false,
    });

    this.sunSurface = new THREE.Mesh(sunGeometry, sunMaterial);
    this.sunGroup.add(this.sunSurface);

    // Animate the Sun without relying on an undeclared vUv shader varying.
    sunMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = { value: 0 };

      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        '#include <common>\nvarying vec2 vSolarUv;'
      );

      shader.vertexShader = shader.vertexShader.replace(
        '#include <uv_vertex>',
        '#include <uv_vertex>\nvSolarUv = uv;'
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        '#include <common>\nuniform float uTime;\nvarying vec2 vSolarUv;'
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <color_fragment>',
        `#include <color_fragment>
          float wave1 = sin(vSolarUv.x * 55.0 + uTime * 0.8);
          float wave2 = sin(vSolarUv.y * 48.0 - uTime * 0.55);
          float wave3 = sin((vSolarUv.x + vSolarUv.y) * 32.0 + uTime);
          float solarPattern = 0.92 + 0.035 * wave1 + 0.025 * wave2 + 0.02 * wave3;
          diffuseColor.rgb *= solarPattern;`
      );

      sunMaterial.userData.shader = shader;
    };

    sunMaterial.customProgramCacheKey = () => 'animated-solar-surface-v2';

    const innerCorona = new THREE.Mesh(
      new THREE.SphereGeometry(2.85, 64, 64),
      new THREE.MeshBasicMaterial({
        color: 0xffa52e,
        transparent: true,
        opacity: 0.22,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      })
    );

    this.sunGroup.add(innerCorona);

    const outerCorona = new THREE.Mesh(
      new THREE.SphereGeometry(3.3, 64, 64),
      new THREE.MeshBasicMaterial({
        color: 0xff681c,
        transparent: true,
        opacity: 0.09,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      })
    );

    this.sunGroup.add(outerCorona);

    const glowCanvas = document.createElement('canvas');
    glowCanvas.width = 256;
    glowCanvas.height = 256;

    const ctx = glowCanvas.getContext('2d');

    const gradient = ctx.createRadialGradient(
      128,
      128,
      4,
      128,
      128,
      128
    );

    gradient.addColorStop(0, 'rgba(255,255,220,1)');
    gradient.addColorStop(0.15, 'rgba(255,225,100,0.8)');
    gradient.addColorStop(0.38, 'rgba(255,145,30,0.35)');
    gradient.addColorStop(0.7, 'rgba(255,90,15,0.1)');
    gradient.addColorStop(1, 'rgba(255,60,0,0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 256);

    const glowTexture = new THREE.CanvasTexture(glowCanvas);

    this.sunGlow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture,
        color: 0xffbd59,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      })
    );

    this.sunGlow.scale.set(13, 13, 1);
    this.sunGroup.add(this.sunGlow);

    this.animationObjects.push(innerCorona, outerCorona);
  }

  createOrbitRing(radius, color = 0x35e86f, opacity = 0.8) {
    const points = [];
    const segments = 256;

    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;

      points.push(
        new THREE.Vector3(
          Math.cos(angle) * radius,
          0,
          Math.sin(angle) * radius
        )
      );
    }

    const geometry = new THREE.BufferGeometry().setFromPoints(points);

    const material = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthWrite: false,
    });

    const ring = new THREE.LineLoop(geometry, material);
    ring.renderOrder = 2;

    this.scene.add(ring);
    this.objects.push(ring);

    return ring;
  }

  createTrajectoryLine() {
    const geometry = new THREE.BufferGeometry();

    const material = new THREE.LineBasicMaterial({
      color: 0x39ff74,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    });

    this.trajectoryLine = new THREE.Line(geometry, material);
    this.trajectoryLine.visible = false;
    this.trajectoryLine.renderOrder = 3;

    this.scene.add(this.trajectoryLine);
  }

  buildSolarSystemScene() {
    this.solarGroup = new THREE.Group();
    this.scene.add(this.solarGroup);

    this.earthOrbitRadius = this.AU_UNIT;
    this.earthRadius = 0.95;
    this.moonOrbitRadius = 2.4;
    this.moonRadius = 0.28;

    // The two green reference orbits: 1 AU and 2.7 AU.
    this.innerOrbitRing = this.createOrbitRing(18, 0x35ff75, 0.85);
    this.outerOrbitRing = this.createOrbitRing(18 * 2.7, 0x35ff75, 0.62);

    this.moonOrbitRing = this.createOrbitRing(
      this.moonOrbitRadius,
      0x65738c,
      0.55
    );

    this.moonOrbitRing.position.set(this.earthOrbitRadius, 0, 0);

    const earthGeometry = new THREE.SphereGeometry(
      this.earthRadius,
      96,
      96
    );

    this.earthMaterial = this.createEarthMaterial();
    this.earth = new THREE.Mesh(earthGeometry, this.earthMaterial);

    this.earth.position.set(this.earthOrbitRadius, 0, 0);
    this.earth.rotation.z = THREE.MathUtils.degToRad(23.5);
    this.earth.castShadow = true;
    this.earth.receiveShadow = true;

    this.solarGroup.add(this.earth);

    this.earthAtmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(this.earthRadius * 1.075, 64, 64),
      new THREE.MeshBasicMaterial({
        color: 0x43aaff,
        transparent: true,
        opacity: 0.14,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );

    this.earth.add(this.earthAtmosphere);

    this.cloudMaterial = new THREE.MeshStandardMaterial({
      map: this.createCloudFallbackTexture(),
      color: 0xffffff,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
      roughness: 1,
    });

    this.clouds = new THREE.Mesh(
      new THREE.SphereGeometry(this.earthRadius * 1.018, 64, 64),
      this.cloudMaterial
    );

    this.earth.add(this.clouds);
    this.loadCloudTexture();

    this.moonMaterial = this.createMoonMaterial();

    this.moon = new THREE.Mesh(
      new THREE.SphereGeometry(this.moonRadius, 64, 64),
      this.moonMaterial
    );

    this.moon.position.set(
      this.earthOrbitRadius + this.moonOrbitRadius,
      0,
      0
    );

    this.solarGroup.add(this.moon);

    this.objects.push(this.earth, this.moon, this.clouds);
    this.animationObjects.push(this.earth, this.moon, this.clouds);
  }

  loadCloudTexture() {
    const loader = new THREE.TextureLoader();

    loader.load(
      CLOUD_TEXTURE_URL,
      (texture) => {
        if (this.disposed) {
          texture.dispose();
          return;
        }

        texture.colorSpace = THREE.SRGBColorSpace;

        const previousTexture = this.cloudMaterial.map;

        this.cloudMaterial.map = texture;
        this.cloudMaterial.needsUpdate = true;

        if (previousTexture) previousTexture.dispose();
      },
      undefined,
      (error) => console.warn(
        'Could not load Earth cloud texture. Keeping procedural clouds.',
        error
      )
    );
  }

  buildEarthOctoScene() {
    this.octoGroup = new THREE.Group();
    this.scene.add(this.octoGroup);

    const closeEarthGeometry = new THREE.SphereGeometry(4.5, 96, 96);

    this.closeEarthMaterial = this.createEarthMaterial();
    this.closeEarth = new THREE.Mesh(
      closeEarthGeometry,
      this.closeEarthMaterial
    );

    this.closeEarth.rotation.z = THREE.MathUtils.degToRad(23.5);
    this.closeEarth.castShadow = true;
    this.closeEarth.receiveShadow = true;

    this.octoGroup.add(this.closeEarth);

    this.closeEarthAtmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(4.78, 64, 64),
      new THREE.MeshBasicMaterial({
        color: 0x38a8ff,
        transparent: true,
        opacity: 0.17,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );

    this.closeEarth.add(this.closeEarthAtmosphere);

    this.closeClouds = new THREE.Mesh(
      new THREE.SphereGeometry(4.58, 64, 64),
      new THREE.MeshStandardMaterial({
        map: this.createCloudFallbackTexture(),
        color: 0xffffff,
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
      })
    );

    this.closeEarth.add(this.closeClouds);

    this.octoRing = new THREE.Mesh(
      new THREE.TorusGeometry(6.25, 0.065, 12, 180),
      new THREE.MeshStandardMaterial({
        color: 0x39d9ff,
        emissive: 0x087fa8,
        emissiveIntensity: 1.7,
        metalness: 0.55,
        roughness: 0.28,
      })
    );

    this.octoRing.rotation.x = Math.PI / 2.5;
    this.octoGroup.add(this.octoRing);

    const secondRing = new THREE.Mesh(
      new THREE.TorusGeometry(6.55, 0.025, 8, 180),
      new THREE.MeshBasicMaterial({
        color: 0x8b8aff,
        transparent: true,
        opacity: 0.8,
      })
    );

    secondRing.rotation.x = Math.PI / 2.5;
    secondRing.rotation.z = Math.PI / 8;

    this.octoGroup.add(secondRing);

    this.armObjects = [];

    const armCount = 8;

    for (let i = 0; i < armCount; i++) {
      const angle = (i / armCount) * Math.PI * 2;

      const armGroup = new THREE.Group();
      armGroup.rotation.y = angle;

      const length = 4.7;

      const arm = new THREE.Mesh(
        new THREE.CylinderGeometry(0.075, 0.13, length, 12),
        new THREE.MeshStandardMaterial({
          color: 0xb9c7df,
          metalness: 0.85,
          roughness: 0.24,
          emissive: 0x152c54,
          emissiveIntensity: 0.5,
        })
      );

      arm.rotation.z = Math.PI / 2;
      arm.position.x = 6.4;
      arm.castShadow = true;
      arm.receiveShadow = true;

      armGroup.add(arm);

      const endpoint = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 24, 24),
        new THREE.MeshStandardMaterial({
          color: 0x7beaff,
          emissive: 0x1bbfff,
          emissiveIntensity: 2,
          metalness: 0.25,
          roughness: 0.2,
        })
      );

      endpoint.position.x = 8.75;
      armGroup.add(endpoint);

      const indicator = new THREE.Mesh(
        new THREE.SphereGeometry(0.105, 16, 16),
        new THREE.MeshBasicMaterial({ color: 0xffd36a })
      );

      indicator.position.x = 5;
      armGroup.add(indicator);

      this.octoGroup.add(armGroup);

      this.armObjects.push({
        group: armGroup,
        arm,
        endpoint,
        indicator,
        angle,
      });
    }

    this.animationObjects.push(
      this.closeEarth,
      this.closeClouds,
      this.octoRing
    );
  }

  initControls() {
    this.isDragging = false;
    this.previousPointer = { x: 0, y: 0 };

    this.cameraTarget = new THREE.Vector3(0, 0, 0);

    this.orbit = {
      theta: 0,
      phi: Math.PI / 3,
      radius: 65,
    };

    this._onPointerDown = (event) => {
      this.isDragging = true;

      this.previousPointer.x = event.clientX;
      this.previousPointer.y = event.clientY;

      this.renderer.domElement.setPointerCapture?.(event.pointerId);
    };

    this._onPointerMove = (event) => {
      if (!this.isDragging) return;

      const dx = event.clientX - this.previousPointer.x;
      const dy = event.clientY - this.previousPointer.y;

      this.previousPointer.x = event.clientX;
      this.previousPointer.y = event.clientY;

      this.orbit.theta -= dx * 0.005;

      this.orbit.phi = clamp(
        this.orbit.phi + dy * 0.005,
        0.08,
        Math.PI - 0.08
      );

      this.updateCameraPosition();
    };

    this._onPointerUp = () => {
      this.isDragging = false;
    };

    this._onWheel = (event) => {
      event.preventDefault();

      this.orbit.radius *= Math.exp(event.deltaY * 0.0025);
      this.orbit.radius = clamp(this.orbit.radius, 5, 300);

      this.updateCameraPosition();
    };

    const canvas = this.renderer.domElement;

    canvas.addEventListener('pointerdown', this._onPointerDown);
    canvas.addEventListener('pointermove', this._onPointerMove);
    canvas.addEventListener('pointerup', this._onPointerUp);
    canvas.addEventListener('pointercancel', this._onPointerUp);
    canvas.addEventListener('wheel', this._onWheel, { passive: false });
  }

  updateCameraPosition() {
    const sinPhi = Math.sin(this.orbit.phi);

    this.camera.position.set(
      this.cameraTarget.x +
      this.orbit.radius * sinPhi * Math.sin(this.orbit.theta),

      this.cameraTarget.y +
      this.orbit.radius * Math.cos(this.orbit.phi),

      this.cameraTarget.z +
      this.orbit.radius * sinPhi * Math.cos(this.orbit.theta)
    );

    this.camera.lookAt(this.cameraTarget);
  }

  setViewMode(mode) {
    this.viewMode = mode;

    if (mode === 'earth' || mode === 'octo') {
      this.solarGroup.visible = false;
      this.octoGroup.visible = true;
      this.sunGroup.visible = false;
      this.starfield.visible = true;

      this.innerOrbitRing.visible = false;
      this.outerOrbitRing.visible = false;
      this.moonOrbitRing.visible = false;
      this.trajectoryLine.visible = false;

      this.cameraTarget.set(0, 0, 0);

      this.orbit.radius = 20;
      this.orbit.theta = 0;
      this.orbit.phi = Math.PI / 2.3;
    } else {
      this.solarGroup.visible = true;
      this.octoGroup.visible = false;
      this.sunGroup.visible = true;
      this.starfield.visible = true;

      this.innerOrbitRing.visible = true;
      this.outerOrbitRing.visible = true;
      this.moonOrbitRing.visible = true;

      this.cameraTarget.set(9, 0, 0);

      this.orbit.radius = 65;
      this.orbit.theta = 0;
      this.orbit.phi = Math.PI / 3;
    }

    this.camera.fov = 45;
    this.camera.updateProjectionMatrix();

    this.updateCameraPosition();
  }

  updateFromSnapshot(snapshot) {
    if (this.disposed) return;

    if (snapshot !== undefined && snapshot !== null) {
      this.snapshot = snapshot;
    }

    const currentSnapshot = this.snapshot;

    const dt = Math.min(this.clock.getDelta(), 0.05);

    this.animateBodies(dt);

    if (currentSnapshot) {
      this.updatePositionsFromSnapshot(currentSnapshot);
      this.updateArmsFromSnapshot(currentSnapshot);
      this.updateTrajectoryFromSnapshot(currentSnapshot);
    }

    this.renderer.render(this.scene, this.camera);
  }

  updatePositionsFromSnapshot(snapshot) {
    const positions = snapshot?.positions;

    if (!positions) return;

    const earthPosition = positions.earth || positions.Earth;
    const moonPosition = positions.moon || positions.Moon;

    // The simulation's orbital plane is physics XY. Three.js uses Y as
    // vertical, so map physics (x, y, z) -> visual (x, z, y). This makes
    // the orbit horizontal without changing the underlying simulation.
    const toVisualPosition = (rawPosition) => {
      const vector = vectorFromPoint(rawPosition);

      if (!vector) return null;

      // Snapshot position arrays are in metres. Accept AU-sized vectors too
      // for compatibility with external snapshots.
      const magnitude = vector.length();

      const scale = magnitude > 10000
        ? this.AU_UNIT / AU
        : this.AU_UNIT;

      vector.multiplyScalar(scale);

      return new THREE.Vector3(
        vector.x,
        vector.z,
        vector.y
      );
    };

    if (earthPosition && this.earth) {
      const point = toVisualPosition(earthPosition);

      if (point) {
        this.earth.position.copy(point);
        this.hasSnapshotEarthPosition = true;
      }
    }

    if (moonPosition && this.moon) {
      const point = toVisualPosition(moonPosition);

      if (point) {
        this.moon.position.copy(point);
        this.hasSnapshotMoonPosition = true;
      }
    }

    // This ring is a scene-level object, so keep its centre synchronized
    // with Earth's current simulated position rather than its initial 1 AU.
    if (
      this.moonOrbitRing &&
      this.earth &&
      this.hasSnapshotEarthPosition
    ) {
      this.moonOrbitRing.position.copy(this.earth.position);
    }
  }

  updateTrajectoryFromSnapshot(snapshot) {
    const candidates = [
      snapshot?.trajectoryHistory,
      snapshot?.trajectory_history,
      snapshot?.trajectory,
      snapshot?.positions?.trajectoryHistory,
      snapshot?.positions?.trajectory,
    ];

    const history = candidates.find(Array.isArray);

    if (!history || history.length < 2) {
      this.trajectoryLine.visible = false;
      return;
    }

    const points = [];

    for (const item of history) {
      // PlanetaryPropulsionSim.snapshot() stores barycentre history as
      // { year, rAU, xAU, yAU, zAU }. Other snapshots may store metre vectors.
      let point = null;

      if (
        item &&
        [item.xAU, item.yAU, item.zAU].every(
          (value) => Number.isFinite(Number(value))
        )
      ) {
        point = new THREE.Vector3(
          Number(item.xAU) * this.AU_UNIT,
          Number(item.zAU) * this.AU_UNIT,
          Number(item.yAU) * this.AU_UNIT
        );
      } else {
        const raw = item?.position ?? item?.earth ?? item;
        const vector = vectorFromPoint(raw);

        if (vector) {
          const magnitude = vector.length();

          const scale = magnitude > 10000
            ? this.AU_UNIT / AU
            : this.AU_UNIT;

          vector.multiplyScalar(scale);

          point = new THREE.Vector3(
            vector.x,
            vector.z,
            vector.y
          );
        }
      }

      if (
        point &&
        [point.x, point.y, point.z].every(Number.isFinite)
      ) {
        points.push(point);
      }
    }

    if (points.length < 2) {
      this.trajectoryLine.visible = false;
      return;
    }

    this.trajectoryLine.geometry.dispose();

    this.trajectoryLine.geometry =
      new THREE.BufferGeometry().setFromPoints(points);

    this.trajectoryLine.visible =
      this.viewMode !== 'earth' &&
      this.viewMode !== 'octo';
  }

  updateArmsFromSnapshot(snapshot) {
    const arms = snapshot.kinematics?.arms;

    if (!Array.isArray(arms)) return;

    for (
      let i = 0;
      i < Math.min(arms.length, this.armObjects.length);
      i++
    ) {
      const armData = arms[i];
      const armObject = this.armObjects[i];

      if (!armData || !armObject) continue;

      const angle = Number(armData.angle ?? armData.theta);

      if (Number.isFinite(angle)) {
        armObject.angle = angle;
        armObject.group.rotation.y = angle;
      }

      const extension = Number(
        armData.extension ??
        armData.length ??
        armData.position
      );

      if (Number.isFinite(extension)) {
        const normalizedExtension = clamp(extension, 0.5, 12);

        armObject.arm.scale.y = normalizedExtension / 4.7;
      }
    }
  }

  animateBodies(dt) {
    if (this.earth) {
      this.earth.rotation.y += dt * 0.12;
    }

    if (this.clouds) {
      this.clouds.rotation.y += dt * 0.16;
    }

    if (this.closeEarth) {
      this.closeEarth.rotation.y += dt * 0.1;
    }

    if (this.closeClouds) {
      this.closeClouds.rotation.y += dt * 0.14;
    }

    // Fallback movement is used only before the first real Moon snapshot arrives.
    if (this.moon && !this.hasSnapshotMoonPosition) {
      const time = this.clock.elapsedTime;
      const angle = time * 0.35;

      this.moon.position.set(
        this.earthOrbitRadius + Math.cos(angle) * this.moonOrbitRadius,
        Math.sin(angle * 0.35) * 0.25,
        Math.sin(angle) * this.moonOrbitRadius
      );
    }

    if (this.moon) {
      this.moon.rotation.y += dt * 0.06;
    }

    const shader = this.sunSurface?.material?.userData?.shader;

    if (shader?.uniforms?.uTime) {
      shader.uniforms.uTime.value = this.clock.elapsedTime;
    }

    if (this.sunSurface) {
      this.sunSurface.rotation.y += dt * 0.035;
    }

    if (this.sunGlow) {
      this.sunGlow.material.opacity =
        0.83 + Math.sin(this.clock.elapsedTime * 1.8) * 0.08;

      const pulse =
        13 + Math.sin(this.clock.elapsedTime * 1.3) * 0.35;

      this.sunGlow.scale.set(pulse, pulse, 1);
    }

    if (this.octoRing) {
      this.octoRing.rotation.z += dt * 0.035;
    }

    if (this.starfield) {
      this.starfield.rotation.y += dt * 0.0015;
    }

    for (const armObject of this.armObjects) {
      if (!armObject) continue;

      if (
        this.snapshot?.kinematics?.arms?.[
        this.armObjects.indexOf(armObject)
        ]
      ) {
        continue;
      }

      const angle = armObject.angle;

      armObject.group.rotation.y =
        angle +
        Math.sin(this.clock.elapsedTime * 0.25 + angle) * 0.012;
    }
  }

  onResize() {
    if (!this.renderer || !this.camera) return;

    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height, false);
  }

  destroy() {
    if (this.disposed) return;

    this.disposed = true;

    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }

    window.removeEventListener('resize', this._resizeHandler);
    this.resizeObserver?.disconnect();

    const canvas = this.renderer?.domElement;

    if (canvas) {
      canvas.removeEventListener('pointerdown', this._onPointerDown);
      canvas.removeEventListener('pointermove', this._onPointerMove);
      canvas.removeEventListener('pointerup', this._onPointerUp);
      canvas.removeEventListener('pointercancel', this._onPointerUp);
      canvas.removeEventListener('wheel', this._onWheel);
    }

    const disposedTextures = new Set();

    this.scene.traverse((object) => {
      if (object.geometry) {
        object.geometry.dispose();
      }

      if (!object.material) return;

      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];

      for (const material of materials) {
        for (const key of ['map', 'alphaMap', 'emissiveMap']) {
          const texture = material[key];

          if (texture && !disposedTextures.has(texture)) {
            disposedTextures.add(texture);
            texture.dispose();
          }
        }

        material.dispose();
      }
    });

    this.renderer?.dispose();

    if (canvas?.parentElement === this.container) {
      this.container.removeChild(canvas);
    }
  }
}