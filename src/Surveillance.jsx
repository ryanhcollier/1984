import React, { useState, useEffect, useRef, Suspense, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import './Surveillance.css';

const SecurityScreen = ({ video, motionPos, isTargeted, isCenter }) => {
  const materialRef = useRef();
  const shaderArgs = useMemo(() => {
    const tex = new THREE.VideoTexture(video);
    return {
      uniforms: { 
        tDiffuse: { value: tex },
        uTime: { value: 0.0 },
        uStrength: { value: 0.4 },
        uScale: { value: 1.0 },
        uOffset: { value: new THREE.Vector2(0, 0) },
        uIsTargeted: { value: isTargeted ? 1.0 : 0.0 },
        uIsCenter: { value: isCenter ? 1.0 : 0.0 },
        uFisheyeStrength: { value: 0.5 }
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
        uniform float uIsTargeted;
        uniform float uIsCenter;
        uniform float uFisheyeStrength;
        varying vec2 vUv;

        // Simple noise function
        float random(vec2 st) {
          return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
        }

        float noise(vec2 st) {
          vec2 i = floor(st);
          vec2 f = fract(st);
          float a = random(i);
          float b = random(i + vec2(1.0, 0.0));
          float c = random(i + vec2(0.0, 1.0));
          float d = random(i + vec2(1.0, 1.0));
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(a, b, u.x) + (c - a)* u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
        }

        void main() {
          vec2 uv = vUv;
          
          // Apply fisheye distortion for center screen (barrel distortion)
          if(uIsCenter > 0.5) {
            vec2 center = vec2(0.5, 0.5);
            vec2 dUv = vUv - center;
            float dist = length(dUv);
            
            // Apply barrel distortion: compress sampling coordinates toward center
            // This creates fisheye effect while keeping video full screen
            float distortionFactor = 1.0 - uFisheyeStrength * dist * dist * 0.5;
            vec2 fisheyeUv = center + dUv * distortionFactor;
            
            // Ensure we stay within valid UV range
            uv = clamp(fisheyeUv, 0.0, 1.0);
          }
          
          if(uIsTargeted > 0.5) {
            uv = (uv - 0.5) / uScale + 0.5 + uOffset;
          }

          // Sample with slight blur for softness (especially at edges)
          vec4 texel = texture2D(tDiffuse, uv);
          if(uIsCenter > 0.5) {
            vec2 dUv = vUv - 0.5;
            float dist = length(dUv);
            float blurAmount = smoothstep(0.3, 0.8, dist) * 0.003;
            texel += texture2D(tDiffuse, uv + vec2(blurAmount, 0.0));
            texel += texture2D(tDiffuse, uv + vec2(-blurAmount, 0.0));
            texel += texture2D(tDiffuse, uv + vec2(0.0, blurAmount));
            texel += texture2D(tDiffuse, uv + vec2(0.0, -blurAmount));
            texel /= 5.0;
          }
          
          float gray = dot(texel.rgb, vec3(0.299, 0.587, 0.114));
          
          vec3 color = vec3(gray); 
          
          if(uIsCenter > 0.5) {
            // Vignette
            vec2 dUv = vUv - 0.5;
            float dist = length(dUv);
            float vignette = smoothstep(0.8, 0.2, dist);
            color *= vignette;
            
            // Enhanced scan lines (more prominent)
            float scanLine = sin(vUv.y * 1200.0 + uTime * 2.0) * 0.03 + 1.0;
            scanLine += sin(vUv.y * 600.0 + uTime) * 0.02;
            color *= scanLine;
            
            // Add noise/grain
            float grain = noise(vUv * 800.0 + uTime * 0.1) * 0.08;
            color += grain - 0.04;
            
            // Slight contrast boost for surveillance look
            color = pow(color, vec3(0.95));
            color = color * 1.1 - 0.05;
            // Darken center screen
            color *= 0.7;
          } else {
            // Subtle scan lines for other screens
            color -= sin(vUv.y * 800.0 + uTime) * 0.02;
          }
          
          if(uIsTargeted > 0.5) {
            float border = smoothstep(0.47, 0.5, max(abs(vUv.x - 0.5), abs(vUv.y - 0.5)));
            color += vec3(border * 0.3); 
            color *= 1.0 + sin(uTime * 12.0) * 0.07;
          }

          gl_FragColor = vec4(color, 1.0);
        }
      `
    };
  }, [video, isTargeted, isCenter]);

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.getElapsedTime();
      if (isTargeted) {
        const target = new THREE.Vector2((motionPos.x - 0.5) * 0.4, (0.5 - motionPos.y) * 0.3);
        materialRef.current.uniforms.uOffset.value.lerp(target, 0.05);
        materialRef.current.uniforms.uScale.value = motionPos.active ? 
          THREE.MathUtils.lerp(materialRef.current.uniforms.uScale.value, 1.8, 0.02) : 
          THREE.MathUtils.lerp(materialRef.current.uniforms.uScale.value, 1.0, 0.01);
      } else {
        materialRef.current.uniforms.uScale.value = 1.0;
        materialRef.current.uniforms.uOffset.value.set(0, 0);
      }
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
  const [motionPos, setMotionPos] = useState({ x: 0.5, y: 0.5, active: false });
  const [selectionIndex, setSelectionIndex] = useState(0); 
  const [location, setLocation] = useState(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const videoRef = useRef(null);
  const canvasRef = useRef(document.createElement('canvas'));
  const prevFrame = useRef(null);

  const archivePaths = [
    '/archive_01.mp4', '/archive_02.mp4', '/archive_03.mp4',
    '/archive_04.mp4', '/archive_05.mp4', '/archive_06.mp4',
    '/archive_07.mp4', '/archive_08.mp4'
  ];

  useEffect(() => {
    if (!videoReady) return;
    const interval = setInterval(() => {
      setSelectionIndex((prev) => {
        const candidates = [0, 1, 2, 3, 4, 5, 6, 7, 8].filter((n) => n !== prev);
        return candidates[Math.floor(Math.random() * candidates.length)];
      });
    }, 4000);
    return () => clearInterval(interval);
  }, [videoReady]);

  useEffect(() => {
    if (!videoReady) return;
    const interval = setInterval(() => {
      setRecordingTime((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [videoReady]);

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const mins = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${hrs}:${mins}:${secs}`;
  };

  useEffect(() => {
    if (!videoReady) return;
    const ctx = canvasRef.current.getContext('2d', { willReadFrequently: true });
    canvasRef.current.width = 64; canvasRef.current.height = 48;
    const track = () => {
      ctx.drawImage(videoRef.current, 0, 0, 64, 48);
      const current = ctx.getImageData(0, 0, 64, 48);
      if (prevFrame.current) {
        let tx = 0, ty = 0, c = 0;
        for (let i = 0; i < current.data.length; i += 4) {
          if (Math.abs(current.data[i] - prevFrame.current.data[i]) > 40) {
            tx += (i / 4) % 64; ty += Math.floor((i / 4) / 64); c++;
          }
        }
        if (c > 10) setMotionPos({ x: tx / c / 64, y: ty / c / 48, active: true });
        else setMotionPos(p => ({ ...p, active: false }));
      }
      prevFrame.current = current;
      requestAnimationFrame(track);
    };
    track();
  }, [videoReady]);

  useEffect(() => {
    const video = document.createElement('video');
    video.muted = true; video.playsInline = true; video.autoplay = true;
    videoRef.current = video;
    fetch('https://ipwho.is/').then(res => res.json()).then(data => setLocation(data));
  }, []);

  const handleStart = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      videoRef.current.srcObject = stream;
      videoRef.current.play().then(() => setVideoReady(true));
    } catch (err) { alert("Access Denied."); }
  };

  const renderCells = () => {
    const cells = [];
    let archiveIdx = 0;

    for (let i = 0; i < 9; i++) {
      const isSelected = i === selectionIndex;
      const isCenter = i === 4;
      
      if (isCenter) {
        cells.push(
          <div key="live-center" className={`grid-cell ${isSelected ? 'live-cell' : ''}`}>
            <div className={`cam-label ${isSelected ? 'active-target' : ''}`}>LIVE // CAM_{i + 1}</div>
            <Canvas orthographic>
              <Suspense fallback={null}>
                <SecurityScreen 
                  video={videoRef.current} 
                  motionPos={motionPos} 
                  isTargeted={isSelected}
                  isCenter={true}
                />
              </Suspense>
            </Canvas>
            <div className="osd-overlay">
              <div className="osd-top-left">
                <div className="osd-line">REC. {formatTime(recordingTime)}</div>
                <div className="osd-line">100_{formatTime(recordingTime)}</div>
                <div className="osd-line">ACA_25FPS</div>
              </div>
              <div className="osd-top-right">
                <div className="osd-line">REC. LIVE FEED</div>
              </div>
            </div>
          </div>
        );
      } else {
        cells.push(
          <ArchiveCell 
            key={`archive-${i}`} 
            src={archivePaths[archiveIdx % 8]} 
            index={i} 
            isSelected={isSelected}
          />
        );
        archiveIdx++;
      }
    }
    return cells;
  };

  return (
    <div className="surveillance-app">
      {!videoReady ? (
        <div className="boot-screen">
          <div className="ministry-intro">
            {/* Logo included here */}
            <img src="/logo.png" alt="Division Logo" className="landing-logo" />
            <h1 className="typewriter-title reduced-title">Thought Police // Surveillance Division</h1>
            <p className="typewriter-text">War is peace.</p>
            <p className="typewriter-text">Freedom is slavery.</p>
            <p className="typewriter-text">Ignorance is strength</p>
            <button className="init-btn" onClick={handleStart}>Launch Telescreen</button>
          </div>
        </div>
      ) : (
        <>
          <div className="telemetry-sidebar left">
            <div className="sys-header">// BIG BROTHER <br /> // THOUGHT CRIME REPORTING DIV.</div>
            <div className="intel-stack">
              {selectionIndex === 4 && motionPos.active && <div className="intel-line warning">CENTER_ANOMALY_DETECTED</div>}
              <div className="intel-line">ACTIVE_SCAN: SECTOR_{selectionIndex + 1}</div>
            </div>
          </div>
          <div className="telemetry-sidebar right">
             <div className="recording-status"><span className="rec-text">LIVE_CV_TRACKING</span><div className="rec-dot" /></div>
             <div className="sys-header">QUADRANT: {location?.city?.toUpperCase() || "LOCATING..."}</div>
          </div>
          <div className="monitor-grid">
            {renderCells()}
          </div>
        </>
      )}
    </div>
  );
};

const ArchiveCell = ({ src, index, isSelected }) => {
  const video = useMemo(() => {
    const v = document.createElement('video');
    v.src = src; v.loop = true; v.muted = true; v.play();
    return v;
  }, [src]);

  return (
    <div className="grid-cell" style={{ border: isSelected ? '2px solid #ffffff' : '1px solid #333' }}>
      <div className={`cam-label ${isSelected ? 'active-target' : ''}`}>
        LIVE // CAM_{index + 1}
      </div>
      <Canvas orthographic>
        <Suspense fallback={null}>
          <SecurityScreen 
            video={video} 
            isTargeted={isSelected} 
            motionPos={{x:0.5, y:0.5, active: false}} 
            isCenter={false}
          />
        </Suspense>
      </Canvas>
    </div>
  );
};

export default Surveillance;