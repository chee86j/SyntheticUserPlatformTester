import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js";

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const agentPalette = [
  0x39ff88,
  0x65b7ff,
  0xf2d15b,
  0xff6f91,
  0xa8ff60,
  0x00d4ff,
  0xff9f43,
  0xc084fc,
  0x5cffc9,
  0xfff4a3,
  0x7dd3fc,
  0xf472b6
];

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function colorForAgent(agentId, index) {
  return agentPalette[index % agentPalette.length] ?? agentPalette[hashString(agentId) % agentPalette.length];
}

function deriveActiveAgentsFromEvents(events) {
  if (!Array.isArray(events)) return [];
  const statusByAgent = new Map();
  const sorted = [...events].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  for (const event of sorted) {
    if (!event || !event.agentId) continue;
    if (event.eventType === "agent.started") statusByAgent.set(event.agentId, "active");
    if (event.eventType === "agent.completed") statusByAgent.set(event.agentId, "completed");
    if (event.eventType === "agent.failed") statusByAgent.set(event.agentId, "failed");
    if (event.eventType === "agent.cancelled") statusByAgent.set(event.agentId, "cancelled");
  }

  return [...statusByAgent.entries()]
    .filter(([, status]) => status === "active")
    .map(([agentId]) => agentId)
    .sort((left, right) => left.localeCompare(right));
}

function sphericalPoint(index, count, radius) {
  const offset = 2 / count;
  const increment = Math.PI * (3 - Math.sqrt(5));
  const y = index * offset - 1 + offset / 2;
  const r = Math.sqrt(1 - y * y);
  const phi = index * increment;
  return new THREE.Vector3(Math.cos(phi) * r * radius, y * radius, Math.sin(phi) * r * radius);
}

function makeArc(start, end, color) {
  const mid = start.clone().add(end).normalize().multiplyScalar(2.08);
  const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
  const points = curve.getPoints(38);
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.46,
    blending: THREE.AdditiveBlending
  });
  const line = new THREE.Line(geometry, material);
  line.userData.life = 1;
  return line;
}

function mountNexusScene(container) {
  const connected = Number(container.dataset.connected || "128");
  const live = Number(container.dataset.live || "24");
  const nodeCount = Math.max(42, Math.min(220, connected));
  const width = container.clientWidth || 800;
  const height = container.clientHeight || 520;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height);
  renderer.setClearColor(0x000000, 0);
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(46, width / height, 0.1, 100);
  camera.position.set(0, 0, 6.1);

  const root = new THREE.Group();
  scene.add(root);

  const shellGeometry = new THREE.SphereGeometry(2, 36, 18);
  const shellMaterial = new THREE.MeshBasicMaterial({
    color: 0x39ff88,
    transparent: true,
    opacity: 0.035,
    wireframe: true
  });
  root.add(new THREE.Mesh(shellGeometry, shellMaterial));

  const nodeGeometry = new THREE.SphereGeometry(0.026, 10, 10);
  const nodeMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    vertexColors: true,
    transparent: true,
    opacity: 0.86
  });
  const nodes = new THREE.InstancedMesh(nodeGeometry, nodeMaterial, nodeCount);
  nodes.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  nodes.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(nodeCount * 3), 3);
  const dummy = new THREE.Object3D();
  const positions = [];
  const baseNodeColor = new THREE.Color(0x8dffb3);
  const activeNodeColor = new THREE.Color();

  for (let index = 0; index < nodeCount; index += 1) {
    const position = sphericalPoint(index, nodeCount, 2);
    positions.push(position);
    dummy.position.copy(position);
    dummy.updateMatrix();
    nodes.setMatrixAt(index, dummy.matrix);
    nodes.setColorAt(index, baseNodeColor);
  }
  nodes.instanceColor.needsUpdate = true;

  root.add(nodes);

  const activeMarkers = new THREE.Group();
  root.add(activeMarkers);

  const core = new THREE.Mesh(
    new THREE.SphereGeometry(1.16, 32, 16),
    new THREE.MeshBasicMaterial({ color: 0x39ff88, transparent: true, opacity: 0.035 })
  );
  root.add(core);

  const arcs = new THREE.Group();
  root.add(arcs);

  let interactionPaused = false;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let activeAgents = [];
  let activeAgentNodeIndices = new Map();

  function nodeIndexForAgent(agentId, usedIndices) {
    let nodeIndex = hashString(agentId) % nodeCount;
    while (usedIndices.has(nodeIndex)) {
      nodeIndex = (nodeIndex + 1) % nodeCount;
    }
    usedIndices.add(nodeIndex);
    return nodeIndex;
  }

  function updateAgentNodes(nextActiveAgents) {
    activeAgents = Array.isArray(nextActiveAgents) ? nextActiveAgents.filter(Boolean) : [];
    activeAgentNodeIndices = new Map();
    const usedIndices = new Set();

    for (const marker of activeMarkers.children) {
      marker.geometry.dispose();
      marker.material.dispose();
    }
    activeMarkers.clear();

    for (let index = 0; index < nodeCount; index += 1) {
      nodes.setColorAt(index, baseNodeColor);
      dummy.position.copy(positions[index]);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      nodes.setMatrixAt(index, dummy.matrix);
    }

    activeAgents.forEach((agentId, agentIndex) => {
      const nodeIndex = nodeIndexForAgent(agentId, usedIndices);
      activeAgentNodeIndices.set(agentId, nodeIndex);
      activeNodeColor.setHex(colorForAgent(agentId, agentIndex));
      dummy.position.copy(positions[nodeIndex]);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      nodes.setMatrixAt(nodeIndex, dummy.matrix);

      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(0.072, 18, 18),
        new THREE.MeshBasicMaterial({
          color: activeNodeColor.clone(),
          transparent: true,
          opacity: 0.95,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      );
      marker.position.copy(positions[nodeIndex].clone().multiplyScalar(1.01));
      marker.userData.agentId = agentId;
      activeMarkers.add(marker);

      const glow = new THREE.Mesh(
        new THREE.SphereGeometry(0.14, 18, 18),
        new THREE.MeshBasicMaterial({
          color: activeNodeColor.clone(),
          transparent: true,
          opacity: 0.18,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      );
      glow.position.copy(marker.position);
      glow.userData.agentId = agentId;
      activeMarkers.add(glow);
    });

    nodes.instanceColor.needsUpdate = true;
    nodes.instanceMatrix.needsUpdate = true;
    container.dataset.activeAgents = String(activeAgents.length);
    container.setAttribute(
      "aria-label",
      `Nexus network: ${connected} connected people, ${activeAgents.length || live} live now. ${activeAgents.length} running agents are highlighted with unique colors.`
    );
  }

  function addArc() {
    if (prefersReducedMotion || arcs.children.length > 10) return;
    const highlighted = [...activeAgentNodeIndices.values()];
    const startIndex = highlighted.length > 0 ? highlighted[Math.floor(Math.random() * highlighted.length)] : Math.floor(Math.random() * positions.length);
    let endIndex = Math.floor(Math.random() * positions.length);
    if (endIndex === startIndex) endIndex = (endIndex + 7) % positions.length;
    const palette = highlighted.length > 0 ? activeAgents.map((agentId, index) => colorForAgent(agentId, index)) : [0x39ff88, 0x65b7ff, 0xf2d15b];
    arcs.add(makeArc(positions[startIndex], positions[endIndex], palette[Math.floor(Math.random() * palette.length)]));
  }

  function resize() {
    const nextWidth = container.clientWidth || width;
    const nextHeight = container.clientHeight || height;
    camera.aspect = nextWidth / nextHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(nextWidth, nextHeight);
  }

  const onPointerDown = (event) => {
    interactionPaused = true;
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
    container.setPointerCapture?.(event.pointerId);
  };

  const onPointerMove = (event) => {
    if (!dragging) return;
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    root.rotation.y += dx * 0.006;
    root.rotation.x += dy * 0.004;
    root.rotation.x = Math.max(-0.9, Math.min(0.9, root.rotation.x));
    lastX = event.clientX;
    lastY = event.clientY;
  };

  const onPointerUp = (event) => {
    dragging = false;
    container.releasePointerCapture?.(event.pointerId);
  };

  container.addEventListener("pointerdown", onPointerDown);
  container.addEventListener("pointermove", onPointerMove);
  container.addEventListener("pointerup", onPointerUp);
  container.addEventListener("pointercancel", onPointerUp);

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  updateAgentNodes(deriveActiveAgentsFromEvents(window.__RUN_EVENTS_CONFIG__?.initialEvents));
  window.addEventListener("nexus:agents", (event) => {
    updateAgentNodes(event.detail?.activeAgents);
  });

  let frame = 0;
  function animate() {
    frame += 1;
    if (!prefersReducedMotion && !interactionPaused) {
      root.rotation.y += 0.0017;
      root.rotation.x = Math.sin(frame * 0.006) * 0.045;
    }

    if (frame % 118 === 0) addArc();

    for (let index = arcs.children.length - 1; index >= 0; index -= 1) {
      const arc = arcs.children[index];
      arc.userData.life -= 0.008;
      arc.material.opacity = Math.max(0, arc.userData.life * 0.46);
      if (arc.userData.life <= 0) {
        arc.geometry.dispose();
        arc.material.dispose();
        arcs.remove(arc);
      }
    }

    renderer.render(scene, camera);
    window.requestAnimationFrame(animate);
  }

  container.setAttribute(
    "aria-label",
    `Nexus network: ${connected} connected people, ${live} live now.`
  );
  animate();
}

for (const container of document.querySelectorAll("[data-nexus-scene]")) {
  mountNexusScene(container);
}
