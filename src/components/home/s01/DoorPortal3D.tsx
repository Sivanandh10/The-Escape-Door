'use client'
// S01 — the R3F door portal (#22). Owner: S01. Lazy (next/dynamic, ssr:false) behind the DESIGN §7b gate.
// A cel-shaded wooden door in a purple frame, standing in an ink void lit by screen-space halftone dots (#58).
// Scroll never touches this file directly: GSAP ScrollTrigger writes heroProgress.p; useFrame reads it,
// swings the leaf, floods the light, and dollies the camera up to the threshold, where a STATIC product object
// (transparent cut-out, ./objects.ts) floats in the speed-line tunnel; scroll swaps it (heroObjectStore.i, in
// sync with the CSS door + the DOM chip). The tunnel's far end is a light cap (it used to be a black hole).
// No drei ScrollControls (fights Lenis). frameloop is 'always' only while the hero is on screen, else 'never'.
import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Outlines } from '@react-three/drei'
import * as THREE from 'three'
import { heroProgress, PHASE, smooth } from './progress'
import { HERO_OBJECTS, heroObjectStore } from './objects'

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

// the object floats behind the swung-open leaf (leaf depth ≈ 1.13), inside the light tunnel
const OBJ_Z = -1.45
const OBJ_Y = 0.02
const OBJ_H = 1.62 // plane height (the art carries ~7% transparent padding for the rim + shadow)
const OBJ_MAX_W = 1.6
// the tunnel (radius 1.25, 16.8 long, centred at z -8.6) ends at z ≈ -17: a light cap there, so the far end of
// the speed-line tunnel reads as the light source instead of a black hole
const TUNNEL_END_Z = -16.95

/** The far end of the light tunnel: a paper → volt glow (it used to be the "black ball"). */
function TunnelEnd() {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uVolt: { value: new THREE.Color(HEX.volt) }, uPaper: { value: new THREE.Color(HEX.paper) } },
        vertexShader: VERT,
        fragmentShader: /* glsl */ `
          uniform vec3 uVolt; uniform vec3 uPaper;
          varying vec2 vUv;
          void main() {
            float r = length(vUv - 0.5) * 2.0;
            gl_FragColor = vec4(mix(uPaper, uVolt, smoothstep(0.0, 0.95, r)), 1.0);
          }
        `,
      }),
    [],
  )
  useEffect(() => () => mat.dispose(), [mat])
  return (
    <mesh material={mat} position={[0, 0.03, TUNNEL_END_Z]}>
      <circleGeometry args={[1.3, 48]} />
    </mesh>
  )
}

/**
 * The product object behind the door: a STATIC transparent cut-out (./objects.ts — no card, no backdrop) on a
 * two-sided plane. Floats, leans toward the pointer, paper die-cut rim + a volt rim light from the doorway, and a
 * soft ink shadow plane behind it. Scroll picks which object (heroObjectStore.i); a swap is a quick 250 ms
 * spin-punch (shrink + quarter turn out, texture swap, overshoot back in).
 */
function ProductObject() {
  const { gl } = useThree()
  const group = useRef<THREE.Group>(null)
  const spin = useRef<THREE.Group>(null)
  const body = useRef<THREE.Mesh>(null)
  const shadow = useRef<THREE.Mesh>(null)
  const anim = useRef({ shown: -1, target: -1, t: 1, dir: 1, tiltX: 0, tiltY: 0 })

  const textures = useMemo(() => {
    const loader = new THREE.TextureLoader()
    return HERO_OBJECTS.map((o) => {
      const t = loader.load(o.src)
      t.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy())
      return t
    })
  }, [gl])

  const mats = useMemo(() => {
    const common = { transparent: true, depthWrite: false, side: THREE.DoubleSide }
    const body = new THREE.ShaderMaterial({
      ...common,
      uniforms: {
        uTex: { value: null as THREE.Texture | null },
        uOpacity: { value: 0 },
        uTexel: { value: new THREE.Vector2(1 / 880, 1 / 900) },
        uPaper: { value: new THREE.Color(HEX.paper) },
        uVolt: { value: new THREE.Color(HEX.volt) },
      },
      vertexShader: VERT,
      fragmentShader: /* glsl */ `
        uniform sampler2D uTex; uniform float uOpacity; uniform vec2 uTexel; uniform vec3 uPaper; uniform vec3 uVolt;
        varying vec2 vUv;
        void main() {
          vec2 uv = gl_FrontFacing ? vUv : vec2(1.0 - vUv.x, vUv.y); // the back face is not mirrored
          vec4 c = texture2D(uTex, uv);
          // paper die-cut rim: the alpha dilated by ~5px (8 taps)
          vec2 d = uTexel * 5.0;
          float o = 0.0;
          o = max(o, texture2D(uTex, uv + vec2(d.x, 0.0)).a);
          o = max(o, texture2D(uTex, uv - vec2(d.x, 0.0)).a);
          o = max(o, texture2D(uTex, uv + vec2(0.0, d.y)).a);
          o = max(o, texture2D(uTex, uv - vec2(0.0, d.y)).a);
          o = max(o, texture2D(uTex, uv + d * 0.7).a);
          o = max(o, texture2D(uTex, uv - d * 0.7).a);
          o = max(o, texture2D(uTex, uv + vec2(d.x, -d.y) * 0.7).a);
          o = max(o, texture2D(uTex, uv + vec2(-d.x, d.y) * 0.7).a);
          // rim light: edges facing the light (upper right) catch a thin volt edge
          float lit = c.a * (1.0 - texture2D(uTex, uv + vec2(-1.0, -1.2) * uTexel * 7.0).a);
          vec3 col = mix(c.rgb, uVolt, clamp(lit, 0.0, 1.0) * 0.85);
          col = mix(uPaper, col, c.a);
          float a = max(c.a, o);
          if (a < 0.01) discard;
          gl_FragColor = vec4(col, a * uOpacity);
        }
      `,
    })
    const shade = new THREE.ShaderMaterial({
      ...common,
      uniforms: { uTex: { value: null as THREE.Texture | null }, uOpacity: { value: 0 }, uInk: { value: new THREE.Color(HEX.ink) } },
      vertexShader: VERT,
      fragmentShader: /* glsl */ `
        uniform sampler2D uTex; uniform float uOpacity; uniform vec3 uInk;
        varying vec2 vUv;
        void main() {
          float a = texture2D(uTex, vUv, 3.5).a; // a blurred mip of the alpha = soft shadow
          gl_FragColor = vec4(uInk, a * 0.5 * uOpacity);
        }
      `,
    })
    return { body, shade }
  }, [])

  useEffect(
    () => () => {
      mats.body.dispose()
      mats.shade.dispose()
      textures.forEach((t) => t.dispose())
    },
    [mats, textures],
  )

  useFrame((state, delta) => {
    const g = group.current
    const sp = spin.current
    const bm = body.current
    const sm = shadow.current
    if (!g || !sp || !bm || !sm) return
    const bu = (bm.material as THREE.ShaderMaterial).uniforms
    const su = (sm.material as THREE.ShaderMaterial).uniforms
    const a = anim.current
    const want = Math.min(heroObjectStore.i, HERO_OBJECTS.length - 1)
    const p = heroProgress.p
    const t = state.clock.elapsedTime

    const apply = (k: number) => {
      const o = HERO_OBJECTS[k]
      const asp = o.w / o.h
      const h = Math.min(OBJ_H, OBJ_MAX_W / asp)
      bm.scale.set(h * asp, h, 1)
      sm.scale.set(h * asp, h, 1)
      bu.uTex.value = textures[k]
      ;(bu.uTexel.value as THREE.Vector2).set(1 / o.w, 1 / o.h)
      su.uTex.value = textures[k]
      a.shown = k
    }
    if (a.shown < 0) {
      apply(want)
      a.target = want
    } else if (want !== a.target) {
      a.dir = want > a.target ? 1 : -1
      a.target = want
      a.t = 0
    }

    // the swap: 0 → 0.4 shrink + quarter turn out, swap the texture, 0.4 → 1 overshoot back in
    let swapS = 1
    let swapR = 0
    if (a.t < 1) {
      a.t = Math.min(1, a.t + delta / 0.25)
      if (a.t < 0.4) {
        const k = a.t / 0.4
        swapS = 1 - 0.42 * k * k
        swapR = a.dir * k * k * (Math.PI / 2)
      } else {
        if (a.shown !== a.target) apply(a.target)
        const k = (a.t - 0.4) / 0.6 - 1
        const back = 1 + 3.2 * k * k * k + 2.2 * k * k // back.out(2.2)
        swapS = 0.58 + 0.42 * back
        swapR = -a.dir * (1 - back) * (Math.PI / 2)
      }
    } else if (a.shown !== a.target) apply(a.target)

    // appears with the open door (the room is dark until then)
    const open = smooth(PHASE.open[0] + 0.06, PHASE.open[1], p)
    bu.uOpacity.value = open
    su.uOpacity.value = open

    // lean toward the pointer (smoothed), float + a slow idle sway
    const f = 1 - Math.pow(0.0025, delta)
    a.tiltY += (state.pointer.x * 0.32 - a.tiltY) * f
    a.tiltX += (-state.pointer.y * 0.14 - a.tiltX) * f
    g.position.set(0, OBJ_Y + Math.sin(t * 1.3) * 0.035, OBJ_Z)
    g.rotation.set(a.tiltX + Math.sin(t * 0.9) * 0.025, a.tiltY + Math.sin(t * 0.6) * 0.12, Math.sin(t * 0.8) * 0.02)
    g.scale.setScalar((0.82 + 0.18 * open) * swapS)
    sp.rotation.y = swapR
  })

  return (
    <group ref={group} position={[0, OBJ_Y, OBJ_Z]}>
      <group ref={spin}>
        {/* soft ink shadow, a little behind + below */}
        <mesh ref={shadow} material={mats.shade} position={[0.05, -0.07, -0.08]} renderOrder={1}>
          <planeGeometry args={[1, 1]} />
        </mesh>
        <mesh ref={body} material={mats.body} renderOrder={2}>
          <planeGeometry args={[1, 1]} />
        </mesh>
      </group>
    </group>
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

function Scene({ onReady }: { onReady: () => void }) {
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

      {/* the light at the far end of the tunnel, and the product object floating in it */}
      <TunnelEnd />
      <ProductObject />

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
