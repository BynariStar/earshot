// AI-generated: written by Claude (Anthropic AI assistant) for team Earshot, NASA Space Apps 2026.
// Reviewed and directed by the team. See AI_USE.md.
// A rotatable 3D schematic (three.js). Each part is a cylinder (or sphere) coloured by its noise level.
// Drag to rotate, scroll or pinch to zoom, tap a part to select it.
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { noiseColor } from '../lib/issLayout.js';

const STRUCT_COLOR = '#4a5068';

function makeMesh(p) {
  let geo;
  if (p.box) geo = new THREE.BoxGeometry(...p.box);
  else if (p.theta) {
    // A solid wedge of a vertical cylinder: an arc-shaped outline extruded upward, centred on pos.
    const [a0, len] = p.theta;
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(p.r * Math.cos(a0), p.r * Math.sin(a0));
    shape.absarc(0, 0, p.r, a0, a0 + len, false);
    shape.lineTo(0, 0);
    geo = new THREE.ExtrudeGeometry(shape, { depth: p.len, bevelEnabled: false, curveSegments: 24 });
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, -p.len / 2, 0);
  } else if (p.sphere) geo = new THREE.SphereGeometry(p.r, 24, 16);
  else {
    geo = new THREE.CylinderGeometry(p.rTop ?? p.r, p.r, p.len, 28, 1);
    if (p.axis === 'x') geo.rotateZ(Math.PI / 2);
    if (p.axis === 'z') geo.rotateX(Math.PI / 2);
  }
  const mat = new THREE.MeshStandardMaterial({ color: STRUCT_COLOR, roughness: 0.55, metalness: 0.15, emissive: '#000000' });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(...p.pos);
  mesh.userData.id = p.id;
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 25), new THREE.LineBasicMaterial({ color: '#0b1020', transparent: true, opacity: 0.35 }));
  mesh.add(edges);
  return mesh;
}

function addIssDecor(scene) {
  // Main truss and solar arrays, for recognisability only (grey, not selectable).
  const grey = new THREE.MeshStandardMaterial({ color: '#3a4058', roughness: 0.9, transparent: true, opacity: 0.8 });
  const truss = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.0, 92), grey);
  truss.position.set(7, 3.8, 0);
  scene.add(truss);
  const panelMat = new THREE.MeshStandardMaterial({ color: '#23345f', roughness: 0.5, metalness: 0.2, side: THREE.DoubleSide, transparent: true, opacity: 0.35, depthWrite: false });
  for (const z of [-42, -32, 32, 42]) {
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(48, 8), panelMat);
    panel.rotation.x = -Math.PI / 2;
    panel.rotation.y = 0.35;
    panel.position.set(7, 3.8, z);
    scene.add(panel);
  }
}

// A round patch of terrain whose edge fades into the background, like a tabletop model, so no hard edge
// or horizon is ever visible.
function addGround(scene, color, radius = 13) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.55, '#ffffff');
  grad.addColorStop(1, '#000000');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  const alpha = new THREE.CanvasTexture(c);
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 64),
    new THREE.MeshStandardMaterial({ color, roughness: 1, transparent: true, alphaMap: alpha, depthWrite: false })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.01;
  ground.renderOrder = -1;
  scene.add(ground);
}

// "You are here": a constant-size label above the crew member's module, drawn on top of everything.
function makeYouMarker() {
  const c = document.createElement('canvas');
  c.width = 160;
  c.height = 96;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.roundRect(20, 8, 120, 52, 26);
  g.fill();
  g.beginPath();
  g.moveTo(68, 58);
  g.lineTo(80, 80);
  g.lineTo(92, 58);
  g.fill();
  g.fillStyle = '#0b1020';
  g.font = '600 32px Inter, system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('You', 80, 35);
  const tex = new THREE.CanvasTexture(c);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, sizeAttenuation: false }));
  sprite.scale.set(0.09, 0.054, 1);
  sprite.center.set(0.5, 0.05);
  sprite.renderOrder = 10;
  sprite.visible = false;
  return sprite;
}

// The swing-in plays once per app load, not every time the map is shown again.
let introPlayed = false;

export default function Station3D({ parts, levels, selected, onSelect, decor = 'iss', camera = [42, 34, 58], target = [-4, -2, 0], highlight, you = null, offsetRight = 0, viewRef, callouts = [], onCallout }) {
  const mountRef = useRef(null);
  const markerRef = useRef(null);
  const camRef = useRef(null);
  const calloutsRef = useRef([]); // [{ id, el }]
  const layerRef = useRef(null);
  const onCalloutRef = useRef(onCallout);
  onCalloutRef.current = onCallout;
  const offsetRef = useRef(offsetRight);
  offsetRef.current = offsetRight;
  // Keep the station centred in the part of the map a side panel leaves free.
  const applyOffset = (cam, w, h) => {
    const off = offsetRef.current;
    if (off > 0 && w > off * 1.6) cam.setViewOffset(w, h, off / 2, 0, w, h);
    else cam.clearViewOffset();
  };
  const meshesRef = useRef({});
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const levelsRef = useRef(levels);
  levelsRef.current = levels;
  const hiList = Array.isArray(highlight) ? highlight : highlight ? [highlight] : [];
  const hiKey = hiList.join(',');
  const highlightRef = useRef(hiList);
  highlightRef.current = hiList;
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  // Build the scene once per part list.
  useEffect(() => {
    const mount = mountRef.current;
    const width = mount.clientWidth;
    const height = mount.clientHeight;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(40, width / height, 0.5, 1000);
    camRef.current = cam;
    applyOffset(cam, width, height);
    cam.position.set(...camera);
    // Narrow screens: step the camera back so the whole station still fits.
    if (width / height < 1) cam.position.sub(new THREE.Vector3(...target)).multiplyScalar(Math.min(1.9, 0.9 / (width / height))).add(new THREE.Vector3(...target));
    scene.add(new THREE.AmbientLight('#ffffff', 0.9));
    const sun = new THREE.DirectionalLight('#ffffff', 1.6);
    sun.position.set(40, 80, 30);
    scene.add(sun);
    const fill = new THREE.DirectionalLight('#9fb4ff', 0.5);
    fill.position.set(-50, -20, -40);
    scene.add(fill);

    const meshes = {};
    for (const p of parts) {
      const m = makeMesh(p);
      scene.add(m);
      meshes[p.id] = m;
    }
    meshesRef.current = meshes;
    const marker = makeYouMarker();
    scene.add(marker);
    markerRef.current = marker;
    if (decor === 'iss') addIssDecor(scene);
    if (decor === 'moon') addGround(scene, '#3b3e48', 11);
    if (decor === 'mars') addGround(scene, '#6a3220', 15);

    const controls = new OrbitControls(cam, renderer.domElement);
    controls.target.set(...target);
    controls.enableDamping = true;
    controls.minDistance = 12;
    controls.maxDistance = 180;


    // Optional on-map buttons (behind a toggle): turn, zoom, reset, without dragging.
    const home = cam.position.clone();
    if (viewRef) {
      viewRef.current = {
        rotate: (dir) => {
          const off = cam.position.clone().sub(controls.target);
          off.applyAxisAngle(new THREE.Vector3(0, 1, 0), (dir * Math.PI) / 8);
          cam.position.copy(controls.target).add(off);
        },
        zoom: (f) => {
          const off = cam.position.clone().sub(controls.target).multiplyScalar(f);
          const len = Math.min(controls.maxDistance, Math.max(controls.minDistance, off.length()));
          cam.position.copy(controls.target).add(off.setLength(len));
        },
        reset: () => {
          cam.position.copy(home);
          controls.target.set(...target);
        },
      };
    }

    // Tap / click to select (ignore drags).
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let down = null;
    const onDown = (e) => (down = { x: e.clientX, y: e.clientY });
    const onUp = (e) => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 10) return;
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      const tryAt = (dx, dy) => {
        ndc.set(((e.clientX + dx - rect.left) / rect.width) * 2 - 1, -((e.clientY + dy - rect.top) / rect.height) * 2 + 1);
        ray.setFromCamera(ndc, cam);
        return ray.intersectObjects(Object.values(meshes), false)[0];
      };
      // A tap that lands slightly off a module still selects it: try rings of nearby points.
      let hit = tryAt(0, 0);
      for (const r of [14, 26, 38]) {
        if (hit) break;
        for (let k = 0; k < 8 && !hit; k++) hit = tryAt(r * Math.cos((k * Math.PI) / 4), r * Math.sin((k * Math.PI) / 4));
      }
      if (hit) onSelectRef.current?.(hit.object.userData.id);
    };
    // Hover label: name and level of the part under the pointer.
    const tip = document.createElement('div');
    tip.className = 'tip3d';
    mount.appendChild(tip);
    const onMove = (e) => {
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      ray.setFromCamera(ndc, cam);
      const hit = ray.intersectObjects(Object.values(meshes), false)[0];
      if (!hit) {
        tip.style.display = 'none';
        renderer.domElement.style.cursor = '';
        return;
      }
      const part = parts.find((p) => p.id === hit.object.userData.id);
      const v = levelsRef.current[part.id];
      tip.textContent = `${part.label}${part.struct ? '' : Number.isFinite(v) ? ` · ${v.toFixed(1)} dBA` : ' · no value'}`;
      tip.style.display = 'block';
      tip.style.left = `${e.clientX - rect.left + 12}px`;
      tip.style.top = `${e.clientY - rect.top + 12}px`;
      renderer.domElement.style.cursor = 'pointer';
    };
    const onLeave = () => (tip.style.display = 'none');
    renderer.domElement.addEventListener('pointerdown', onDown);
    renderer.domElement.addEventListener('pointerup', onUp);
    renderer.domElement.addEventListener('pointermove', onMove);
    renderer.domElement.addEventListener('pointerleave', onLeave);

    // Callout layer: HTML labels pinned above modules, repositioned every frame.
    const layer = document.createElement('div');
    layer.className = 'callout-layer';
    mount.appendChild(layer);
    layerRef.current = layer;
    const v = new THREE.Vector3();
    const box = new THREE.Box3();
    const placeCallouts = () => {
      const w = renderer.domElement.clientWidth;
      const h = renderer.domElement.clientHeight;
      // Anchor each callout above its module, then push overlapping ones upward so none hides another. The open
      // (expanded) callout is placed first so the "!" markers move out of its way, and the "You" label counts
      // as taken space.
      const placed = [];
      const mk = markerRef.current;
      if (mk?.visible) {
        v.copy(mk.position).project(cam);
        if (v.z <= 1) {
          const mw = mk.scale.x * h * 1.15;
          const mh = mk.scale.y * h * 1.15;
          placed.push({ x: ((v.x + 1) / 2) * w - mw / 2, y: ((1 - v.y) / 2) * h - mh, w: mw, h: mh });
        }
      }
      const order = [...calloutsRef.current].sort((a, b) => (b.open ? 1 : 0) - (a.open ? 1 : 0));
      for (const c of order) {
        const mesh = meshes[c.id];
        if (!mesh) continue;
        box.setFromObject(mesh);
        v.set((box.min.x + box.max.x) / 2, box.max.y, (box.min.z + box.max.z) / 2).project(cam);
        if (v.z > 1) {
          c.el.style.display = 'none';
          continue;
        }
        c.el.style.display = '';
        const cw = c.el.offsetWidth;
        const ch = c.el.offsetHeight;
        const x = ((v.x + 1) / 2) * w - cw / 2;
        let y = ((1 - v.y) / 2) * h - ch - c.lift;
        const gap = 14; // room for the pointer under each callout
        for (let guard = 0; guard < 8; guard++) {
          const hit = placed.find((p) => x < p.x + p.w + 6 && p.x < x + cw + 6 && y < p.y + p.h + gap && p.y < y + ch + gap);
          if (!hit) break;
          y = hit.y - ch - gap;
        }
        placed.push({ x, y, w: cw, h: ch });
        c.el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
      }
    };
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let raf;
    // Intro: once per app load, the station swings in to its resting view (about 1.6 s), then stays still.
    // A drag cancels it. Skipped when the system asks for reduced motion.
    let intro = null;
    if (!introPlayed && !still) {
      const end = new THREE.Spherical().setFromVector3(cam.position.clone().sub(controls.target));
      intro = { t0: null, end, from: { theta: end.theta + 0.75, phi: end.phi - 0.12, radius: end.radius * 1.25 } };
      renderer.domElement.addEventListener('pointerdown', () => { intro = null; introPlayed = true; }, { once: true });
    }
    const ease = (t) => 1 - (1 - t) ** 3;
    const loop = (now = 0) => {
      if (intro) {
        const tNow = performance.now();
        if (intro.t0 === null) intro.t0 = tNow;
        const k = ease(Math.min(1, (tNow - intro.t0) / 1600));
        const sph = new THREE.Spherical(
          intro.from.radius + (intro.end.radius - intro.from.radius) * k,
          intro.from.phi + (intro.end.phi - intro.from.phi) * k,
          intro.from.theta + (intro.end.theta - intro.from.theta) * k
        );
        cam.position.setFromSpherical(sph).add(controls.target);
        if (k >= 1) { intro = null; introPlayed = true; } // marked played only once it has run in full
      }
      for (const hi of highlightRef.current) {
        const m = meshes[hi];
        if (m && hi !== selectedRef.current) m.material.emissiveIntensity = still ? 0.6 : 0.15 + 0.6 * (0.5 + 0.5 * Math.sin(now / 260));
      }
      controls.update();
      placeCallouts();
      renderer.render(scene, cam);
      raf = requestAnimationFrame(loop);
    };
    loop();

    const ro = new ResizeObserver(() => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h);
      cam.aspect = w / h;
      applyOffset(cam, w, h);
      cam.updateProjectionMatrix();
    });
    ro.observe(mount);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener('pointerdown', onDown);
      renderer.domElement.removeEventListener('pointerup', onUp);
      renderer.domElement.removeEventListener('pointermove', onMove);
      renderer.domElement.removeEventListener('pointerleave', onLeave);
      tip.remove();
      layer.remove();
      calloutsRef.current = [];
      scene.traverse((o) => {
        o.geometry?.dispose?.();
        o.material?.dispose?.();
      });
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parts, decor]);

  useEffect(() => {
    const cam = camRef.current;
    const mount = mountRef.current;
    if (!cam || !mount) return;
    applyOffset(cam, mount.clientWidth, mount.clientHeight);
    cam.updateProjectionMatrix();
  }, [offsetRight]);

  // Rebuild the callout elements only when which modules have one changes; update their text (and whether
  // they're collapsed to a "!" marker) in place,
  // so a live number ticking never replaces the button under the user's finger.
  const calloutKey = callouts.map((c) => `${c.id}:${c.kind ?? ''}`).join(';');
  useEffect(() => {
    for (const c of calloutsRef.current) {
      const cur = callouts.find((x) => x.id === c.id);
      const t = cur?.text;
      const span = c.el.querySelector('.callout-text');
      if (t && span.textContent !== t) span.textContent = t;
      // Collapsed to a "!" marker unless its module is the one open; the full text stays the button's name.
      c.el.classList.toggle('compact', !cur?.open);
      c.open = !!cur?.open;
      if (t) c.el.setAttribute('aria-label', t);
    }
  });
  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    layer.innerHTML = '';
    calloutsRef.current = callouts.map((c) => {
      const el = document.createElement('button');
      el.className = `callout${c.kind ? ` ${c.kind}` : ''}${c.open ? '' : ' compact'}`;
      el.setAttribute('aria-label', c.text);
      el.innerHTML = `<span class="callout-dot"><span class="callout-bang">!</span></span><span class="callout-text"></span><span class="callout-more">›</span>`;
      el.querySelector('.callout-text').textContent = c.text;
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        onCalloutRef.current?.(c.id);
      });
      el.addEventListener('pointerdown', (e) => e.stopPropagation());
      layer.appendChild(el);
      return { id: c.id, el, lift: c.id === you ? 58 : 12, open: !!c.open };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calloutKey, parts, you]);

  // Move the "You" label to the top of the crew member's module.
  useEffect(() => {
    const marker = markerRef.current;
    const mesh = you && meshesRef.current[you];
    if (!marker) return;
    if (!mesh) {
      marker.visible = false;
      return;
    }
    const box = new THREE.Box3().setFromObject(mesh);
    marker.position.set((box.min.x + box.max.x) / 2, box.max.y, (box.min.z + box.max.z) / 2);
    marker.visible = true;
  }, [you, parts]);

  // Recolour without rebuilding when levels or selection change.
  useEffect(() => {
    for (const p of parts) {
      const m = meshesRef.current[p.id];
      if (!m) continue;
      const c = p.struct ? STRUCT_COLOR : noiseColor(levels[p.id]);
      m.material.color.set(c);
      const isSel = selected === p.id;
      const isHi = hiList.includes(p.id);
      m.material.emissive.set(isSel ? '#ffffff' : isHi ? c : '#000000');
      m.material.emissiveIntensity = isSel ? 0.28 : isHi ? 0.6 : 0;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parts, levels, selected, hiKey]);

  return <div className="station3d" ref={mountRef} />;
}
