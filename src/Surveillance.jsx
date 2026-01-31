import React, { useState, useEffect, useRef, Suspense, useMemo, useCallback } from 'react';
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
          if(uIsCenter > 0.5) {
            vec2 center = vec2(0.5, 0.5);
            vec2 dUv = vUv - center;
            float dist = length(dUv);
            float distortionFactor = 1.0 - uFisheyeStrength * dist * dist * 0.5;
            vec2 fisheyeUv = center + dUv * distortionFactor;
            uv = clamp(fisheyeUv, 0.0, 1.0);
          }
          if(uIsTargeted > 0.5) {
            uv = (uv - 0.5) / uScale + 0.5 + uOffset;
          }
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
            vec2 dUv = vUv - 0.5;
            float dist = length(dUv);
            float vignette = smoothstep(0.8, 0.2, dist);
            color *= vignette;
            float scanLine = sin(vUv.y * 1200.0 + uTime * 2.0) * 0.03 + 1.0;
            scanLine += sin(vUv.y * 600.0 + uTime) * 0.02;
            color *= scanLine;
            float grain = noise(vUv * 800.0 + uTime * 0.1) * 0.08;
            color += grain - 0.04;
            color = pow(color, vec3(0.95));
            color = color * 1.1 - 0.05;
            color *= 0.7;
          } else {
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

const DynamicArchiveCell = ({ index, isSelected, currentPath, onSwitchRequest }) => {
  const video = useMemo(() => {
    const v = document.createElement('video');
    v.src = currentPath;
    v.loop = true;
    v.muted = true;
    v.play();
    return v;
  }, [currentPath]);

  useEffect(() => {
    // Determine play duration: Strictly 5s for archive_12, otherwise random 5-8s
    const isSpecial = currentPath.includes('archive_12');
    const playDuration = isSpecial ? 5000 : Math.floor(Math.random() * (8000 - 5000 + 1) + 5000);
    
    const timeout = setTimeout(() => {
      onSwitchRequest(index);
    }, playDuration);
    return () => clearTimeout(timeout);
  }, [currentPath, index, onSwitchRequest]);

  return (
    <div className="grid-cell" style={{ border: isSelected ? '2px solid #ffffff' : '1px solid #333' }}>
      <div className={`cam-label ${isSelected ? 'active-target' : ''}`}>LIVE // CAM_{index + 1}</div>
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

const Surveillance = () => {
  const [videoReady, setVideoReady] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [motionPos, setMotionPos] = useState({ x: 0.5, y: 0.5, active: false });
  const [selectionIndex, setSelectionIndex] = useState(0); 
  const [location, setLocation] = useState(null);
  const [recordingTime, setRecordingTime] = useState(0);

  // Pool management: Updated to handle up to 15 videos
  const archivePool = useMemo(() => {
    return Array.from({ length: 15 }, (_, i) => `/archive_${(i + 1).toString().padStart(2, '0')}.mp4`);
  }, []);

  const [activePaths, setActivePaths] = useState({
    0: archivePool[0], 1: archivePool[1], 2: archivePool[2], 
    3: archivePool[3], 5: archivePool[4], 6: archivePool[5], 
    7: archivePool[6], 8: archivePool[7]
  });

  const lastSpecialPull = useRef(0);
  const videoRef = useRef(null);
  const audioRef = useRef(null);
  const canvasRef = useRef(document.createElement('canvas'));
  const prevFrame = useRef(null);

  const handleSwitchRequest = useCallback((index) => {
    setActivePaths(prev => {
      const currentInUse = Object.values(prev);
      const currentTime = Date.now();
      let candidates = archivePool.filter(path => !currentInUse.includes(path));
      
      const isSpecialAvailable = (currentTime - lastSpecialPull.current) > 30000;
      if (!isSpecialAvailable) {
        candidates = candidates.filter(path => !path.includes('archive_12'));
      }
      
      if (candidates.length === 0) return prev; 
      const nextPath = candidates[Math.floor(Math.random() * candidates.length)];
      
      if (nextPath.includes('archive_12')) {
        lastSpecialPull.current = currentTime;
      }
      
      return { ...prev, [index]: nextPath };
    });
  }, [archivePool]);

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

    const audio = new Audio('/music.mp3');
    audio.loop = true;
    audioRef.current = audio;

    fetch('https://ipwho.is/').then(res => res.json()).then(data => setLocation(data));
  }, []);

  const toggleAudio = () => {
    if (audioRef.current) {
      audioRef.current.muted = !audioRef.current.muted;
      setIsMuted(audioRef.current.muted);
    }
  };

  const handleStart = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      videoRef.current.srcObject = stream;
      videoRef.current.play();
      if (audioRef.current) audioRef.current.play();
      setVideoReady(true);
    } catch (err) { alert("Access Denied."); }
  };

  return (
    <div className="surveillance-app">
      {!videoReady ? (
        <div className="boot-screen">
          <div className="ministry-intro">
            <img src="/logo.png" alt="Division Logo" className="landing-logo fade-in-line" style={{'--delay': '0.2s'}} />
            <h1 className="reduced-title fade-in-line" style={{'--delay': '1s'}}>Thought Police // Surveillance Division</h1>
            <p className="typewriter-text fade-in-line" style={{'--delay': '1.8s'}}>War is peace.</p>
            <p className="typewriter-text fade-in-line" style={{'--delay': '2.6s'}}>Freedom is slavery.</p>
            <p className="typewriter-text fade-in-line" style={{'--delay': '3.4s'}}>Ignorance is strength</p>
            <button className="init-btn fade-in-line" onClick={handleStart} style={{'--delay': '4.5s'}}>Launch Telescreen</button>
          </div>
        </div>
      ) : (
        <>
          <div className="top-center-controls">
            <button className="audio-toggle-btn-small" onClick={toggleAudio}>
              AUDIO: {isMuted ? 'OFF' : 'ON'}
            </button>
          </div>

          <div className="bottom-center-attribution">
            <div className="audio-attribution-sidebar">
              Music by <a href="https://pixabay.com/users/litesaturation-17654080/">LiteSaturation</a> from <a href="https://pixabay.com//">Pixabay</a>
            </div>
          </div>

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
            {[...Array(9)].map((_, i) => (
              i === 4 ? (
                <div key="live-center" className={`grid-cell ${selectionIndex === 4 ? 'live-cell' : ''}`}>
                  <div className={`cam-label ${selectionIndex === 4 ? 'active-target' : ''}`}>LIVE // CAM_5</div>
                  <Canvas orthographic>
                    <Suspense fallback={null}>
                      <SecurityScreen video={videoRef.current} motionPos={motionPos} isTargeted={selectionIndex === 4} isCenter={true} />
                    </Suspense>
                  </Canvas>
                  <div className="osd-overlay">
                    <div className="osd-top-left">
                      <div className="osd-line">REC. {formatTime(recordingTime)}</div>
                    </div>
                  </div>
                </div>
              ) : (
                <DynamicArchiveCell key={i} index={i} isSelected={i === selectionIndex} currentPath={activePaths[i]} onSwitchRequest={handleSwitchRequest} />
              )
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default Surveillance;