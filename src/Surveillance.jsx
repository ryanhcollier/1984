import React, { useState, useEffect, useRef, Suspense, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import './Surveillance.css';

const SecurityScreen = ({ video }) => {
  const materialRef = useRef();
  const shaderArgs = useMemo(() => {
    const tex = new THREE.VideoTexture(video);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;

    return {
      uniforms: { 
        tDiffuse: { value: tex },
        uTime: { value: 0.0 },
        uStrength: { value: 0.5 },
        uScale: { value: 1.0 },
        uOffset: { value: new THREE.Vector2(0, 0) },
        uBlur: { value: 0.0 }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float uTime;
        uniform float uStrength;
        uniform float uScale;
        uniform vec2 uOffset;
        uniform float uBlur;
        varying vec2 vUv;

        float random(vec2 p) {
          return fract(sin(dot(p.xy + uTime * 0.1, vec2(12.9898, 78.233))) * 43758.5453123);
        }

        void main() {
          vec2 uv = (vUv - 0.5) / uScale + 0.5 + uOffset;
          vec2 dUv = uv - 0.5;
          float dist = length(dUv);
          uv += dUv * dist * dist * uStrength;

          vec4 texel = texture2D(tDiffuse, uv);
          if(uBlur > 0.001) {
             texel += texture2D(tDiffuse, uv + vec2(uBlur, 0.001));
             texel += texture2D(tDiffuse, uv - vec2(uBlur, 0.001));
             texel /= 3.0;
          }

          float gray = dot(texel.rgb, vec3(0.299, 0.587, 0.114));
          float noise = random(vUv) * 0.03; 
          float scanLine = sin(vUv.y * 1100.0) * 0.015; 
          
          gray += noise - 0.015 - scanLine;
          gl_FragColor = vec4(vec3(gray), 1.0);
        }
      `
    };
  }, [video]);

  const behavior = useRef({
    targetPos: new THREE.Vector2(0, 0),
    isZooming: false,
    nextActionTime: 0
  });

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    const material = materialRef.current;
    if (!material) return;

    if (shaderArgs.uniforms.tDiffuse.value) shaderArgs.uniforms.tDiffuse.value.needsUpdate = true;
    material.uniforms.uTime.value = t;

    if (t > behavior.current.nextActionTime) {
      const decision = Math.random();
      if (decision > 0.6) {
        behavior.current.isZooming = true;
        behavior.current.nextActionTime = t + 4 + Math.random() * 2;
      } else {
        behavior.current.isZooming = false;
        behavior.current.targetPos.set((Math.random() - 0.5) * 0.55, (Math.random() - 0.5) * 0.45);
        behavior.current.nextActionTime = t + 5 + Math.random() * 5;
      }
    }

    material.uniforms.uOffset.value.lerp(behavior.current.targetPos, 0.012);

    if (behavior.current.isZooming) {
      material.uniforms.uScale.value = THREE.MathUtils.lerp(material.uniforms.uScale.value, 3.5, 0.02);
      material.uniforms.uBlur.value = Math.abs(Math.sin(t * 1.5)) * 0.002;
    } else {
      material.uniforms.uScale.value = THREE.MathUtils.lerp(material.uniforms.uScale.value, 1.05, 0.01);
      material.uniforms.uBlur.value = THREE.MathUtils.lerp(material.uniforms.uBlur.value, 0.0, 0.05);
    }
  });

  return (
    <mesh>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial ref={materialRef} args={[shaderArgs]} />
    </mesh>
  );
};

const Surveillance = () => {
  const [videoReady, setVideoReady] = useState(false);
  const [logs, setLogs] = useState([]);
  const [intelQueue, setIntelQueue] = useState([]);
  const [location, setLocation] = useState(null);
  const videoRef = useRef(null);

  useEffect(() => {
    const video = document.createElement('video');
    video.muted = true; video.playsInline = true; video.autoplay = true;
    video.style.objectFit = 'cover';
    videoRef.current = video;
    fetch('https://ipwho.is/').then(res => res.json()).then(data => setLocation(data));
  }, []);

  useEffect(() => {
    if (!videoReady) return;
    const interval = setInterval(() => {
      const phrases = [
        `SUBJ_ID: ${Math.random().toString(36).substring(7).toUpperCase()}`,
        `BIO_MATCH: ${(Math.random() * 100).toFixed(2)}%`,
        `OBJ_COUNT: ${Math.floor(Math.random() * 12)}`,
        `THERMAL: ${(36.2 + Math.random()).toFixed(1)}°C`,
        `RECOG_PASS: VALIDATED`,
        `GAIT_ANALYSIS: STABLE`,
        `PULSE_EST: ${Math.floor(Math.random() * 30) + 70} BPM`,
        `ANOMALY_PROB: ${(Math.random() * 5).toFixed(2)}%`,
        `THOUGHT_PATTERN: DEVIANT`,
        `LOYALTY_SCORE: ${(Math.random() * 40 + 60).toFixed(1)}%`
      ];
      
      const newEntry = {
        text: phrases[Math.floor(Math.random() * phrases.length)],
        isWarning: Math.random() > 0.85 
      };

      setIntelQueue(prev => [newEntry, ...prev].slice(0, 6));
      setLogs(prev => [`[${new Date().toLocaleTimeString()}] THOUGHT_SCAN_${Math.random().toString(16).slice(2, 6)}`, ...prev].slice(0, 15));
    }, 1800);
    return () => clearInterval(interval);
  }, [videoReady]);

  const handleStart = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      videoRef.current.srcObject = stream;
      videoRef.current.onloadeddata = () => {
        videoRef.current.play().then(() => setVideoReady(true));
      };
    } catch (err) {
      alert("System access denied.");
    }
  };

  return (
    <div className="canvas-container">
      {!videoReady ? (
        <div className="boot-screen">
          <div className="ministry-intro">
            <h1 className="typewriter-title">The Ministry of Love</h1>
            <p className="typewriter-text">War is peace.</p>
            <p className="typewriter-text">Freedom is slavery.</p>
            <p className="typewriter-text">Ignorance is strength</p>
            <button className="init-btn main-btn" onClick={handleStart}>Start Watching</button>
          </div>
        </div>
      ) : (
        <>
          <div className="telemetry-sidebar left">
            <div className="intel-stack">
              {intelQueue.map((item, i) => (
                <div key={i} className={`intel-line ${item.isWarning ? 'warning' : ''}`}>
                  {item.text}
                </div>
              ))}
            </div>
            <div className="sys-header">
              // BIG BROTHER <br />
              // THOUGHT CRIME REPORTING DIV. <br />
              // Active_Intel_Stream
            </div>
            <div className="log-container">
              {logs.map((log, i) => <div key={i} className="log-entry">{log}</div>)}
            </div>
          </div>

          <div className="telemetry-sidebar right">
            <div className="recording-status">
              <span className="rec-text">LIVE // ARCHIVING</span>
              <div className="rec-dot" />
            </div>
            <div className="sys-header">TARGET_QUADRANT: {location?.city?.toUpperCase()}</div>
            <div className="log-entry">IP_RECOGNITION: {location?.ip}</div>
            <div className="log-entry">NETWORK: {location?.connection?.isp?.toUpperCase()}</div>
          </div>

          <Canvas orthographic gl={{ antialias: false }}>
            <Suspense fallback={null}>
              <SecurityScreen video={videoRef.current} />
            </Suspense>
          </Canvas>
        </>
      )}
    </div>
  );
};

export default Surveillance;