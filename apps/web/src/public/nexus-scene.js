import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js";

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const assignedAgentColors = new Map();
const assignedAgentHues = new Map();
const minimumHueDistance = 0.055;
const goldenRatioConjugate = 0.61803398875;

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function hueDistance(left, right) {
  const distance = Math.abs(left - right);
  return Math.min(distance, 1 - distance);
}

function hslToHex(hue, saturation, lightness) {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const x = chroma * (1 - Math.abs(((hue * 6) % 2) - 1));
  const match = lightness - chroma / 2;
  const sector = Math.floor(hue * 6);
  const [r1, g1, b1] =
    sector === 0
      ? [chroma, x, 0]
      : sector === 1
        ? [x, chroma, 0]
        : sector === 2
          ? [0, chroma, x]
          : sector === 3
            ? [0, x, chroma]
            : sector === 4
              ? [x, 0, chroma]
              : [chroma, 0, x];
  const r = Math.round((r1 + match) * 255);
  const g = Math.round((g1 + match) * 255);
  const b = Math.round((b1 + match) * 255);
  return (r << 16) + (g << 8) + b;
}

function colorForAgent(agentId) {
  if (assignedAgentColors.has(agentId)) return assignedAgentColors.get(agentId);

  let hue = (hashString(agentId) % 360) / 360;
  const usedHues = [...assignedAgentHues.values()];
  let attempts = 0;

  while (usedHues.some((usedHue) => hueDistance(hue, usedHue) < minimumHueDistance) && attempts < 24) {
    hue = (hue + goldenRatioConjugate) % 1;
    attempts += 1;
  }

  const color = hslToHex(hue, 0.82, 0.62);
  assignedAgentHues.set(agentId, hue);
  assignedAgentColors.set(agentId, color);
  return color;
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
  container.style.position = container.style.position || "relative";
  container.appendChild(renderer.domElement);

  const tooltip = document.createElement("div");
  tooltip.style.cssText =
    "position:absolute;z-index:4;max-width:240px;padding:10px 12px;border:1px solid rgba(57,255,136,0.32);border-radius:6px;background:rgba(0,8,5,0.92);box-shadow:0 16px 40px rgba(0,0,0,0.36);color:#e9fff3;font:12px/1.35 system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;pointer-events:none;opacity:0;transform:translate3d(0,0,0);transition:opacity 120ms ease;";
  const tooltipName = document.createElement("div");
  tooltipName.style.cssText = "font-weight:700;color:#f0fff5;";
  const tooltipMeta = document.createElement("div");
  tooltipMeta.style.cssText = "margin-top:3px;color:#86a996;";
  const tooltipTags = document.createElement("div");
  tooltipTags.style.cssText = "margin-top:6px;color:#39ff88;";
  tooltip.append(tooltipName, tooltipMeta, tooltipTags);
  container.appendChild(tooltip);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(46, width / height, 0.1, 100);
  camera.position.set(0, 0, 6.1);
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

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
  let activeAgentProfiles = {};
  let activeAgentNodeIndices = new Map();

  function nodeIndexForAgent(agentId, usedIndices) {
    let nodeIndex = hashString(agentId) % nodeCount;
    while (usedIndices.has(nodeIndex)) {
      nodeIndex = (nodeIndex + 1) % nodeCount;
    }
    usedIndices.add(nodeIndex);
    return nodeIndex;
  }

  function updateNexusCounters(summary) {
    const hasRunConfig = Boolean(window.__RUN_EVENTS_CONFIG__);
    const totalAgents = Number.isFinite(summary?.totalAgents) ? summary.totalAgents : connected;
    const activeCount = Number.isFinite(summary?.activeAgentsCount)
      ? summary.activeAgentsCount
      : hasRunConfig
        ? activeAgents.length
        : activeAgents.length || live;
    const queuedCount = Number.isFinite(summary?.queuedAgentsCount) ? summary.queuedAgentsCount : 0;
    const signalCount = Number.isFinite(summary?.eventCount) ? summary.eventCount : 0;

    for (const element of document.querySelectorAll("[data-nexus-connected-value]")) {
      element.textContent = String(totalAgents);
    }
    for (const element of document.querySelectorAll("[data-nexus-live-value]")) {
      element.textContent = String(activeCount);
    }
    for (const element of document.querySelectorAll("[data-nexus-signal-value]")) {
      element.textContent = String(signalCount);
    }

    container.dataset.activeAgents = String(activeCount);
    container.dataset.queuedAgents = String(queuedCount);
    container.setAttribute(
      "aria-label",
      `Nexus network: ${totalAgents} connected agents, ${activeCount} running now, ${queuedCount} queued. Running agents are highlighted with stable unique colors.`
    );
  }

  function updateAgentNodes(nextActiveAgents, summary = {}) {
    activeAgents = Array.isArray(nextActiveAgents)
      ? nextActiveAgents
          .map((agent) => (typeof agent === "string" ? agent : agent?.agentId))
          .filter(Boolean)
      : [];
    activeAgentProfiles = summary?.agentProfiles && typeof summary.agentProfiles === "object" ? summary.agentProfiles : {};
    activeAgentNodeIndices = new Map();
    const usedIndices = new Set();
    hideTooltip();

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

    activeAgents.forEach((agentId) => {
      const nodeIndex = nodeIndexForAgent(agentId, usedIndices);
      activeAgentNodeIndices.set(agentId, nodeIndex);
      activeNodeColor.setHex(colorForAgent(agentId));
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
          depthTest: false,
          depthWrite: false
        })
      );
      marker.position.copy(positions[nodeIndex].clone().multiplyScalar(1.01));
      marker.userData.agentId = agentId;
      marker.userData.agentProfile = activeAgentProfiles[agentId] || null;
      marker.userData.baseScale = 1;
      marker.userData.baseOpacity = 0.95;
      marker.userData.phase = (hashString(agentId) % 628) / 100;
      marker.userData.kind = "marker";
      activeMarkers.add(marker);

      const glow = new THREE.Mesh(
        new THREE.SphereGeometry(0.14, 18, 18),
        new THREE.MeshBasicMaterial({
          color: activeNodeColor.clone(),
          transparent: true,
          opacity: 0.18,
          blending: THREE.AdditiveBlending,
          depthTest: false,
          depthWrite: false
        })
      );
      glow.position.copy(marker.position);
      glow.userData.agentId = agentId;
      glow.userData.agentProfile = activeAgentProfiles[agentId] || null;
      glow.userData.baseScale = 1;
      glow.userData.baseOpacity = 0.18;
      glow.userData.phase = marker.userData.phase;
      glow.userData.kind = "glow";
      activeMarkers.add(glow);
    });

    nodes.instanceColor.needsUpdate = true;
    nodes.instanceMatrix.needsUpdate = true;
    updateNexusCounters(summary);
  }

  function hideTooltip() {
    tooltip.style.opacity = "0";
  }

  function showTooltip(event, marker) {
    const profile = marker.userData.agentProfile || {};
    const agentId = marker.userData.agentId || "";
    const rect = container.getBoundingClientRect();
    const maxX = Math.max(10, rect.width - 250);
    const maxY = Math.max(10, rect.height - 90);
    const x = Math.min(maxX, Math.max(10, event.clientX - rect.left + 14));
    const y = Math.min(maxY, Math.max(10, event.clientY - rect.top + 14));
    tooltipName.textContent = profile.displayName || `Agent ${agentId.slice(0, 8)}`;
    tooltipMeta.textContent = profile.powerLevel
      ? `${profile.powerLabel || `PL${profile.powerLevel}`} | ${profile.subtitle || "Synthetic agent"}`
      : profile.subtitle || "Synthetic agent";
    tooltipTags.textContent = Array.isArray(profile.tags) ? profile.tags.slice(0, 3).join(" / ") : "";
    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y}px`;
    tooltip.style.opacity = "1";
  }

  function updateHover(event) {
    if (dragging) {
      hideTooltip();
      return;
    }

    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
    raycaster.setFromCamera(pointer, camera);
    const markerObjects = activeMarkers.children.filter((marker) => marker.userData.kind === "marker");
    const hits = raycaster.intersectObjects(markerObjects, false);
    if (hits.length > 0) {
      showTooltip(event, hits[0].object);
    } else {
      hideTooltip();
    }
  }

  function addArc() {
    if (prefersReducedMotion || arcs.children.length > 10) return;
    const highlighted = [...activeAgentNodeIndices.values()];
    const startIndex = highlighted.length > 0 ? highlighted[Math.floor(Math.random() * highlighted.length)] : Math.floor(Math.random() * positions.length);
    let endIndex = Math.floor(Math.random() * positions.length);
    if (endIndex === startIndex) endIndex = (endIndex + 7) % positions.length;
    const palette = highlighted.length > 0 ? activeAgents.map((agentId) => colorForAgent(agentId)) : [0x39ff88, 0x65b7ff, 0xf2d15b];
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
    hideTooltip();
  };

  const onPointerUp = (event) => {
    dragging = false;
    container.releasePointerCapture?.(event.pointerId);
  };

  container.addEventListener("pointerdown", onPointerDown);
  container.addEventListener("pointermove", onPointerMove);
  container.addEventListener("pointermove", updateHover);
  container.addEventListener("pointerup", onPointerUp);
  container.addEventListener("pointercancel", onPointerUp);
  container.addEventListener("pointerleave", hideTooltip);

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  updateAgentNodes(deriveActiveAgentsFromEvents(window.__RUN_EVENTS_CONFIG__?.initialEvents));
  window.addEventListener("nexus:agents", (event) => {
    updateAgentNodes(event.detail?.activeAgents, event.detail);
  });

  let frame = 0;
  function animate() {
    frame += 1;
    if (!prefersReducedMotion && !interactionPaused) {
      root.rotation.y += 0.0017;
      root.rotation.x = Math.sin(frame * 0.006) * 0.045;
    }

    if (frame % 118 === 0) addArc();

    if (!prefersReducedMotion) {
      for (const marker of activeMarkers.children) {
        const pulse = Math.sin(frame * 0.045 + marker.userData.phase);
        const scaleAmount = marker.userData.kind === "glow" ? 1 + pulse * 0.22 : 1 + pulse * 0.08;
        marker.scale.setScalar(marker.userData.baseScale * scaleAmount);
        marker.material.opacity = Math.max(0, marker.userData.baseOpacity + pulse * (marker.userData.kind === "glow" ? 0.06 : 0.08));
      }
    }

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
