import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import {
  Color,
  DoubleSide,
  Euler,
  Group,
  InstancedMesh,
  MathUtils,
  Matrix4,
  Object3D,
  Quaternion,
  Vector3,
} from "three";

const SCENE_SEED = 1402;

type DreamSceneProps = {
  reducedMotion: boolean;
};

type Segment = {
  matrix: Matrix4;
  depth: number;
};

type Blossom = {
  matrix: Matrix4;
};

function mulberry32(seed: number) {
  return () => {
    let value = (seed += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function segmentMatrix(start: Vector3, end: Vector3, radius: number) {
  const direction = end.clone().sub(start);
  const length = direction.length();
  const quaternion = new Quaternion().setFromUnitVectors(
    new Vector3(0, 1, 0),
    direction.clone().normalize(),
  );
  return new Matrix4().compose(
    start.clone().add(end).multiplyScalar(0.5),
    quaternion,
    new Vector3(radius, length, radius),
  );
}

function generateCherryTree(seed: number, quality: "low" | "high") {
  const random = mulberry32(seed);
  const segments: Segment[] = [];
  const blossoms: Blossom[] = [];
  const queue: Array<{
    start: Vector3;
    direction: Vector3;
    length: number;
    radius: number;
    depth: number;
  }> = [
    {
      start: new Vector3(0, -1.4, 0),
      direction: new Vector3(0.08, 0.98, 0.04).normalize(),
      length: 2.25,
      radius: 0.18,
      depth: 0,
    },
  ];
  const maxDepth = quality === "high" ? 4 : 3;

  while (queue.length) {
    const branch = queue.shift()!;
    const end = branch.start.clone().addScaledVector(branch.direction, branch.length);
    segments.push({ matrix: segmentMatrix(branch.start, end, branch.radius), depth: branch.depth });

    if (branch.depth >= maxDepth) {
      const count = quality === "high" ? 7 : 4;
      for (let index = 0; index < count; index += 1) {
        const position = end
          .clone()
          .add(
            new Vector3(
              (random() - 0.5) * 0.48,
              (random() - 0.35) * 0.34,
              (random() - 0.5) * 0.48,
            ),
          );
        blossoms.push({
          matrix: new Matrix4().compose(
            position,
            new Quaternion().setFromEuler(
              new Euler(random() * Math.PI, random() * Math.PI, random() * Math.PI),
            ),
            new Vector3(0.7 + random() * 0.7, 0.45 + random() * 0.55, 0.7 + random() * 0.7),
          ),
        });
      }
      continue;
    }

    const continuation = branch.direction
      .clone()
      .add(
        new Vector3(
          (random() - 0.5) * (0.22 + branch.depth * 0.08),
          0.1,
          (random() - 0.5) * (0.2 + branch.depth * 0.08),
        ),
      )
      .normalize();
    queue.push({
      start: end,
      direction: continuation,
      length: branch.length * (0.7 + random() * 0.08),
      radius: branch.radius * 0.7,
      depth: branch.depth + 1,
    });

    const childCount = branch.depth === 0 ? 4 : branch.depth < 2 ? 3 : 2;
    for (let child = 0; child < childCount; child += 1) {
      const slot = (child + 1) / (childCount + 1);
      const childStart = branch.start.clone().lerp(end, 0.35 + slot * 0.5);
      const angle = (child / childCount) * Math.PI * 2 + random() * 0.9 + branch.depth;
      const direction = new Vector3(
        Math.cos(angle) * (0.5 + random() * 0.3),
        0.55 + random() * 0.28,
        Math.sin(angle) * (0.5 + random() * 0.3),
      ).normalize();
      queue.push({
        start: childStart,
        direction,
        length: branch.length * (0.48 + random() * 0.12),
        radius: branch.radius * 0.56,
        depth: branch.depth + 1,
      });
    }
  }
  return { segments, blossoms };
}

function InstancedTree({
  quality,
  reducedMotion,
  debug,
}: {
  quality: "low" | "high";
  reducedMotion: boolean;
  debug: boolean;
}) {
  const group = useRef<Group>(null);
  const branches = useRef<InstancedMesh>(null);
  const flowers = useRef<InstancedMesh>(null);
  const tree = useMemo(() => generateCherryTree(SCENE_SEED, quality), [quality]);

  useLayoutEffect(() => {
    tree.segments.forEach((segment, index) => branches.current?.setMatrixAt(index, segment.matrix));
    tree.blossoms.forEach((blossom, index) => flowers.current?.setMatrixAt(index, blossom.matrix));
    if (branches.current) branches.current.instanceMatrix.needsUpdate = true;
    if (flowers.current) flowers.current.instanceMatrix.needsUpdate = true;
  }, [tree]);

  useFrame(({ clock }, delta) => {
    if (!group.current || reducedMotion || document.hidden) return;
    const target = Math.sin(clock.elapsedTime * 0.42) * 0.018;
    group.current.rotation.z = MathUtils.damp(group.current.rotation.z, target, 2.2, delta);
  });

  return (
    <group ref={group} position={[1.95, -0.35, -1.5]} rotation={[0, -0.28, -0.04]}>
      <instancedMesh ref={branches} args={[undefined, undefined, tree.segments.length]}>
        <cylinderGeometry args={[1, 1, 1, 7]} />
        <meshStandardMaterial color={debug ? "#5b8def" : "#6d4c46"} roughness={0.86} />
      </instancedMesh>
      <instancedMesh ref={flowers} args={[undefined, undefined, tree.blossoms.length]}>
        <octahedronGeometry args={[0.13, 0]} />
        <meshStandardMaterial color={debug ? "#f4d03f" : "#f3a9bd"} roughness={0.78} />
      </instancedMesh>
    </group>
  );
}

function PetalField({ count, reducedMotion }: { count: number; reducedMotion: boolean }) {
  const mesh = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const petals = useMemo(() => {
    const random = mulberry32(SCENE_SEED + 8);
    return Array.from({ length: count }, () => ({
      x: (random() - 0.5) * 8,
      y: random() * 5 - 1.4,
      z: (random() - 0.5) * 3,
      speed: 0.08 + random() * 0.18,
      phase: random() * Math.PI * 2,
      scale: 0.45 + random() * 0.75,
    }));
  }, [count]);

  useFrame(({ clock }) => {
    if (!mesh.current) return;
    const elapsed = reducedMotion ? 0 : clock.elapsedTime;
    petals.forEach((petal, index) => {
      const y = reducedMotion
        ? petal.y
        : ((petal.y - elapsed * petal.speed + 2.2) % 5.8) - 2.2;
      dummy.position.set(
        petal.x + Math.sin(elapsed * 0.35 + petal.phase) * 0.4,
        y,
        petal.z,
      );
      dummy.rotation.set(0.4 + petal.phase, elapsed * 0.3 + petal.phase, petal.phase);
      dummy.scale.setScalar(petal.scale);
      dummy.updateMatrix();
      mesh.current!.setMatrixAt(index, dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]}>
      <planeGeometry args={[0.075, 0.12]} />
      <meshBasicMaterial color="#f6b7c9" side={DoubleSide} transparent opacity={0.82} />
    </instancedMesh>
  );
}

function CloudCluster({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  const pieces: Array<[number, number, number, number]> = [
    [-0.75, 0, 0, 0.75],
    [-0.2, 0.16, 0.04, 0.95],
    [0.42, 0.05, -0.04, 0.8],
    [0.9, -0.08, 0.02, 0.58],
  ];
  return (
    <group position={position} scale={scale}>
      {pieces.map(([x, y, z, size], index) => (
        <mesh key={index} position={[x, y, z]} scale={[size * 1.35, size * 0.62, size]}>
          <dodecahedronGeometry args={[1, 1]} />
          <meshStandardMaterial color="#fff9f5" roughness={1} transparent opacity={0.82} />
        </mesh>
      ))}
    </group>
  );
}

function FloatingEnvelope({ reducedMotion }: { reducedMotion: boolean }) {
  const group = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (!group.current || reducedMotion || document.hidden) return;
    group.current.position.y = 0.2 + Math.sin(clock.elapsedTime * 0.65) * 0.055;
    group.current.rotation.z = -0.08 + Math.sin(clock.elapsedTime * 0.42) * 0.018;
  });
  return (
    <group ref={group} position={[-0.25, 0.2, 0.65]} rotation={[0.06, -0.2, -0.08]}>
      <mesh scale={[1.28, 0.82, 0.09]}>
        <boxGeometry />
        <meshStandardMaterial color="#fff7e8" roughness={0.76} />
      </mesh>
      <mesh position={[0, 0.02, 0.08]} rotation={[0, 0, Math.PI / 4]} scale={[0.68, 0.68, 0.035]}>
        <boxGeometry />
        <meshStandardMaterial color="#efd9d5" roughness={0.82} />
      </mesh>
      <mesh position={[0, -0.02, 0.14]}>
        <sphereGeometry args={[0.15, 12, 8]} />
        <meshStandardMaterial color="#b55f73" roughness={0.68} />
      </mesh>
    </group>
  );
}

function CameraRig({ reducedMotion }: { reducedMotion: boolean }) {
  const { camera, pointer } = useThree();
  const target = useMemo(() => new Vector3(), []);
  useFrame((_, delta) => {
    const x = reducedMotion ? 0 : pointer.x * 0.18;
    const y = reducedMotion ? 0 : pointer.y * 0.1;
    target.set(x, 0.45 + y, 8.2);
    camera.position.lerp(target, 1 - Math.exp(-delta * 2.2));
    camera.lookAt(0.2, 0.12, 0);
  });
  return null;
}

function Scene({ reducedMotion }: DreamSceneProps) {
  const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  const quality: "low" | "high" =
    navigator.hardwareConcurrency <= 4 || deviceMemory <= 4 ? "low" : "high";
  const debug = new URLSearchParams(window.location.search).get("sceneDebug") === "branches";
  return (
    <>
      <color attach="background" args={[new Color(debug ? "#10151a" : "#f7e8ee")]} />
      <fog attach="fog" args={["#f7e8ee", 7.5, 15]} />
      <hemisphereLight args={["#fff7f0", "#a77b88", 2.2]} />
      <directionalLight position={[-4, 7, 5]} intensity={2.1} color="#fff3df" />
      <ambientLight intensity={0.65} />
      <CameraRig reducedMotion={reducedMotion} />
      {debug && (
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[1.5, 1.5, 1.5]} />
          <meshBasicMaterial color="#22ff77" wireframe />
        </mesh>
      )}
      <CloudCluster position={[-2.8, -1.45, -1.1]} scale={1.55} />
      <CloudCluster position={[2.4, -1.25, -2.2]} scale={1.3} />
      <CloudCluster position={[0.3, 2.65, -3.6]} scale={0.9} />
      <InstancedTree quality={quality} reducedMotion={reducedMotion} debug={debug} />
      <FloatingEnvelope reducedMotion={reducedMotion} />
      <PetalField count={quality === "high" ? 62 : 28} reducedMotion={reducedMotion} />
    </>
  );
}

function supportsWebGl() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

export default function DreamScene(props: DreamSceneProps) {
  if (!supportsWebGl()) return null;
  return (
    <div className="dream-scene" aria-hidden="true">
      <Canvas
        camera={{ fov: 38, near: 0.1, far: 40, position: [0, 0.45, 8.2] }}
        dpr={[1, 1.5]}
        frameloop={props.reducedMotion ? "demand" : "always"}
        gl={{ alpha: false, antialias: true, powerPreference: "high-performance" }}
      >
        <Scene {...props} />
      </Canvas>
    </div>
  );
}
