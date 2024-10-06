// Scene, Camera, Renderer
const scene = new THREE.Scene();
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Ambient light for softer lighting
const ambientLight = new THREE.AmbientLight(0x404040, 1.2);
scene.add(ambientLight);

// Point light (Sunlight)
const sunLight = new THREE.PointLight(0xffffff, 2, 1000);
scene.add(sunLight);

// Camera setup
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000000);
camera.position.set(0, 0, 1000); // Start further out to see all objects

// Orbit Controls
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableZoom = true;
controls.zoomSpeed = 0.8;  // Adjust zoom speed for a better user experience
controls.enablePan = true;  // Allow panning
controls.minDistance = 10;  // Allow closer zoom
controls.maxDistance = 50000;  // Allow further zoom for wider scene view

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

// Load dot texture (small circular dot texture for sprites)
const dotTexture = textureLoader.load('textures/dot.png');

// Create planet marker sprite (dot)
function createPlanetSprite() {
    const spriteMaterial = new THREE.SpriteMaterial({
        map: dotTexture,
        color: 0xffffff,
        sizeAttenuation: false, // Keep size constant regardless of zoom
    });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(0.5, 0.5, 0.5); // Adjust the size to make the dot visible
    return sprite;
}

// Function to create text labels
function createTextLabel(text, position) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    context.font = '70px Arial';
    context.fillStyle = 'white';
    context.fillText(text, 0, 24); // Text starts at (0,24)

    const texture = new THREE.Texture(canvas);
    texture.needsUpdate = true;

    const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.position.copy(position);
    sprite.scale.set(10, 5, 1); // Scale the label appropriately
    scene.add(sprite);
}

// Create orbit path
function createOrbitPath(distance, eccentricity, color = 0xCD5C5C) {
    const orbitCurve = new THREE.EllipseCurve(0, 0, distance, distance * (1 - eccentricity));
    const orbitPoints = orbitCurve.getPoints(100);
    const orbitGeometry = new THREE.BufferGeometry().setFromPoints(orbitPoints);
    const orbitMaterial = new THREE.LineBasicMaterial({ color });
    const orbitPath = new THREE.Line(orbitGeometry, orbitMaterial);
    orbitPath.rotation.x = Math.PI / 2; // Rotate for the elliptical plane
    scene.add(orbitPath);
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

        document.getElementById('loading-screen').style.display = 'none';

    } catch (error) {
        console.error("Error fetching planetary data:", error);
    }
}

// Create planet function with orbits and sprites
function createPlanet(planetData) {
    const sizeScaleFactor = 0.008; // Scale down for visibility
    const distanceScaleFactor = 50000; // Scale down distances for planets

    const planetRadius = planetData.meanRadius * sizeScaleFactor; 
    const planetDistance = planetData.semimajorAxis / distanceScaleFactor; 

    // Create the planet object
    const planetMaterial = new THREE.MeshStandardMaterial({
        map: planetTextures[planetData.englishName.toLowerCase()] || textureLoader.load('./textures/default.jpg')
    });

    const planetGeometry = new THREE.SphereGeometry(planetRadius, 32, 32);
    const planet = new THREE.Mesh(planetGeometry, planetMaterial);

    // Position planet at the scaled distance
    planet.position.set(planetDistance, 0, 0);
    scene.add(planet);
    
    // Create elliptical orbit path for the planet
    createOrbitPath(planetDistance, planetData.eccentricity);

    const sprite = createPlanetSprite();
    sprite.position.copy(planet.position);
    scene.add(sprite);

    planets.push(planet);
    planetSprites.push(sprite);

    // Create moons for specific planets (using rough positions for demonstration)
    if (planetData.englishName === "Earth") {
        createMoon(planet, 1, 0.5, 10, "Moon"); // Moon size, distance, and orbit size
    } else if (planetData.englishName === "Mars") {
        createMoon(planet, 0.5, 1.5, 5, "Phobos"); // Phobos orbits
        createMoon(planet, 0.5, 1.8, 5, "Deimos"); // Deimos orbits
    }
}

// Function to create moons
function createMoon(planet, moonRadius, orbitDistance, orbitSize, moonName) {
    const moonGeometry = new THREE.SphereGeometry(moonRadius, 16, 16);
    const moonMaterial = new THREE.MeshStandardMaterial({ color: 0xaaaaaa }); // Light gray for moons
    const moon = new THREE.Mesh(moonGeometry, moonMaterial);

    // Position the moon relative to the planet
    moon.position.set(orbitDistance, 0, 0); // Position it on the orbit

    // Create an orbit path for the moon
    createOrbitPath(orbitSize, 0, 0xaaaaaa); // Light gray for moon orbit
    planet.add(moon); // Attach moon to the planet

    // Create text label for the moon
    createTextLabel(moonName, moon.position.clone());
}

// Fetch asteroid data and create asteroids
async function fetchAsteroidData() {
    try {
        const apiKey = 'zEdYwpHwjkkW3hZe5d2gQRg3fVX2Fn4Vi5ebOgXL'; // Use your own key
        const startDate = '2024-01-01';
        const endDate = '2024-01-08';
        const response = await fetch(`https://api.nasa.gov/neo/rest/v1/feed?start_date=${startDate}&end_date=${endDate}&api_key=${apiKey}`);
        const data = await response.json();

        const neoData = Object.values(data.near_earth_objects).flat();
        console.log(`Total Asteroids: ${neoData.length}`);

        neoData.forEach(asteroid => fetchAsteroidOrbitalData(asteroid.id));

    } catch (error) {
        console.error("Error fetching asteroid data:", error);
    }
}

// Fetch orbital data for asteroids
async function fetchAsteroidOrbitalData(asteroidId) {
    try {
        const apiKey = 'zEdYwpHwjkkW3hZe5d2gQRg3fVX2Fn4Vi5ebOgXL'; // Use your own key
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

// Create asteroid and its orbit
function createAsteroid(a, e, i, Ω, ω, M) {
    const distanceScaleFactor = 50000; // Scale down distances for asteroids
    const asteroidDistance = a * 149597870.7 / distanceScaleFactor; // Convert AU to km and scale

    // Create asteroid geometry and material
    const asteroidGeometry = new THREE.SphereGeometry(0.5, 16, 16);  
    const asteroidMaterial = new THREE.MeshStandardMaterial({ color: 0xffff00 });  // Yellow for visibility
    const asteroid = new THREE.Mesh(asteroidGeometry, asteroidMaterial);

    // Random angle for asteroid's orbit
    const randomAngle = Math.random() * Math.PI * 2; 
    const x = Math.cos(randomAngle) * asteroidDistance;
    const z = Math.sin(randomAngle) * asteroidDistance;

    asteroid.position.set(x, 0, z);
    scene.add(asteroid);
    
    // Create orbit path for asteroid
    createOrbitPath(asteroidDistance, e, 0xffff00); // Yellow orbit
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

// Add raycasting to detect hover on orbits
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// Add an event listener for mouse clicks
window.addEventListener('click', onPlanetClick, false);

function onPlanetClick(event) {
    // Convert mouse click coordinates to normalized device coordinates (-1 to +1)
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // Update the raycaster with the camera and mouse position
    raycaster.setFromCamera(mouse, camera);

    // Check for intersections with planets
    const intersects = raycaster.intersectObjects(planets);

    if (intersects.length > 0) {
        const clickedPlanet = intersects[0].object;

        // Move the camera to the clicked planet
        const targetPosition = clickedPlanet.position.clone().add(new THREE.Vector3(0, 0, -100)); // Move closer in front of the planet

        // Animate the camera to the new position
        new TWEEN.Tween(camera.position)
            .to({ x: targetPosition.x, y: targetPosition.y, z: targetPosition.z }, 2000)
            .easing(TWEEN.Easing.Quadratic.InOut)
            .onUpdate(() => {
                // Update controls target
                controls.target.copy(clickedPlanet.position);
            })
            .start();
    }
}

// Update the animate function to include TWEEN updates
function animate() {
    requestAnimationFrame(animate);

    // Rotate planets
    planets.forEach(planet => planet.rotation.y += 0.01);

    controls.update();

    // Update TWEEN animations
    TWEEN.update();

    renderer.render(scene, camera);
}

// Fetch data
fetchPlanetaryData();
fetchAsteroidData();
animate();
