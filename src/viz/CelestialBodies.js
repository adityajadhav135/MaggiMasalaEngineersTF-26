import * as THREE from "three";

// Creates only the Sun, Earth, and Moon.
// Call createCelestialBodies(scene) from your main scene file.

export function createCelestialBodies(scene) {
    const solarSystem = new THREE.Group();
    scene.add(solarSystem);

    // Lighting for the planets
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
    solarSystem.add(ambientLight);

    const sunlight = new THREE.PointLight(0xffffff, 3, 200);
    sunlight.position.set(-18, 0, 0);
    solarSystem.add(sunlight);

    // --------------------------------------------------
    // PROCEDURAL TEXTURES FOR EARTH
    // --------------------------------------------------

    function hash(x, y, z) {
        const h = Math.sin(
            x * 127.1 + y * 311.7 + z * 74.7
        ) * 43758.5453;

        return h - Math.floor(h);
    }

    function noise(x, y, z) {
        const xi = Math.floor(x);
        const yi = Math.floor(y);
        const zi = Math.floor(z);

        const xf = x - xi;
        const yf = y - yi;
        const zf = z - zi;

        const smooth = (t) => t * t * (3 - 2 * t);
        const lerp = (a, b, t) => a + (b - a) * t;

        const u = smooth(xf);
        const v = smooth(yf);
        const w = smooth(zf);

        const a = lerp(
            hash(xi, yi, zi),
            hash(xi + 1, yi, zi),
            u
        );

        const b = lerp(
            hash(xi, yi + 1, zi),
            hash(xi + 1, yi + 1, zi),
            u
        );

        const c = lerp(
            hash(xi, yi, zi + 1),
            hash(xi + 1, yi, zi + 1),
            u
        );

        const d = lerp(
            hash(xi, yi + 1, zi + 1),
            hash(xi + 1, yi + 1, zi + 1),
            u
        );

        return lerp(
            lerp(a, b, v),
            lerp(c, d, v),
            w
        );
    }

    function fbm(x, y, z, octaves = 5) {
        let value = 0;
        let amplitude = 0.5;

        for (let i = 0; i < octaves; i++) {
            value += amplitude * noise(x, y, z);

            x *= 2.05;
            y *= 2.05;
            z *= 2.05;

            amplitude *= 0.5;
        }

        return value;
    }

    function createTexture(colorFunction) {
        const canvas = document.createElement("canvas");

        canvas.width = 512;
        canvas.height = 256;

        const context = canvas.getContext("2d");
        const image = context.createImageData(
            canvas.width,
            canvas.height
        );

        for (let j = 0; j < canvas.height; j++) {
            const latitude =
                (0.5 - (j + 0.5) / canvas.height) * Math.PI;

            for (let i = 0; i < canvas.width; i++) {
                const longitude =
                    ((i + 0.5) / canvas.width) * Math.PI * 2;

                const x = Math.cos(latitude) * Math.cos(longitude);
                const y = Math.sin(latitude);
                const z = Math.cos(latitude) * Math.sin(longitude);

                const index =
                    (j * canvas.width + i) * 4;

                const color = colorFunction(
                    x, y, z, latitude
                );

                image.data[index] = color[0];
                image.data[index + 1] = color[1];
                image.data[index + 2] = color[2];
                image.data[index + 3] = color[3];
            }
        }

        context.putImageData(image, 0, 0);

        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;

        return texture;
    }

    // --------------------------------------------------
    // EARTH: BLUE OCEANS, GREEN LAND, AND POLAR ICE
    // --------------------------------------------------

    const earthTexture = createTexture((x, y, z, latitude) => {
        const h = fbm(x * 2.2 + 3, y * 2.2, z * 2.2, 5);

        // Polar ice
        if (Math.abs(latitude) > 1.25) {
            return [236, 243, 250, 255];
        }

        // Oceans
        if (h < 0.5) {
            return [12, 65, 145, 255];
        }

        // Land
        const elevation = (h - 0.5) * 5;

        if (elevation > 0.9) {
            return [220, 220, 215, 255];
        }

        // Green forests and brown, dry regions
        const dry =
            Math.abs(latitude) < 0.55 &&
            fbm(x * 4, y * 4 + 9, z * 4, 3) > 0.5;

        if (dry) {
            return [180, 150, 95, 255];
        }

        return [55, 125, 60, 255];
    });

    const earth = new THREE.Mesh(
        new THREE.SphereGeometry(2, 64, 48),
        new THREE.MeshPhongMaterial({
            map: earthTexture,
            shininess: 20,
            specular: 0x334466
        })
    );

    earth.name = "Earth";
    solarSystem.add(earth);

    // --------------------------------------------------
    // EARTH'S CLOUDS
    // --------------------------------------------------

    const cloudTexture = createTexture((x, y, z) => {
        const density = fbm(
            x * 3 + 11,
            y * 3,
            z * 3,
            5
        );

        const alpha = Math.round(
            Math.min(
                1,
                Math.max(0, density - 0.5) * 3.2
            ) * 200
        );

        return [255, 255, 255, alpha];
    });

    const clouds = new THREE.Mesh(
        new THREE.SphereGeometry(2.025, 64, 48),
        new THREE.MeshPhongMaterial({
            map: cloudTexture,
            transparent: true,
            depthWrite: false
        })
    );

    clouds.name = "EarthClouds";
    earth.add(clouds);

    // --------------------------------------------------
    // EARTH'S BLUE ATMOSPHERE
    // --------------------------------------------------

    const atmosphere = new THREE.Mesh(
        new THREE.SphereGeometry(2.14, 48, 32),
        new THREE.ShaderMaterial({
            transparent: true,
            side: THREE.BackSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false,

            vertexShader: `
        varying vec3 normalDirection;

        void main() {
          normalDirection = normalize(
            normalMatrix * normal
          );

          gl_Position =
            projectionMatrix *
            modelViewMatrix *
            vec4(position, 1.0);
        }
      `,

            fragmentShader: `
        varying vec3 normalDirection;

        void main() {
          float glow = pow(
            max(
              0.72 - dot(
                normalDirection,
                vec3(0.0, 0.0, 1.0)
              ),
              0.0
            ),
            3.0
          );

          gl_FragColor = vec4(
            0.35,
            0.65,
            1.0,
            glow * 1.6
          );
        }
      `
        })
    );

    atmosphere.name = "EarthAtmosphere";
    earth.add(atmosphere);

    // --------------------------------------------------
    // SUN: GOLDEN SPHERE AND SOFT GLOW
    // --------------------------------------------------

    const sun = new THREE.Mesh(
        new THREE.SphereGeometry(3, 48, 32),
        new THREE.MeshBasicMaterial({
            color: 0xffc83d
        })
    );

    sun.name = "Sun";
    sun.position.set(-18, 0, 0);

    solarSystem.add(sun);

    // Create the Sun's radial glow
    const glowCanvas = document.createElement("canvas");
    glowCanvas.width = 128;
    glowCanvas.height = 128;

    const glowContext = glowCanvas.getContext("2d");

    const gradient = glowContext.createRadialGradient(
        64, 64, 0,
        64, 64, 64
    );

    gradient.addColorStop(
        0,
        "rgba(255,236,170,1)"
    );

    gradient.addColorStop(
        0.25,
        "rgba(255,190,90,0.55)"
    );

    gradient.addColorStop(
        1,
        "rgba(255,160,60,0)"
    );

    glowContext.fillStyle = gradient;
    glowContext.fillRect(0, 0, 128, 128);

    const glowTexture = new THREE.CanvasTexture(glowCanvas);

    const sunGlow = new THREE.Sprite(
        new THREE.SpriteMaterial({
            map: glowTexture,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        })
    );

    sunGlow.scale.set(10, 10, 1);
    sun.add(sunGlow);

    // --------------------------------------------------
    // MOON: GREY SPHERE WITH CRATER-LIKE SURFACE DETAILS
    // --------------------------------------------------

    const moonTexture = createTexture((x, y, z) => {
        const craters = fbm(
            x * 18,
            y * 18,
            z * 18,
            4
        );

        const shade = Math.round(
            130 + craters * 90
        );

        return [
            shade,
            shade,
            Math.min(255, shade + 3),
            255
        ];
    });

    const moon = new THREE.Mesh(
        new THREE.SphereGeometry(0.54, 48, 32),
        new THREE.MeshStandardMaterial({
            map: moonTexture,
            roughness: 1,
            metalness: 0
        })
    );

    moon.name = "Moon";
    moon.position.set(3.5, 0, 0);

    solarSystem.add(moon);

    // Return the objects so the main scene can animate them.
    return {
        solarSystem,
        sun,
        earth,
        moon,
        clouds,
        atmosphere,
        sunGlow
    };
}