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
  if (p.sphere) geo = new THREE.SphereGeometry(p.r, 24, 16);
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

export default function Station3D({ parts, levels, selected, onSelect, decor = 'iss', camera = [42, 34, 58], target = [-4, -2, 0], highlight }) {
  const mountRef = useRef(null);
  const meshesRef = useRef({});
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const levelsRef = useRef(levels);
  levelsRef.current = levels;

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
    cam.position.set(...camera);
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
    if (decor === 'iss') addIssDecor(scene);

    const controls = new OrbitControls(cam, renderer.domElement);
    controls.target.set(...target);
    controls.enableDamping = true;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.6;
    controls.minDistance = 12;
    controls.maxDistance = 180;
    controls.addEventListener('start', () => (controls.autoRotate = false));

    // Tap / click to select (ignore drags).
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let down = null;
    const onDown = (e) => (down = { x: e.clientX, y: e.clientY });
    const onUp = (e) => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return;
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      ray.setFromCamera(ndc, cam);
      const hit = ray.intersectObjects(Object.values(meshes), false)[0];
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

    let raf;
    const loop = () => {
      controls.update();
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
      scene.traverse((o) => {
        o.geometry?.dispose?.();
        o.material?.dispose?.();
      });
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parts, decor]);

  // Recolour without rebuilding when levels or selection change.
  useEffect(() => {
    for (const p of parts) {
      const m = meshesRef.current[p.id];
      if (!m) continue;
      const c = p.struct ? STRUCT_COLOR : noiseColor(levels[p.id]);
      m.material.color.set(c);
      const isSel = selected === p.id;
      const isHi = highlight && highlight === p.id;
      m.material.emissive.set(isSel ? '#ffffff' : isHi ? c : '#000000');
      m.material.emissiveIntensity = isSel ? 0.28 : isHi ? 0.6 : 0;
    }
  }, [parts, levels, selected, highlight]);

  return <div className="station3d" ref={mountRef} />;
}
