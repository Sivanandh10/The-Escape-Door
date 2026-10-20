'use client'
// S01 — the R3F door portal (#22). Owner: S01. Lazy (next/dynamic, ssr:false) behind the DESIGN §7b gate.
// A cel-shaded wooden door in a purple frame, standing in an ink void lit by screen-space halftone dots (#58).
// Scroll never touches this file directly: GSAP ScrollTrigger writes heroProgress.p; useFrame reads it,
// swings the leaf, floods the light, and dollies the camera up to the threshold, where the live catalogue waits:
// a product card (textures from Admin → Products images) wipes to the next one every 2.2 s, in sync with the DOM
// chip (`showcaseStore.i`, see DoorShowcase.tsx). The card hides the old black end of the light tunnel.
// No drei ScrollControls (fights Lenis). frameloop is 'always' only while the hero is on screen, else 'never'.
import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Outlines } from '@react-three/drei'
import * as THREE from 'three'
import { heroProgress, PHASE, smooth } from './progress'
import { showcaseStore } from './showcase'

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

// the showcase plane sits behind the swung-open leaf (leaf depth ≈ 1.13), inside the light tunnel
const PLANE_Z = -1.45
const PLANE_W = 2.5
const PLANE_H = 2.9
const CARD_H = 1.86
const CARD_W = CARD_H * 0.8
const CARD_Y = 0.02

/** The product card behind the door: two textures + a manga wipe between them, on a volt halftone backdrop. */
function ShowcasePlane({ srcs }: { srcs: string[] }) {
  const { gl } = useThree()
  const dpr = gl.getPixelRatio()
  const state = useRef({ shown: -1, target: -1, mix: 1, loading: new Set<number>() })
  const tex = useRef<(THREE.Texture | null)[]>([])

  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uA: { value: null as THREE.Texture | null },
          uB: { value: null as THREE.Texture | null },
          uHasA: { value: 0 },
          uHasB: { value: 0 },
          uAspA: { value: 0.8 },
          uAspB: { value: 0.8 },
          uMix: { value: 0 },
          uOpen: { value: 0 },
          uDpr: { value: dpr },
          uInk: { value: new THREE.Color(HEX.ink) },
          uVolt: { value: new THREE.Color(HEX.volt) },
          uPaper: { value: new THREE.Color(HEX.paper) },
        },
        vertexShader: VERT,
        fragmentShader: /* glsl */ `
          uniform sampler2D uA; uniform sampler2D uB; uniform float uHasA; uniform float uHasB;
          uniform float uAspA; uniform float uAspB; uniform float uMix; uniform float uOpen; uniform float uDpr;
          uniform vec3 uInk; uniform vec3 uVolt; uniform vec3 uPaper;
          varying vec2 vUv;
          ${HALFTONE}
          const vec2 PLANE = vec2(${PLANE_W.toFixed(3)}, ${PLANE_H.toFixed(3)});
          const vec2 CARD = vec2(${CARD_W.toFixed(3)}, ${CARD_H.toFixed(3)});
          const float CARD_Y = ${CARD_Y.toFixed(3)};
          float box(vec2 p, vec2 h) { vec2 d = abs(p) - h; return max(d.x, d.y); }
          vec3 cover(sampler2D t, vec2 uv, float asp) {
            float card = CARD.x / CARD.y;
            vec2 s = asp > card ? vec2(card / asp, 1.0) : vec2(1.0, asp / card);
            vec4 tx = texture2D(t, (uv - 0.5) * s + 0.5);
            return mix(uPaper, tx.rgb, tx.a); // alpha cut-outs (clean product renders) sit on paper
          }
          void main() {
            vec2 p = (vUv - 0.5) * PLANE;
            vec2 c = p - vec2(0.0, CARD_Y);
            // backdrop: volt light, ink halftone thickening toward the edges
            float r = length(c / vec2(1.1, 1.45));
            float h = ht(gl_FragCoord.xy / uDpr, 9.0, smoothstep(0.85, 1.7, r) * 0.55);
            vec3 col = mix(uVolt, uInk, h);
            // hard ink shadow, then the card with an ink border
            col = mix(col, uInk, step(box(c - vec2(0.07, -0.07), CARD * 0.5), 0.0));
            float edge = box(c, CARD * 0.5);
            if (edge < 0.0) {
              vec2 uv = c / CARD + 0.5;
              vec3 a = uHasA > 0.5 ? cover(uA, uv, uAspA) : uPaper;
              vec3 b = uHasB > 0.5 ? cover(uB, uv, uAspB) : a;
              // diagonal manga wipe (bottom → top) with an ink leading edge
              float w = uv.y * 0.85 + uv.x * 0.15;
              float m = uMix * 1.2 - 0.1;
              col = mix(a, b, step(w, m));
              float moving = step(0.001, uMix) * step(uMix, 0.999);
              col = mix(col, uInk, (1.0 - step(0.018, abs(w - m))) * moving);
              col = mix(col, uInk, step(-0.03, edge));
            }
            // the room stays dark until the door opens
            col = mix(uInk, col, smoothstep(0.0, 1.0, uOpen));
            gl_FragColor = vec4(col, 1.0);
          }
        `,
      }),
    [dpr],
  )

  useEffect(
    () => () => {
      mat.dispose()
      tex.current.forEach((t) => t?.dispose())
      tex.current = []
    },
    [mat],
  )

  const plane = useRef<THREE.Mesh>(null)
  // uniforms are written through the mesh ref (mutable by design) — never through the memoised value
  useFrame((_, delta) => {
    const st = state.current
    const m = plane.current?.material as THREE.ShaderMaterial | undefined
    if (!m) return
    const u = m.uniforms
    const n = srcs.length
    if (!n) return
    const load = (k: number) => {
      if (tex.current[k] || st.loading.has(k)) return
      st.loading.add(k)
      const loader = new THREE.TextureLoader()
      loader.setCrossOrigin('anonymous')
      loader.load(
        srcs[k],
        (t) => {
          t.anisotropy = Math.min(4, gl.capabilities.getMaxAnisotropy())
          tex.current[k] = t
          st.loading.delete(k)
        },
        undefined,
        () => st.loading.delete(k), // CORS / 404 → that card is skipped (the chip still names it)
      )
    }
    const want = Math.min(showcaseStore.i, n - 1)
    load(want)
    load((want + 1) % n)
    u.uOpen.value = smooth(PHASE.open[0], PHASE.open[1], heroProgress.p)

    const ready = tex.current[want]
    const asp = (t: THREE.Texture) => {
      const img = t.image as { width?: number; height?: number } | undefined
      return img?.width && img?.height ? img.width / img.height : 0.8
    }
    if (ready && st.target !== want) {
      if (st.shown < 0) {
        st.shown = st.target = want // first card: no wipe
        u.uA.value = ready
        u.uHasA.value = 1
        u.uAspA.value = asp(ready)
        u.uMix.value = 0
        return
      }
      st.target = want
      u.uB.value = ready
      u.uHasB.value = 1
      u.uAspB.value = asp(ready)
      st.mix = 0
    }
    if (st.target !== st.shown) {
      st.mix = Math.min(1, st.mix + delta / 0.5)
      u.uMix.value = 1 - Math.pow(1 - st.mix, 3)
      if (st.mix >= 1) {
        st.shown = st.target
        u.uA.value = u.uB.value
        u.uAspA.value = u.uAspB.value
        u.uMix.value = 0
      }
    }
  })

  return (
    <mesh ref={plane} material={mat} position={[0, 0.03, PLANE_Z]}>
      <planeGeometry args={[PLANE_W, PLANE_H]} />
    </mesh>
  )
}

function useToonRamp() {
  return useMemo(() => {
    const t = new THREE.DataTexture(new Uint8Array([70, 150, 255]), 3, 1, THREE.RedFormat)
    t.minFilter = THREE.NearestFilter
    t.magFilter = THREE.NearestFilter
    t.needsUpdate = true
    return t
  }, [])
}

function Scene({ onReady, srcs }: { onReady: () => void; srcs: string[] }) {
  const { gl } = useThree()
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

  const wallMesh = useRef<THREE.Mesh>(null)
  const spillMesh = useRef<THREE.Mesh>(null)
  const tunnelMesh = useRef<THREE.Mesh>(null)
  const uni = (r: { current: THREE.Mesh | null }) => (r.current?.material as THREE.ShaderMaterial | undefined)?.uniforms
  useFrame((state, delta) => {
    const cam = state.camera
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
    const wallU = uni(wallMesh)
    const spillU = uni(spillMesh)
    const tunnelU = uni(tunnelMesh)
    if (wallU) wallU.uOpen.value = lit
    if (spillU) spillU.uOpen.value = lit
    if (tunnelU) {
      tunnelU.uBurst.value = dolly
      tunnelU.uTime.value += delta
    }

    // dolly: from the doorstep up to the threshold — the doorway (and the product card) fills the frame
    const e = dolly * dolly * (3 - 2 * dolly)
    cam.position.set(0, THREE.MathUtils.lerp(0.55, 0.08, e), THREE.MathUtils.lerp(9.4, 4.75, e))
    cam.lookAt(0, THREE.MathUtils.lerp(-0.05, 0.02, e), cam.position.z - 10)
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
      <mesh ref={wallMesh} geometry={wallGeo} material={mats.wall} position={[0, 0, -0.12]} />

      {/* the light beyond: a speed-line tunnel (volt → paper) */}
      <mesh ref={tunnelMesh} material={mats.tunnel} position={[0, 0.03, -8.6]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[1.25, 1.25, 16.8, 48, 1, true]} />
      </mesh>

      {/* the live catalogue behind the door (covers the light tunnel's far end) */}
      <ShowcasePlane srcs={srcs} />

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
      <mesh ref={spillMesh} material={mats.spill} position={[0, -1.1, 2.1]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[6, 4]} />
      </mesh>
    </>
  )
}

export default function DoorPortal3D({ onReady, onFail, srcs = [] }: { onReady: () => void; onFail?: () => void; srcs?: string[] }) {
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
        <Scene onReady={onReady} srcs={srcs} />
      </Canvas>
    </div>
  )
}
