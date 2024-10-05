// Scene, Camera, Renderer
const scene = new THREE.Scene();
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Ambient and Sunlight
const ambientLight = new THREE.AmbientLight(0x404040, 1.2);
scene.add(ambientLight);
const sunLight = new THREE.PointLight(0xffffff, 2, 1000);
scene.add(sunLight);

// Camera setup
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000000);
camera.position.set(100, 100, 500);
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableZoom = true;
controls.zoomSpeed = 0.8;
controls.enablePan = true;
controls.minDistance = 10;
controls.maxDistance = 50000;

// Store planets, asteroids, and their sprites
const planets = [];
const asteroids = [];
const planetSprites = [];  // Store planet sprites (dots)

// Texture loader
const textureLoader = new THREE.TextureLoader();

// Load higher resolution textures for planets
const planetTextures = {
    mercury: textureLoader.load('textures/mercury.jpg'),
    venus: textureLoader.load('textures/venus.jpg'),
    earth: textureLoader.load('textures/earth.jpg'),
    mars: textureLoader.load('textures/mars.jpg'),
    jupiter: textureLoader.load('textures/jupiter.jpg'),
    saturn: textureLoader.load('textures/saturn.jpg'),
    uranus: textureLoader.load('textures/uranus.jpg'),
    neptune: textureLoader.load('textures/neptune.jpg'),
};

// Create the Sun with a glowing effect
const sunTexture = textureLoader.load('textures/sun.jpg');
const sunMaterial = new THREE.MeshBasicMaterial({ map: sunTexture });
const sunGeometry = new THREE.SphereGeometry(15, 32, 32); // Size of the Sun
const sun = new THREE.Mesh(sunGeometry, sunMaterial);
scene.add(sun);

// Create planet orbits
function createOrbitPath(distance, color = 0xCD5C5C) {
    const orbitCurve = new THREE.EllipseCurve(0, 0, distance, distance * 0.9);
    const orbitPoints = orbitCurve.getPoints(100);
    const orbitGeometry = new THREE.BufferGeometry().setFromPoints(orbitPoints);
    const orbitMaterial = new THREE.LineBasicMaterial({ color });
    const orbitPath = new THREE.Line(orbitGeometry, orbitMaterial);
    orbitPath.rotation.x = Math.PI / 2; // Rotate for the elliptical plane
    scene.add(orbitPath);
}

// Create planet marker sprite (dot)
function createPlanetSprite() {
    const dotTexture = textureLoader.load('textures/dot.png');  // Use a small dot texture
    const spriteMaterial = new THREE.SpriteMaterial({
        map: dotTexture,  
        color: 0xffffff,
        sizeAttenuation: false, // Keep size constant regardless of zoom
    });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(0.3,0.3, 0.3); // Size of the dot
    return sprite;
}

// Fetch planetary data from API
async function fetchPlanetaryData() {
    try {
        const response = await fetch('https://api.le-systeme-solaire.net/rest/bodies/');
        const data = await response.json();

        // Filter only the planets
        const planetData = data.bodies.filter(body => body.isPlanet);

        planetData.forEach((planet) => {
            createPlanet(planet);
        });

        document.getElementById('loading-screen').style.display = 'none'; // Hide loading screen after fetching data

    } catch (error) {
        console.error("Error fetching planetary data:", error);
    }
}

// Create planet function with orbits and sprites
function createPlanet(planetData) {
    const sizeScaleFactor = 0.01; // Scale down for visibility
    const distanceScaleFactor = 10000; // Scale down distances

    const planetRadius = planetData.meanRadius * sizeScaleFactor; // Scaled radius
    const planetDistance = planetData.semimajorAxis / distanceScaleFactor; // Scaled distance from the Sun

    // Create the planet object
    const planetMaterial = new THREE.MeshStandardMaterial({
        map: planetTextures[planetData.englishName.toLowerCase()] || textureLoader.load('./textures/default.jpg')
    });

    const planetGeometry = new THREE.SphereGeometry(planetRadius, 32, 32);
    const planet = new THREE.Mesh(planetGeometry, planetMaterial);

    // Position planet at the scaled distance
    planet.position.set(planetDistance, 0, 0);

    // Create sprite for planet (small dot visible when zoomed out)
    const sprite = createPlanetSprite();
    sprite.position.copy(planet.position);

    // Add planet and sprite to the scene
    scene.add(planet);
    scene.add(sprite);

    // Add orbit path for planet
    createOrbitPath(planetDistance);

    planets.push(planet);
    planetSprites.push(sprite);
}

// Calculate asteroid position based on orbital data
function calculateAsteroidPosition(a, e, i, Ω, ω, M, timeSinceEpoch) {
    const E = solveKeplersEquation(M, e);  // Eccentric anomaly
    const ν = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));  // True anomaly
    const r = a * (1 - e * Math.cos(E));  // Distance to the Sun

    const xOrbital = r * Math.cos(ν);
    const yOrbital = r * Math.sin(ν);

    const cosΩ = Math.cos(Ω), sinΩ = Math.sin(Ω);
    const cosω = Math.cos(ω), sinω = Math.sin(ω);
    const cosi = Math.cos(i), sini = Math.sin(i);

    const x = (cosΩ * cosω - sinΩ * sinω * cosi) * xOrbital + (-cosΩ * sinω - sinΩ * cosω * cosi) * yOrbital;
    const y = (sinΩ * cosω + cosΩ * sinω * cosi) * xOrbital + (-sinΩ * sinω + cosΩ * cosω * cosi) * yOrbital;
    const z = (sinω * sini) * xOrbital + (cosω * sini) * yOrbital;

    return { x, y, z };
}

// Solve Kepler's Equation for eccentric anomaly
function solveKeplersEquation(M, e) {
    let E = M, delta = 1e-6, diff;
    do {
        diff = E - e * Math.sin(E) - M;
        E -= diff / (1 - e * Math.cos(E));
    } while (Math.abs(diff) > delta);
    return E;
}

// Create asteroid and its orbit
function createAsteroid(a, e, i, Ω, ω, M) {
    const timeSinceEpoch = (Date.now() - new Date('2024-01-01').getTime()) / (1000 * 60 * 60 * 24);  // Days since 2024-01-01
    const position = calculateAsteroidPosition(a, e, i, Ω, ω, M, timeSinceEpoch);

    // Create asteroid geometry and material
    const asteroidGeometry = new THREE.SphereGeometry(1, 16, 16);  // Adjust size
    const asteroidMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });  // Red for visibility
    const asteroid = new THREE.Mesh(asteroidGeometry, asteroidMaterial);

    // Position asteroid based on calculated position
    asteroid.position.set(position.x, position.y, position.z);
    scene.add(asteroid);

    // Add orbit path for asteroid
    createOrbitPath(a, 0x87CEEB);  // Light blue color for asteroid orbit

    asteroids.push(asteroid);
}

// Fetch asteroid data from NASA API
async function fetchAsteroidData() {
    try {
        const apiKey = 'gi7DKGrKQSYU2v8xuWWhHW7t88M9IGpC4oeLbUUT';  // Replace with your NASA API key
        const startDate = '2024-01-01';
        const endDate = '2024-01-08';
        const response = await fetch(`https://api.nasa.gov/neo/rest/v1/feed?start_date=${startDate}&end_date=${endDate}&api_key=${apiKey}`);
        const data = await response.json();
        const asteroids = Object.values(data.near_earth_objects).flat();

        for (let asteroid of asteroids) {
            const { id, name } = asteroid;
            console.log(`Fetching orbital data for asteroid: ${name}`);
            await fetchAsteroidOrbitalData(id);  // Fetch detailed orbital data
        }
    } catch (error) {
        console.error("Error fetching asteroid data:", error);
    }
}

async function fetchAsteroidOrbitalData(asteroidId) {
    try {
        const apiKey = 'gi7DKGrKQSYU2v8xuWWhHW7t88M9IGpC4oeLbUUT';  // Replace with your NASA API key
        const response = await fetch(`https://api.nasa.gov/neo/rest/v1/neo/${asteroidId}?api_key=${apiKey}`);
        const asteroidData = await response.json();
        const orbitalData = asteroidData.orbital_data;

        if (orbitalData) {
            createAsteroid(
                orbitalData.semi_major_axis,
                orbitalData.eccentricity,
                orbitalData.inclination,
                orbitalData.ascending_node_longitude,
                orbitalData.perihelion_argument,
                orbitalData.mean_anomaly
            );
        } else {
            console.warn(`Missing orbital data for asteroid ID: ${asteroidId}`);
        }

    } catch (error) {
        console.error("Error fetching asteroid orbital data:", error);
    }
}

// Lighting for the scene
const pointLight = new THREE.PointLight(0xffffff, 1, 1000);
pointLight.position.set(0, 0, 0);
scene.add(pointLight);

// Window resize handler
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Animation loop
function animate() {
    requestAnimationFrame(animate);

    planets.forEach((planet, index) => {
        planet.rotation.y += 0.01; // Rotate planets for a dynamic effect

        // Make the sprite (dot) visible when zoomed out, hide planet models
        const distanceToCamera = camera.position.distanceTo(planet.position);
        if (distanceToCamera > 300) {
            planet.visible = false;  // Hide the planet if far
            planetSprites[index].visible = true; // Show the sprite (dot)
        } else {
            planet.visible = true;   // Show the planet if close
            planetSprites[index].visible = false; // Hide the sprite (dot)
        }
    });

    controls.update();
    renderer.render(scene, camera);
}

animate();

// Fetch data
fetchPlanetaryData();
fetchAsteroidData();
