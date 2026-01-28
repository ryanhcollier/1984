import React, { useState, useEffect, useRef, Suspense, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import './Surveillance.css';

const SecurityScreen = ({ video, motionPos }) => {
  const materialRef = useRef();
  const shaderArgs = useMemo(() => {
    const tex = new THREE.VideoTexture(video);
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

        void main() {
          vec2 uv = (vUv - 0.5) / uScale + 0.5 + uOffset;
          vec2 dUv = uv - 0.5;
          float dist = length(dUv);
          uv += dUv * dist * dist * uStrength;

          vec4 texel = texture2D(tDiffuse, uv);
          if(uBlur > 0.001) {
             texel += texture2D(tDiffuse, uv + vec2(uBlur, 0.0));
             texel += texture2D(tDiffuse, uv - vec2(uBlur, 0.0));
             texel /= 3.0;
          }

          float gray = dot(texel.rgb, vec3(0.299, 0.587, 0.114));
          gray += (fract(sin(dot(vUv + uTime, vec2(12.9, 78.2))) * 437.5) * 0.03) - (sin(vUv.y * 1100.0) * 0.015);
          
          gl_FragColor = vec4(vec3(gray), 1.0);
        }
      `
    };
  }, [video]);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = t;
      
      const target = new THREE.Vector2((motionPos.x - 0.5) * 0.6, (0.5 - motionPos.y) * 0.4);
      materialRef.current.uniforms.uOffset.value.lerp(target, 0.05);

      if (motionPos.active) {
        materialRef.current.uniforms.uScale.value = THREE.MathUtils.lerp(materialRef.current.uniforms.uScale.value, 2.5, 0.02);
        materialRef.current.uniforms.uBlur.value = Math.abs(Math.sin(t * 2.0)) * 0.003;
      } else {
        materialRef.current.uniforms.uScale.value = THREE.MathUtils.lerp(materialRef.current.uniforms.uScale.value, 1.0, 0.01);
        materialRef.current.uniforms.uBlur.value = THREE.MathUtils.lerp(materialRef.current.uniforms.uBlur.value, 0.0, 0.1);
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
  const [intelQueue, setIntelQueue] = useState([]);
  const [location, setLocation] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(document.createElement('canvas'));
  const prevFrame = useRef(null);

  useEffect(() => {
    if (!videoReady) return;
    const ctx = canvasRef.current.getContext('2d', { willReadFrequently: true });
    canvasRef.current.width = 64;
    canvasRef.current.height = 48;

    const trackMotion = () => {
      ctx.drawImage(videoRef.current, 0, 0, 64, 48);
      const currentFrame = ctx.getImageData(0, 0, 64, 48);
      
      if (prevFrame.current) {
        let totalX = 0, totalY = 0, count = 0;
        for (let i = 0; i < currentFrame.data.length; i += 4) {
          const diff = Math.abs(currentFrame.data[i] - prevFrame.current.data[i]);
          if (diff > 40) {
            const pixelIndex = i / 4;
            totalX += pixelIndex % 64;
            totalY += Math.floor(pixelIndex / 64);
            count++;
          }
        }
        if (count > 10) {
          setMotionPos({ x: totalX / count / 64, y: totalY / count / 48, active: true });
        } else {
          setMotionPos(prev => ({ ...prev, active: false }));
        }
      }
      prevFrame.current = currentFrame;
      requestAnimationFrame(trackMotion);
    };
    trackMotion();
  }, [videoReady]);

  useEffect(() => {
    const video = document.createElement('video');
    video.muted = true; video.playsInline = true; video.autoplay = true;
    video.style.objectFit = 'cover';
    videoRef.current = video;
    fetch('https://ipwho.is/').then(res => res.json()).then(data => setLocation(data));
  }, []);

  const handleStart = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      videoRef.current.srcObject = stream;
      videoRef.current.onloadeddata = () => videoRef.current.play().then(() => setVideoReady(true));
    } catch (err) { alert("Access Denied."); }
  };

  return (
    <div className="canvas-container">
      {!videoReady ? (
        <div className="boot-screen">
          <div className="ministry-intro">
            <h1 className="typewriter-title">The Ministry of Love</h1>
            <p className="typewriter-text">War is peace. Freedom is slavery. Ignorance is strength</p>
            <button className="init-btn main-btn" onClick={handleStart}>Start Watching</button>
          </div>
        </div>
      ) : (
        <>
          <div className="telemetry-sidebar left">
            <div className="sys-header">
              // BIG BROTHER <br />
              // THOUGHT CRIME REPORTING DIV. <br />
              // Active_Intel_Stream
            </div>
            <div className="intel-stack">
              {motionPos.active && <div className="intel-line warning">MOTION_CRIME_DETECTED</div>}
              <div className="intel-line">POS_X: {motionPos.x.toFixed(2)}</div>
              <div className="intel-line">POS_Y: {motionPos.y.toFixed(2)}</div>
            </div>
          </div>
          <div className="telemetry-sidebar right">
             <div className="recording-status">
               <span className="rec-text">LIVE_CV_TRACKING</span>
               <div className="rec-dot" />
             </div>
             <div className="sys-header">TARGET_QUADRANT: {location?.city?.toUpperCase()}</div>
             <div className="log-entry">IP_RECOGNITION: {location?.ip}</div>
          </div>
          <Canvas orthographic>
            <Suspense fallback={null}>
              <SecurityScreen video={videoRef.current} motionPos={motionPos} />
            </Suspense>
          </Canvas>
        </>
      )}
    </div>
  );
};

export default Surveillance;