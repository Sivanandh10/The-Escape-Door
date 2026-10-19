'use client'
// S01 — the R3F door portal (#22). Owner: S01. Lazy (next/dynamic, ssr:false) behind the DESIGN §7b gate.
// A cel-shaded wooden door in a purple frame, standing in an ink void lit by screen-space halftone dots (#58).
// Scroll never touches this file directly: GSAP ScrollTrigger writes heroProgress.p; useFrame reads it,
// swings the leaf, floods the light, and dollies the camera THROUGH the doorway into a speed-line tunnel.
// No drei ScrollControls (fights Lenis). frameloop is 'always' only while the hero is on screen, else 'never'.
import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Outlines } from '@react-three/drei'
import * as THREE from 'three'
import { heroProgress, PHASE, smooth } from './progress'

const HEX = {
  ink: '#0B0B0F',
  paper: '#F4EFE6',
  volt: '#FFE14D',
  lav: '#C9B8FF',
  door: '#6D3BFF',
  wood: '#9A6440',
  woodDark: '#4A2C1C',
}

const HALFTONE = /* glsl */ `
float ht(vec2 fc, float cell, float tone) {
  vec2 p = mat2(0.951, -0.309, 0.309, 0.951) * fc / cell;
  vec2 g = fract(p) - 0.5;
  float r = sqrt(clamp(tone, 0.0, 1.0)) * 0.72;
  return 1.0 - smoothstep(r - 0.05, r + 0.05, length(g));
}
`
const VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vPos;
void main() {
  vUv = uv;
  vPos = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

function useToonRamp() {
  return useMemo(() => {
    const t = new THREE.DataTexture(new Uint8Array([70, 150, 255]), 3, 1, THREE.RedFormat)
    t.minFilter = THREE.NearestFilter
    t.magFilter = THREE.NearestFilter
    t.needsUpdate = true
    return t
  }, [])
}

function Scene({ onReady }: { onReady: () => void }) {
  const { camera, gl } = useThree()
  const ramp = useToonRamp()
  const leaf = useRef<THREE.Group>(null)
  const lamp = useRef<THREE.PointLight>(null)
  const ready = useRef(false)
  const dpr = gl.getPixelRatio()

  const mats = useMemo(() => {
    const toon = (c: string) => new THREE.MeshToonMaterial({ color: c, gradientMap: ramp })
    const wall = new THREE.ShaderMaterial({
      uniforms: {
        uOpen: { value: 0 },
        uDpr: { value: dpr },
        uInk: { value: new THREE.Color(HEX.ink) },
        uDoor: { value: new THREE.Color(HEX.door) },
        uVolt: { value: new THREE.Color(HEX.volt) },
      },
      vertexShader: VERT,
      fragmentShader: /* glsl */ `
        uniform float uOpen; uniform float uDpr; uniform vec3 uInk; uniform vec3 uDoor; uniform vec3 uVolt;
        varying vec3 vPos;
        ${HALFTONE}
        void main() {
          float d = length(vPos.xy / vec2(1.25, 1.7));
          float reach = 2.2 + uOpen * 3.2;
          float tone = (1.0 - smoothstep(0.55, reach, d)) * (0.42 + 0.58 * uOpen);
          float h = ht(gl_FragCoord.xy / uDpr, 10.0, tone);
          vec3 dotc = mix(uDoor, uVolt, smoothstep(0.25, 0.9, uOpen) * (1.0 - smoothstep(0.6, 2.4, d)));
          gl_FragColor = vec4(mix(uInk, dotc, h), 1.0);
        }
      `,
    })
    const spill = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uOpen: { value: 0 }, uDpr: { value: dpr }, uVolt: { value: new THREE.Color(HEX.volt) } },
      vertexShader: VERT,
      fragmentShader: /* glsl */ `
        uniform float uOpen; uniform float uDpr; uniform vec3 uVolt;
        varying vec2 vUv;
        ${HALFTONE}
        void main() {
          float z = vUv.y;                      // 0 at the threshold → 1 toward the viewer
          float half_w = mix(0.11, 0.5, z);
          float inside = 1.0 - smoothstep(half_w - 0.01, half_w, abs(vUv.x - 0.5));
          float tone = (1.0 - z) * inside * (0.08 + 0.92 * uOpen);
          float h = ht(gl_FragCoord.xy / uDpr, 8.0, tone);
          if (h < 0.5) discard;
          gl_FragColor = vec4(uVolt, 1.0);
        }
      `,
    })
    const tunnel = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {
        uTime: { value: 0 },
        uBurst: { value: 0 },
        uVolt: { value: new THREE.Color(HEX.volt) },
        uLav: { value: new THREE.Color(HEX.lav) },
        uInk: { value: new THREE.Color(HEX.ink) },
        uPaper: { value: new THREE.Color(HEX.paper) },
      },
      vertexShader: VERT,
      fragmentShader: /* glsl */ `
        uniform float uTime; uniform float uBurst; uniform vec3 uVolt; uniform vec3 uLav; uniform vec3 uInk; uniform vec3 uPaper;
        varying vec2 vUv;
        float hash(float n) { return fract(sin(n * 91.7) * 43758.5453); }
        void main() {
          float a = vUv.x * 72.0;
          float id = floor(a);
          float f = fract(a);
          float rnd = hash(id);
          float run = fract(vUv.y * (1.5 + rnd * 2.0) - uTime * (0.35 + rnd) * (0.4 + uBurst * 2.6) + rnd);
          float on = step(0.55 - uBurst * 0.4, rnd);
          float streak = on * smoothstep(0.0, 0.12, run) * (1.0 - smoothstep(0.45, 0.9, run)) * (1.0 - smoothstep(0.08, 0.38, abs(f - 0.5)));
          vec3 base = mix(uVolt, uPaper, smoothstep(0.55, 1.0, vUv.y));
          vec3 sc = hash(id + 7.0) > 0.5 ? uInk : uLav;
          gl_FragColor = vec4(mix(base, sc, streak), 1.0);
        }
      `,
    })
    return {
      frame: toon(HEX.door),
      wood: toon(HEX.wood),
      woodDark: toon(HEX.woodDark),
      knob: toon(HEX.volt),
      paper: toon(HEX.paper),
      wall,
      spill,
      tunnel,
    }
  }, [ramp, dpr])

  const wallGeo = useMemo(() => {
    const s = new THREE.Shape()
    s.moveTo(-30, -20)
    s.lineTo(30, -20)
    s.lineTo(30, 20)
    s.lineTo(-30, 20)
    s.lineTo(-30, -20)
    const hole = new THREE.Path()
    hole.moveTo(-0.6, -1.1)
    hole.lineTo(0.6, -1.1)
    hole.lineTo(0.6, 1.16)
    hole.lineTo(-0.6, 1.16)
    hole.lineTo(-0.6, -1.1)
    s.holes.push(hole)
    return new THREE.ShapeGeometry(s)
  }, [])

  useEffect(
    () => () => {
      Object.values(mats).forEach((m) => m.dispose())
      wallGeo.dispose()
      ramp.dispose()
    },
    [mats, wallGeo, ramp],
  )

  const cam = camera as THREE.PerspectiveCamera
  useFrame((state, delta) => {
    const p = heroProgress.p
    const t = state.clock.elapsedTime
    const creak = smooth(PHASE.creak[0], PHASE.creak[1], p)
    const open = smooth(PHASE.open[0], PHASE.open[1], p)
    const dolly = smooth(PHASE.dolly[0], PHASE.dolly[1], p)
    const lit = Math.min(1, creak * 0.25 + open)

    if (leaf.current) {
      const idle = p < 0.02 ? Math.sin(t * 1.6) * 0.018 + 0.02 : 0
      leaf.current.rotation.y = idle + creak * 0.22 + open * 1.62
    }
    if (lamp.current) lamp.current.intensity = 0.2 + lit * 9
    mats.wall.uniforms.uOpen.value = lit
    mats.spill.uniforms.uOpen.value = lit
    mats.tunnel.uniforms.uBurst.value = dolly
    mats.tunnel.uniforms.uTime.value += delta

    // dolly: from the doorstep, through the doorway, into the tunnel
    const e = dolly * dolly * (3 - 2 * dolly)
    cam.position.set(0, THREE.MathUtils.lerp(0.55, 0, e), THREE.MathUtils.lerp(9.4, -7.5, e))
    cam.lookAt(0, THREE.MathUtils.lerp(-0.05, 0, e), cam.position.z - 10)
    const fov = THREE.MathUtils.lerp(32, 74, smooth(0.55, 1, dolly))
    if (Math.abs(cam.fov - fov) > 0.01) {
      cam.fov = fov
      cam.updateProjectionMatrix()
    }
    if (!ready.current) {
      ready.current = true
      requestAnimationFrame(onReady)
    }
  })

  const ink = HEX.ink
  return (
    <>
      <color attach="background" args={[HEX.ink]} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[-3, 4, 6]} intensity={1.4} />
      <pointLight ref={lamp} position={[0, 0.2, -0.9]} color={HEX.volt} distance={7} decay={1.2} intensity={0.2} />

      {/* the void: an ink wall with a door-shaped hole, lit by halftone */}
      <mesh geometry={wallGeo} material={mats.wall} position={[0, 0, -0.12]} />

      {/* the light beyond: a speed-line tunnel (volt → paper) */}
      <mesh material={mats.tunnel} position={[0, 0.03, -8.6]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[1.25, 1.25, 16.8, 48, 1, true]} />
      </mesh>

      {/* purple frame */}
      <group>
        {[
          { p: [-0.67, 0.08, 0] as const, s: [0.16, 2.48, 0.32] as const },
          { p: [0.67, 0.08, 0] as const, s: [0.16, 2.48, 0.32] as const },
          { p: [0, 1.25, 0] as const, s: [1.5, 0.2, 0.36] as const },
        ].map((b, i) => (
          <mesh key={i} position={b.p} material={mats.frame}>
            <boxGeometry args={b.s} />
            <Outlines thickness={0.022} color={ink} />
          </mesh>
        ))}
        <mesh position={[0, 1.25, 0.19]} material={mats.paper}>
          <boxGeometry args={[0.16, 0.12, 0.02]} />
          <Outlines thickness={0.012} color={ink} />
        </mesh>
        <mesh position={[0, -1.14, 0.06]} material={mats.woodDark}>
          <boxGeometry args={[1.62, 0.08, 0.5]} />
          <Outlines thickness={0.018} color={ink} />
        </mesh>
      </group>

      {/* the leaf, hinged on the left; swings inward, into the light */}
      <group ref={leaf} position={[-0.58, 0.03, 0]}>
        <mesh position={[0.575, 0, 0]} material={mats.wood}>
          <boxGeometry args={[1.13, 2.22, 0.07]} />
          <Outlines thickness={0.02} color={ink} />
        </mesh>
        {[0.47, -0.52].map((y, i) => (
          <mesh key={i} position={[0.575, y, 0.04]} material={mats.woodDark}>
            <boxGeometry args={[0.72, i === 0 ? 0.86 : 0.78, 0.015]} />
            <Outlines thickness={0.014} color={ink} />
          </mesh>
        ))}
        <mesh position={[1.0, -0.02, 0.07]} material={mats.knob}>
          <sphereGeometry args={[0.065, 20, 14]} />
          <Outlines thickness={0.012} color={ink} />
        </mesh>
      </group>

      {/* halftone light spill on the floor */}
      <mesh material={mats.spill} position={[0, -1.1, 2.1]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[6, 4]} />
      </mesh>
    </>
  )
}

export default function DoorPortal3D({ onReady, onFail }: { onReady: () => void; onFail?: () => void }) {
  const host = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(true)

  useEffect(() => {
    const el = host.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { rootMargin: '80px' })
    io.observe(el)
    const vis = () => document.hidden && setInView(false)
    document.addEventListener('visibilitychange', vis)
    return () => {
      io.disconnect()
      document.removeEventListener('visibilitychange', vis)
    }
  }, [])

  return (
    <div ref={host} className="absolute inset-0">
      <Canvas
        linear
        flat
        frameloop={inView ? 'always' : 'never'}
        dpr={[1, 1.5]}
        gl={{ antialias: true, powerPreference: 'high-performance', alpha: false }}
        camera={{ position: [0, 0.55, 9.4], fov: 32, near: 0.05, far: 60 }}
        onCreated={({ gl }) => {
          gl.domElement.addEventListener('webglcontextlost', () => onFail?.(), { once: true })
        }}
        aria-hidden="true"
      >
        <Scene onReady={onReady} />
      </Canvas>
    </div>
  )
}
