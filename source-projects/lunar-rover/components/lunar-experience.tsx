'use client';

import { Button } from '@/components/ui/button';
import { OrbitControls, RoundedBox, Stars } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  Gauge,
  Mouse,
  Move3d,
  Pause,
  Play,
  Rotate3d,
  RotateCcw,
  Satellite,
  Sun,
  ZoomIn,
} from 'lucide-react';
import {
  Suspense,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';

const TAU = Math.PI * 2;
const CRATERS = [
  [-18, -8, 7.2, 1.8],
  [17, 14, 5.4, 1.25],
  [7, -20, 4.1, 0.9],
  [-7, 18, 3.6, 0.75],
  [25, -10, 8.5, 2.1],
  [-29, 20, 6.4, 1.4],
  [3, 8, 2.2, 0.38],
] as const;

type Vec3 = [number, number, number];

function hashNoise(x: number, z: number) {
  const value = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function terrainHeight(x: number, z: number) {
  let height =
    Math.sin(x * 0.115) * 0.18 +
    Math.sin(z * 0.16 + x * 0.045) * 0.14 +
    Math.sin((x - z) * 0.31) * 0.045 +
    (hashNoise(Math.floor(x * 1.8), Math.floor(z * 1.8)) - 0.5) * 0.035;

  for (const [cx, cz, radius, depth] of CRATERS) {
    const distance = Math.hypot(x - cx, z - cz);
    const normalized = distance / radius;
    const bowl = -depth * Math.exp(-normalized * normalized * 2.25);
    const rimDistance = (distance - radius * 0.88) / (radius * 0.115);
    const rim = depth * 0.24 * Math.exp(-rimDistance * rimDistance);
    height += bowl + rim;
  }

  return height;
}

function createSeededRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function createRegolithTexture() {
  const size = 256;
  const data = new Uint8Array(size * size * 4);
  const random = createSeededRandom(7031);

  for (let index = 0; index < size * size; index += 1) {
    const grain = Math.round(106 + random() * 48 + (random() > 0.985 ? 42 : 0));
    const offset = index * 4;
    data[offset] = grain;
    data[offset + 1] = grain - 2;
    data[offset + 2] = grain - 5;
    data[offset + 3] = 255;
  }

  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(48, 48);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function LunarGround() {
  const geometry = useMemo(() => {
    const plane = new THREE.PlaneGeometry(120, 120, 180, 180);
    plane.rotateX(-Math.PI / 2);
    const positions = plane.attributes.position;
    const colors = new Float32Array(positions.count * 3);
    const color = new THREE.Color();

    for (let index = 0; index < positions.count; index += 1) {
      const x = positions.getX(index);
      const z = positions.getZ(index);
      const y = terrainHeight(x, z);
      const variation = (hashNoise(x * 2.7, z * 2.7) - 0.5) * 0.08;
      positions.setY(index, y);
      color.setHSL(0.105, 0.035, 0.48 + variation + Math.min(y * 0.015, 0.04));
      colors[index * 3] = color.r;
      colors[index * 3 + 1] = color.g;
      colors[index * 3 + 2] = color.b;
    }

    plane.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    plane.computeVertexNormals();
    return plane;
  }, []);
  const texture = useMemo(() => createRegolithTexture(), []);

  useEffect(
    () => () => {
      geometry.dispose();
      texture.dispose();
    },
    [geometry, texture],
  );

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial
        color="#aba79e"
        map={texture}
        bumpMap={texture}
        bumpScale={0.12}
        roughness={0.98}
        metalness={0.02}
        vertexColors
      />
    </mesh>
  );
}

function RockField() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const rocks = useMemo(() => {
    const random = createSeededRandom(4419);
    const items: Array<{ position: Vec3; rotation: Vec3; scale: Vec3 }> = [];

    while (items.length < 330) {
      const x = (random() - 0.5) * 102;
      const z = (random() - 0.5) * 102;
      const pathZ = Math.sin(x * 0.2) * 1.8;
      const corridor = Math.abs(z - pathZ);
      const size = 0.08 + Math.pow(random(), 4) * 1.25;

      if (corridor < 2.35 + size && Math.abs(x) < 17) continue;

      items.push({
        position: [x, terrainHeight(x, z) + size * 0.34 - 0.04, z],
        rotation: [random() * TAU, random() * TAU, random() * TAU],
        scale: [size * (0.75 + random() * 0.45), size * (0.45 + random() * 0.4), size],
      });
    }

    return items;
  }, []);

  useLayoutEffect(() => {
    if (!meshRef.current) return;
    const dummy = new THREE.Object3D();
    rocks.forEach((rock, index) => {
      dummy.position.set(...rock.position);
      dummy.rotation.set(...rock.rotation);
      dummy.scale.set(...rock.scale);
      dummy.updateMatrix();
      meshRef.current?.setMatrixAt(index, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [rocks]);

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, rocks.length]} castShadow receiveShadow>
      <dodecahedronGeometry args={[1, 1]} />
      <meshStandardMaterial color="#706d67" roughness={1} metalness={0.01} />
    </instancedMesh>
  );
}

function TrackMarks() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const marks = useMemo(() => {
    const items: Array<{ position: Vec3; rotationY: number; scale: number }> = [];
    for (let index = 0; index < 76; index += 1) {
      const x = -13 + index * 0.35;
      const z = Math.sin(x * 0.2) * 1.8;
      const slope = Math.cos(x * 0.2) * 0.36;
      const heading = Math.atan2(1, slope);
      const sideX = -slope / Math.hypot(1, slope);
      const sideZ = 1 / Math.hypot(1, slope);

      for (const side of [-1, 1]) {
        const markX = x + sideX * side * 1.57;
        const markZ = z + sideZ * side * 1.57;
        items.push({
          position: [markX, terrainHeight(markX, markZ) + 0.012, markZ],
          rotationY: heading,
          scale: 0.82 + hashNoise(index, side) * 0.22,
        });
      }
    }
    return items;
  }, []);

  useLayoutEffect(() => {
    if (!meshRef.current) return;
    const dummy = new THREE.Object3D();
    marks.forEach((mark, index) => {
      dummy.position.set(...mark.position);
      dummy.rotation.set(0, mark.rotationY, 0);
      dummy.scale.set(mark.scale, 1, mark.scale);
      dummy.updateMatrix();
      meshRef.current?.setMatrixAt(index, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [marks]);

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, marks.length]} receiveShadow>
      <boxGeometry args={[0.42, 0.018, 0.11]} />
      <meshStandardMaterial color="#494744" roughness={1} transparent opacity={0.62} />
    </instancedMesh>
  );
}

function Strut({
  start,
  end,
  radius = 0.055,
  color = '#9d9b93',
}: {
  start: Vec3;
  end: Vec3;
  radius?: number;
  color?: string;
}) {
  const transform = useMemo(() => {
    const startVector = new THREE.Vector3(...start);
    const endVector = new THREE.Vector3(...end);
    const direction = endVector.clone().sub(startVector);
    const midpoint = startVector.clone().add(endVector).multiplyScalar(0.5);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction.clone().normalize(),
    );
    return { midpoint, quaternion, length: direction.length() };
  }, [end, start]);

  return (
    <mesh position={transform.midpoint} quaternion={transform.quaternion} castShadow>
      <cylinderGeometry args={[radius, radius, transform.length, 12]} />
      <meshStandardMaterial color={color} metalness={0.86} roughness={0.28} />
    </mesh>
  );
}

function Cable({ points, color }: { points: Vec3[]; color: string }) {
  const curve = useMemo(
    () => new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point))),
    [points],
  );

  return (
    <mesh castShadow>
      <tubeGeometry args={[curve, 30, 0.016, 7, false]} />
      <meshStandardMaterial color={color} roughness={0.58} metalness={0.15} />
    </mesh>
  );
}

function Wheel({ position, running }: { position: Vec3; running: boolean }) {
  const rotorRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (running && rotorRef.current) {
      rotorRef.current.rotation.x -= Math.min(delta, 0.05) * 1.1;
    }
  });

  return (
    <group position={position}>
      <group ref={rotorRef}>
        <mesh rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
          <cylinderGeometry args={[0.5, 0.5, 0.42, 32, 1, true]} />
          <meshStandardMaterial color="#2c2c2a" roughness={0.9} metalness={0.42} />
        </mesh>
        {[-0.21, 0.21].map((x) => (
          <mesh key={x} position={[x, 0, 0]} rotation={[0, Math.PI / 2, 0]} castShadow>
            <torusGeometry args={[0.405, 0.095, 10, 30]} />
            <meshStandardMaterial color="#3a3936" roughness={0.82} metalness={0.52} />
          </mesh>
        ))}
        <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.2, 0.2, 0.48, 20]} />
          <meshStandardMaterial color="#9a968c" roughness={0.3} metalness={0.9} />
        </mesh>
        <mesh position={[0.25, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.105, 0.105, 0.04, 16]} />
          <meshStandardMaterial color="#d2cfc6" roughness={0.2} metalness={0.95} />
        </mesh>
        {Array.from({ length: 18 }, (_, index) => {
          const angle = (index / 18) * TAU;
          return (
            <mesh
              key={index}
              position={[0, Math.cos(angle) * 0.505, Math.sin(angle) * 0.505]}
              rotation={[-angle, 0, 0]}
              castShadow
            >
              <boxGeometry args={[0.5, 0.055, 0.14]} />
              <meshStandardMaterial color="#575650" roughness={0.72} metalness={0.58} />
            </mesh>
          );
        })}
      </group>
    </group>
  );
}

function SolarWing({ position }: { position: Vec3 }) {
  const cells = useMemo(
    () =>
      Array.from({ length: 24 }, (_, index) => ({
        x: -0.87 + (index % 6) * 0.348,
        z: -0.55 + Math.floor(index / 6) * 0.37,
      })),
    [],
  );

  return (
    <group position={position} rotation={[0, 0, position[0] < 0 ? 0.045 : -0.045]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[2.16, 0.075, 1.58]} />
        <meshStandardMaterial color="#b7b2a5" metalness={0.82} roughness={0.28} />
      </mesh>
      <mesh position={[0, 0.048, 0]} castShadow>
        <boxGeometry args={[2.03, 0.035, 1.45]} />
        <meshStandardMaterial color="#0b1720" metalness={0.72} roughness={0.24} />
      </mesh>
      {cells.map((cell, index) => (
        <mesh key={index} position={[cell.x, 0.071, cell.z]}>
          <boxGeometry args={[0.305, 0.008, 0.323]} />
          <meshPhysicalMaterial
            color={index % 3 === 0 ? '#17394b' : '#102c3c'}
            metalness={0.72}
            roughness={0.2}
            clearcoat={0.82}
            clearcoatRoughness={0.18}
          />
        </mesh>
      ))}
      <mesh position={[0, 0.082, 0]}>
        <boxGeometry args={[0.026, 0.018, 1.49]} />
        <meshStandardMaterial color="#d2c9ab" metalness={0.78} roughness={0.28} />
      </mesh>
    </group>
  );
}

function CameraMast() {
  const headRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (headRef.current) headRef.current.rotation.y = Math.sin(clock.elapsedTime * 0.19) * 0.24;
  });

  return (
    <group position={[-0.48, 1.08, 0.18]}>
      <mesh castShadow>
        <cylinderGeometry args={[0.085, 0.11, 1.35, 16]} />
        <meshStandardMaterial color="#a8a59d" metalness={0.9} roughness={0.27} />
      </mesh>
      <mesh position={[0, 0.3, 0]} castShadow>
        <cylinderGeometry args={[0.14, 0.14, 0.11, 18]} />
        <meshStandardMaterial color="#2c2e2e" metalness={0.75} roughness={0.32} />
      </mesh>
      <group ref={headRef} position={[0, 0.75, 0]}>
        <RoundedBox args={[0.72, 0.38, 0.38]} radius={0.055} smoothness={3} castShadow>
          <meshStandardMaterial color="#d0cdc4" metalness={0.68} roughness={0.34} />
        </RoundedBox>
        {[-0.2, 0.2].map((x) => (
          <group key={x} position={[x, 0.03, 0.225]}>
            <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
              <cylinderGeometry args={[0.095, 0.095, 0.08, 22]} />
              <meshStandardMaterial color="#161818" metalness={0.66} roughness={0.24} />
            </mesh>
            <mesh position={[0, 0, 0.045]}>
              <circleGeometry args={[0.063, 24]} />
              <meshPhysicalMaterial
                color="#153242"
                emissive="#07131b"
                emissiveIntensity={1.1}
                metalness={0.1}
                roughness={0.1}
                clearcoat={1}
              />
            </mesh>
          </group>
        ))}
        <mesh position={[0, 0.22, 0]} castShadow>
          <cylinderGeometry args={[0.11, 0.11, 0.1, 18]} />
          <meshStandardMaterial color="#b88731" metalness={0.8} roughness={0.3} />
        </mesh>
      </group>
    </group>
  );
}

function AntennaDish() {
  return (
    <group position={[0.76, 1.66, -0.42]} rotation={[-0.25, 0.32, -0.32]}>
      <mesh castShadow>
        <cylinderGeometry args={[0.065, 0.075, 0.75, 14]} />
        <meshStandardMaterial color="#9b9890" metalness={0.86} roughness={0.3} />
      </mesh>
      <group position={[0, 0.45, 0]} rotation={[0.12, 0, 0]}>
        <mesh castShadow rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.49, 0.17, 40, 1, true]} />
          <meshPhysicalMaterial
            color="#d5d0c3"
            metalness={0.72}
            roughness={0.29}
            side={THREE.DoubleSide}
          />
        </mesh>
        <mesh position={[0, -0.02, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.47, 0.018, 8, 40]} />
          <meshStandardMaterial color="#85827b" metalness={0.9} roughness={0.24} />
        </mesh>
        <Strut start={[0, 0, 0]} end={[0, 0.27, 0]} radius={0.018} color="#6d6c68" />
        <mesh position={[0, 0.29, 0]} castShadow>
          <sphereGeometry args={[0.065, 16, 12]} />
          <meshStandardMaterial color="#252728" metalness={0.78} roughness={0.27} />
        </mesh>
      </group>
    </group>
  );
}

function RoboticArm() {
  const joints: Vec3[] = [
    [1.02, 0.68, 1.14],
    [1.28, 0.2, 1.72],
    [0.8, 0.08, 2.18],
  ];

  return (
    <group>
      <Strut start={joints[0]} end={joints[1]} radius={0.07} />
      <Strut start={joints[1]} end={joints[2]} radius={0.06} />
      {joints.map((position, index) => (
        <mesh key={index} position={position} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.14 - index * 0.02, 0.14 - index * 0.02, 0.17, 18]} />
          <meshStandardMaterial color="#a9a69e" metalness={0.88} roughness={0.26} />
        </mesh>
      ))}
      <group position={joints[2]}>
        <Strut start={[0, 0, 0]} end={[-0.12, -0.08, 0.24]} radius={0.025} color="#5d5d59" />
        <Strut start={[0, 0, 0]} end={[0.12, -0.08, 0.24]} radius={0.025} color="#5d5d59" />
      </group>
    </group>
  );
}

function DustPlume({ running }: { running: boolean }) {
  const pointsRef = useRef<THREE.Points>(null);
  const particles = useMemo(() => {
    const random = createSeededRandom(92);
    const positions = new Float32Array(72);
    const velocities = new Float32Array(72);
    for (let index = 0; index < 24; index += 1) {
      positions[index * 3] = (random() - 0.5) * 3.25;
      positions[index * 3 + 1] = random() * 0.16 - 0.1;
      positions[index * 3 + 2] = -1.45 - random() * 1.8;
      velocities[index * 3] = (random() - 0.5) * 0.18;
      velocities[index * 3 + 1] = 0.02 + random() * 0.06;
      velocities[index * 3 + 2] = -0.08 - random() * 0.16;
    }
    return { positions, velocities };
  }, []);
  const geometry = useMemo(() => {
    const result = new THREE.BufferGeometry();
    result.setAttribute('position', new THREE.BufferAttribute(particles.positions, 3));
    return result;
  }, [particles]);

  useFrame((_, delta) => {
    if (!running || !pointsRef.current) return;
    const attribute = pointsRef.current.geometry.attributes.position as THREE.BufferAttribute;
    for (let index = 0; index < attribute.count; index += 1) {
      let x = attribute.getX(index) + particles.velocities[index * 3] * delta;
      let y = attribute.getY(index) + particles.velocities[index * 3 + 1] * delta;
      let z = attribute.getZ(index) + particles.velocities[index * 3 + 2] * delta;
      if (z < -3.5 || y > 0.26) {
        x = (hashNoise(index, z) - 0.5) * 3.2;
        y = -0.08;
        z = -1.45;
      }
      attribute.setXYZ(index, x, y, z);
    }
    attribute.needsUpdate = true;
  });

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial
        color="#c8c0ae"
        size={0.075}
        sizeAttenuation
        transparent
        opacity={running ? 0.2 : 0.04}
        depthWrite={false}
      />
    </points>
  );
}

function Rover({ running }: { running: boolean }) {
  const roverRef = useRef<THREE.Group>(null);
  const progressRef = useRef(11.5);
  const wheelPositions: Vec3[] = [
    [-1.55, 0, -1.18],
    [-1.55, 0, 0],
    [-1.55, 0, 1.18],
    [1.55, 0, -1.18],
    [1.55, 0, 0],
    [1.55, 0, 1.18],
  ];

  useFrame((_, delta) => {
    if (!roverRef.current) return;
    if (running) progressRef.current += Math.min(delta, 0.05) * 0.31;
    const x = -13 + (progressRef.current % 26);
    const z = Math.sin(x * 0.2) * 1.8;
    const slope = Math.cos(x * 0.2) * 0.36;
    const heading = Math.atan2(1, slope);
    const centerHeight = terrainHeight(x, z) + 0.54;
    const aheadHeight = terrainHeight(x + 0.6, z + slope * 0.6);
    const behindHeight = terrainHeight(x - 0.6, z - slope * 0.6);

    roverRef.current.position.set(x, centerHeight, z);
    roverRef.current.rotation.y = heading;
    roverRef.current.rotation.x = THREE.MathUtils.lerp(
      roverRef.current.rotation.x,
      Math.atan2(behindHeight - aheadHeight, 1.2),
      0.06,
    );
  });

  return (
    <group ref={roverRef} position={[-1.5, 0.7, -0.53]} scale={0.86}>
      {wheelPositions.map((position, index) => (
        <Wheel key={index} position={position} running={running} />
      ))}
      {[-1, 1].map((side) => (
        <group key={side}>
          <Strut start={[side * 1.28, 0.5, -1.15]} end={[side * 1.55, 0, -1.18]} />
          <Strut start={[side * 1.28, 0.5, 1.15]} end={[side * 1.55, 0, 1.18]} />
          <Strut start={[side * 1.28, 0.5, 0]} end={[side * 1.55, 0, 0]} />
          <Strut start={[side * 1.26, 0.58, -1.25]} end={[side * 1.26, 0.58, 1.25]} radius={0.07} />
        </group>
      ))}

      <RoundedBox args={[2.55, 0.38, 2.9]} radius={0.08} smoothness={4} position={[0, 0.58, 0]} castShadow>
        <meshStandardMaterial color="#77766f" metalness={0.86} roughness={0.31} />
      </RoundedBox>
      <RoundedBox args={[2.17, 0.7, 1.8]} radius={0.11} smoothness={4} position={[0, 1.02, -0.12]} castShadow>
        <meshStandardMaterial color="#80611d" metalness={0.92} roughness={0.36} />
      </RoundedBox>
      <RoundedBox args={[1.86, 0.18, 1.46]} radius={0.04} smoothness={3} position={[0, 1.43, -0.1]} castShadow>
        <meshStandardMaterial color="#c6c2b8" metalness={0.82} roughness={0.28} />
      </RoundedBox>

      <SolarWing position={[-2.28, 1.26, -0.12]} />
      <SolarWing position={[2.28, 1.26, -0.12]} />

      <RoundedBox args={[1.76, 0.42, 0.48]} radius={0.06} smoothness={3} position={[0, 0.92, 1.12]} castShadow>
        <meshStandardMaterial color="#b9b6ae" metalness={0.74} roughness={0.32} />
      </RoundedBox>
      {[-0.62, 0.62].map((x) => (
        <group key={x} position={[x, 0.94, 1.39]}>
          <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.11, 0.11, 0.11, 20]} />
            <meshStandardMaterial color="#202324" metalness={0.6} roughness={0.22} />
          </mesh>
          <mesh position={[0, 0, 0.06]}>
            <circleGeometry args={[0.073, 20]} />
            <meshPhysicalMaterial
              color="#244c5f"
              emissive="#081720"
              emissiveIntensity={1.2}
              roughness={0.08}
              clearcoat={1}
            />
          </mesh>
        </group>
      ))}

      <CameraMast />
      <AntennaDish />
      <RoboticArm />

      <Cable points={[[-0.85, 1.27, 0.62], [-1.1, 0.98, 0.82], [-1.3, 0.58, 0.88]]} color="#b33b2e" />
      <Cable points={[[-0.76, 1.28, 0.58], [-0.98, 1.02, 0.77], [-1.22, 0.59, 0.81]]} color="#d0b15c" />
      <Cable points={[[0.78, 1.25, -0.76], [1.06, 1.03, -0.94], [1.25, 0.62, -0.98]]} color="#303637" />

      {[-0.9, -0.3, 0.3, 0.9].flatMap((x) =>
        [-0.75, 0.75].map((z) => (
          <mesh key={`${x}-${z}`} position={[x, 1.39, z - 0.1]} castShadow>
            <cylinderGeometry args={[0.038, 0.038, 0.08, 12]} />
            <meshStandardMaterial color="#4e4f4d" metalness={0.92} roughness={0.22} />
          </mesh>
        )),
      )}

      <mesh position={[0, 0.77, -1.5]} castShadow>
        <boxGeometry args={[1.4, 0.28, 0.18]} />
        <meshStandardMaterial color="#303234" metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.78, -1.61]}>
        <boxGeometry args={[0.5, 0.08, 0.018]} />
        <meshStandardMaterial color="#d99c36" emissive="#5c3507" emissiveIntensity={0.45} />
      </mesh>
      <DustPlume running={running} />
    </group>
  );
}

function DistantEarth() {
  return (
    <group position={[-25, 20, -48]} rotation={[0.05, 0.4, -0.3]}>
      <mesh>
        <sphereGeometry args={[2.45, 48, 32]} />
        <meshStandardMaterial color="#356a88" emissive="#071927" emissiveIntensity={0.22} roughness={0.9} />
      </mesh>
      <mesh scale={1.035}>
        <sphereGeometry args={[2.45, 48, 32]} />
        <meshBasicMaterial
          color="#7fc6ee"
          transparent
          opacity={0.1}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <mesh position={[0.08, 0.05, 2.39]} rotation={[0.1, 0.2, 0.2]}>
        <torusGeometry args={[0.85, 0.16, 12, 40, Math.PI * 1.35]} />
        <meshBasicMaterial color="#d5e0d0" transparent opacity={0.32} />
      </mesh>
    </group>
  );
}

function CameraRig({ resetKey }: { resetKey: number }) {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const { camera } = useThree();

  useEffect(() => {
    camera.position.set(12.5, 7.2, 14.5);
    camera.up.set(0, 1, 0);
    controlsRef.current?.target.set(-1.5, 0.9, 0);
    controlsRef.current?.update();
  }, [camera, resetKey]);

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.055}
      minDistance={4.2}
      maxDistance={45}
      minPolarAngle={0.08}
      maxPolarAngle={Math.PI * 0.495}
      rotateSpeed={0.52}
      zoomSpeed={0.72}
      panSpeed={0.6}
      screenSpacePanning
      target={[-1.5, 0.9, 0]}
    />
  );
}

function LunarScene({ running, resetKey }: { running: boolean; resetKey: number }) {
  return (
    <>
      <color attach="background" args={['#010204']} />
      <ambientLight intensity={0.11} color="#a8bdd0" />
      <directionalLight
        position={[-16, 20, -12]}
        intensity={4.6}
        color="#fff1cf"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-24}
        shadow-camera-right={24}
        shadow-camera-top={24}
        shadow-camera-bottom={-24}
        shadow-camera-near={1}
        shadow-camera-far={62}
        shadow-bias={-0.00018}
      />
      <directionalLight position={[12, 8, 10]} intensity={0.28} color="#86a9c7" />
      <Stars radius={90} depth={48} count={4300} factor={3.2} saturation={0.08} fade speed={0.08} />
      <mesh position={[-34, 29, -42]}>
        <sphereGeometry args={[1.05, 24, 16]} />
        <meshBasicMaterial color="#fff2ce" toneMapped={false} />
      </mesh>
      <DistantEarth />
      <LunarGround />
      <TrackMarks />
      <RockField />
      <Rover running={running} />
      <CameraRig resetKey={resetKey} />
    </>
  );
}

function Metric({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div>
      <p className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-white/42">{label}</p>
      <p className="mt-1 font-mono text-[1.05rem] tracking-tight text-stone-100">
        {value} <span className="text-[0.7rem] text-white/42">{unit}</span>
      </p>
    </div>
  );
}

export default function LunarExperience() {
  const [running, setRunning] = useState(true);
  const [ready, setReady] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  return (
    <main className="relative h-dvh w-screen overflow-hidden bg-[#010204] text-stone-100">
      <div
        className="lunar-canvas absolute inset-0"
        role="application"
        aria-label="可交互的三维月面巡视器场景"
      >
        <Canvas
          shadows
          dpr={[1, 1.65]}
          camera={{ position: [12.5, 7.2, 14.5], fov: 42, near: 0.1, far: 240 }}
          gl={{ antialias: true, powerPreference: 'high-performance' }}
          onCreated={({ gl }) => {
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 1.12;
            gl.shadowMap.type = THREE.PCFShadowMap;
            setReady(true);
          }}
        >
          <Suspense fallback={null}>
            <LunarScene running={running} resetKey={resetKey} />
          </Suspense>
        </Canvas>
      </div>

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_48%,transparent_28%,rgba(0,0,0,0.28)_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-black/48 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black/45 to-transparent" />

      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-4 p-4 sm:p-7">
        <section className="hud-panel hud-corner pointer-events-auto max-w-[min(26rem,calc(100vw-2rem))] px-4 py-3.5 sm:px-5 sm:py-4">
          <div className="flex items-center gap-2.5">
            <span className="signal-pulse h-1.5 w-1.5 rounded-full bg-[#efbc58]" />
            <p className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-[#efbc58]">
              Surface unit 07 · Live
            </p>
          </div>
          <div className="mt-2.5 flex items-end gap-3">
            <h1 className="text-[1.05rem] font-medium tracking-[0.08em] text-stone-100 sm:text-[1.22rem]">
              月面巡视器
            </h1>
            <span className="mb-0.5 font-mono text-[0.68rem] text-white/38">LUNA—07</span>
          </div>
          <p className="mt-1.5 font-mono text-[0.72rem] tracking-[0.04em] text-white/45">
            43.17°S · 31.62°E&nbsp;&nbsp;/&nbsp;&nbsp;日照角 12.4°
          </p>
        </section>

        <nav className="pointer-events-auto flex gap-2" aria-label="场景控制">
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => setRunning((value) => !value)}
            className="hud-panel h-10 border-white/15 bg-black/28 px-3.5 text-stone-100 hover:border-[#efbc58]/45 hover:bg-black/45 hover:text-[#f4cc7d]"
            aria-label={running ? '暂停巡视器' : '继续巡视器'}
          >
            {running ? <Pause /> : <Play />}
            <span className="hidden sm:inline">{running ? '暂停' : '继续'}</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => setResetKey((value) => value + 1)}
            className="hud-panel h-10 border-white/15 bg-black/28 px-3.5 text-stone-100 hover:border-[#efbc58]/45 hover:bg-black/45 hover:text-[#f4cc7d]"
            aria-label="重置镜头"
          >
            <RotateCcw />
            <span className="hidden sm:inline">重置视角</span>
          </Button>
        </nav>
      </header>

      <aside className="hud-panel telemetry-grid pointer-events-none absolute bottom-4 left-4 z-10 hidden w-[18rem] p-4 sm:bottom-7 sm:left-7 sm:block">
        <div className="mb-3.5 flex items-center justify-between border-b border-white/10 pb-2.5">
          <div className="flex items-center gap-2 text-[0.72rem] font-medium tracking-[0.12em] text-white/64">
            <Satellite className="size-3.5 text-[#efbc58]" />
            实时遥测
          </div>
          <span className="font-mono text-[0.64rem] uppercase tracking-[0.18em] text-emerald-300/70">Nominal</span>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Metric label="速度" value={running ? '0.18' : '0.00'} unit="m/s" />
          <Metric label="航程" value="124.7" unit="m" />
          <Metric label="电量" value="87.4" unit="%" />
        </div>
        <div className="mt-3.5 flex items-center gap-2 border-t border-white/10 pt-2.5 font-mono text-[0.65rem] text-white/38">
          <Sun className="size-3 text-[#efbc58]/75" />
          <span>太阳翼输出 286 W</span>
          <span className="ml-auto">延迟 1.24 s</span>
        </div>
      </aside>

      <aside className="hud-panel pointer-events-none absolute bottom-4 right-4 z-10 max-w-[calc(100vw-2rem)] px-4 py-3 sm:bottom-7 sm:right-7 sm:px-5 sm:py-4">
        <div className="flex items-center gap-2.5 border-b border-white/10 pb-2.5">
          <Mouse className="size-3.5 text-[#efbc58]" />
          <p className="text-[0.72rem] font-medium tracking-[0.12em] text-white/64">自由浏览</p>
        </div>
        <div className="mt-3 flex items-center gap-4 text-[0.7rem] text-white/46 sm:gap-5">
          <span className="flex items-center gap-1.5">
            <Rotate3d className="size-3.5" /> 拖拽旋转
          </span>
          <span className="flex items-center gap-1.5">
            <ZoomIn className="size-3.5" /> 滚轮缩放
          </span>
          <span className="hidden items-center gap-1.5 sm:flex">
            <Move3d className="size-3.5" /> 右键平移
          </span>
        </div>
      </aside>

      <div className="pointer-events-none absolute left-1/2 top-1/2 z-[5] hidden -translate-x-1/2 -translate-y-1/2 opacity-45 sm:block">
        <div className="relative h-8 w-8 rounded-full border border-white/18">
          <span className="absolute left-1/2 top-[-5px] h-2 w-px -translate-x-1/2 bg-[#efbc58]/60" />
          <span className="absolute bottom-[-5px] left-1/2 h-2 w-px -translate-x-1/2 bg-[#efbc58]/60" />
          <span className="absolute left-[-5px] top-1/2 h-px w-2 -translate-y-1/2 bg-[#efbc58]/60" />
          <span className="absolute right-[-5px] top-1/2 h-px w-2 -translate-y-1/2 bg-[#efbc58]/60" />
        </div>
      </div>

      <div
        aria-live="polite"
        className={`absolute inset-0 z-30 flex items-center justify-center bg-[#030405] transition-all duration-1000 ${
          ready ? 'pointer-events-none opacity-0' : 'opacity-100'
        }`}
      >
        <div className="w-[min(22rem,calc(100vw-3rem))] text-center">
          <Gauge className="mx-auto size-6 text-[#efbc58]" />
          <p className="mt-4 font-mono text-[0.72rem] uppercase tracking-[0.24em] text-white/55">
            正在建立月面链路
          </p>
          <div className="mt-5 h-px overflow-hidden bg-white/10">
            <div className="loading-scan h-full w-1/2" />
          </div>
        </div>
      </div>
    </main>
  );
}
