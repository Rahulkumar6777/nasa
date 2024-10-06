// Scene, Camera, Renderer
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 5, 30); // Position the camera so it sees the whole scene
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.5); // Add ambient light for better visibility
scene.add(ambientLight);

// Orbit Controls (Camera Movable)
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableZoom = true;
controls.enablePan = true;

// Store planets and asteroids
const planets = [];
const asteroids = [];

// Texture loader
const textureLoader = new THREE.TextureLoader();

// Load textures for the Sun and planets
const sunTexture = textureLoader.load('textures/sun.jpg');
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

// Sun
const sunMaterial = new THREE.MeshBasicMaterial({ map: sunTexture });
const sunGeometry = new THREE.SphereGeometry(5, 32, 32);
const sun = new THREE.Mesh(sunGeometry, sunMaterial);
scene.add(sun);

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

        // Hide loading screen when data is loaded
        document.getElementById('loading-screen').style.display = 'none';

    } catch (error) {
        console.error("Error fetching planetary data:", error);
    }
}

// Function to create a planet with a texture
function createPlanet(planetData) {
    const scaleFactor = 0.1; // Adjust this factor to scale planet sizes
    const planetRadius = planetData.meanRadius / 1000 * scaleFactor;
    const planetDistance = planetData.semimajorAxis / 150000000;

    // Load the texture for the current planet based on its English name
    const planetName = planetData.englishName.toLowerCase();
    const planetMaterial = new THREE.MeshBasicMaterial({
        map: planetTextures[planetName] || textureLoader.load('./assets/textures/default.jpg') // Fallback to a default texture
    });

    // Create planet geometry
    const planetGeometry = new THREE.SphereGeometry(planetRadius, 32, 32);
    const planet = new THREE.Mesh(planetGeometry, planetMaterial);

    // Position planet
    planet.position.set(planetDistance * 10, 0, 0);
    
    // Add orbit path
    const orbitCurve = new THREE.EllipseCurve(0, 0, planetDistance * 10, planetDistance * 10);
    const orbitPoints = orbitCurve.getPoints(50);
    const orbitGeometry = new THREE.BufferGeometry().setFromPoints(orbitPoints);
    const orbitMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });
    const planetOrbit = new THREE.Line(orbitGeometry, orbitMaterial);
    planetOrbit.rotation.x = Math.PI / 2; // Rotate to make it flat
    scene.add(planetOrbit);

    // Add planet to scene
    scene.add(planet);
    planets.push(planet);
}

// Fetch planetary data
fetchPlanetaryData();

// Function to create and position an asteroid based on close approach data
function createAsteroid(asteroidData) {
    const closeApproachData = asteroidData.close_approach_data;
    if (!closeApproachData || closeApproachData.length === 0) {
        console.error("No close approach data available for asteroid:", asteroidData.name);
        return;
    }

    const approach = closeApproachData[0];
    const asteroidGeometry = new THREE.SphereGeometry(0.2, 16, 16); // Small asteroid size
    const asteroidTexture = textureLoader.load('./textures/asteroid_texture.jpg'); // Add a texture
    const asteroidMaterial = new THREE.MeshBasicMaterial({ map: asteroidTexture });
    const asteroid = new THREE.Mesh(asteroidGeometry, asteroidMaterial);

    const approachDistance = approach.miss_distance.kilometers || 15000000; // in kilometers, with a fallback distance
    const distanceFromSun = approachDistance / 100000; // Scaled down for visualization

    const path = new THREE.EllipseCurve(0, 0, distanceFromSun, distanceFromSun, 0, 2 * Math.PI);
    const points = path.getPoints(100);
    const pathGeometry = new THREE.BufferGeometry().setFromPoints(points.map(p => new THREE.Vector3(p.x, 0, p.y)));
    const pathMaterial = new THREE.LineBasicMaterial({ color: 0x0000ff });
    const asteroidPath = new THREE.Line(pathGeometry, pathMaterial);
    asteroidPath.rotation.x = Math.PI / 2;

    scene.add(asteroidPath);
    scene.add(asteroid);
    asteroids.push({ asteroid, path });
}

// Function to animate the movement of asteroids along their paths
function animateAsteroids() {
    const time = Date.now() * 0.0001; // Speed factor for movement

    asteroids.forEach(({ asteroid, path }) => {
        const point = path.getPointAt(time % 1); // Loop through the circular orbit
        asteroid.position.set(point.x, point.y, point.z);
    });
}

// Fetch asteroids and create them
async function fetchAsteroidData() {
    try {
        const apiKey = 'gi7DKGrKQSYU2v8xuWWhHW7t88M9IGpC4oeLbUUT'; // Replace with your NASA API key
        const startDate = '2024-01-01';
        const endDate = '2024-01-08';
        const response = await fetch(`https://api.nasa.gov/neo/rest/v1/feed?start_date=${startDate}&end_date=${endDate}&api_key=${apiKey}`);
        const data = await response.json();

        const neoData = Object.values(data.near_earth_objects).flat();
        neoData.forEach(asteroid => createAsteroid(asteroid));

    } catch (error) {
        console.error("Error fetching asteroid data:", error);
    }
}

fetchAsteroidData();

// Resize event listener to handle window resizing
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Animate everything (including asteroids and planets)
function animate() {
    requestAnimationFrame(animate);

    // Rotate planets
    planets.forEach(planet => {
        planet.rotation.y += 0.01;
    });

    // Animate asteroids
    animateAsteroids();

    controls.update();
    renderer.render(scene, camera);
}

animate();
