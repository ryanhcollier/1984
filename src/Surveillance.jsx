import React, { useState, useEffect, useRef } from 'react';
import './Surveillance.css';

const Surveillance = () => {
  const [logs, setLogs] = useState([]);
  const [isComplete, setIsComplete] = useState(false);
  const [city, setCity] = useState('LOCAL SECTOR');
  const canvasRef = useRef(null);
  const scrollRef = useRef(null);
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    const startSequence = async () => {
      await addLogLine("BIG BROTHER IS WATCHING.", "warning", 80);
      
      try {
        const res = await fetch('https://ipapi.co/json/');
        const data = await res.json();
        setCity(data.city || 'YOUR SECTOR');
        
        await addLogLine(`> TARGET_IP: ${data.ip}`);
        await addLogLine(`> COORDINATES: ${data.latitude}, ${data.longitude}`);
        await addLogLine(`> ISP: ${data.org}`);
      } catch (e) {
        await addLogLine("> ERROR: EXTERNAL LOOKUP BLOCKED BY FIREWALL.");
      }

      await addLogLine(`> GPU_VENDOR: ${getGPU()}`);
      await addLogLine(`> CPU_CORES: ${navigator.hardwareConcurrency || '??'}`);
      
      generateFingerprint();
      await addLogLine("> CANVAS FINGERPRINT HASH GENERATED.");

      for (let i = 0; i < 20; i++) {
        await addLogLine(generateHackerLine(), "hacker", 10);
      }

      await addLogLine(`BIG BROTHER IS WATCHING YOU IN ${city.toUpperCase()}.`, "warning", 80);
      await addLogLine("WAR IS PEACE.", "warning", 50);
      await addLogLine("FREEDOM IS SLAVERY.", "warning", 50);
      await addLogLine("IGNORANCE IS STRENGTH.", "warning", 50);
      
      setIsComplete(true);
    };

    startSequence();
  }, [city]); 

  const addLogLine = (text, type = "standard", speed = 20) => {
    return new Promise((resolve) => {
      let currentText = "";
      let i = 0;
      
      setLogs((prev) => [...prev, { text: "", type, id: Math.random() }]);

      const interval = setInterval(() => {
        currentText += text[i];
        setLogs((prev) => {
          const newLogs = [...prev];
          if (newLogs.length > 0) {
            newLogs[newLogs.length - 1].text = currentText;
          }
          return newLogs;
        });
        
        i++;
        if (i === text.length) {
          clearInterval(interval);
          resolve();
        }
      }, speed);
    });
  };

  const getGPU = () => {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl');
    const debug = gl.getExtension('WEBGL_debug_renderer_info');
    return debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : "Generic Renderer";
  };

  const generateHackerLine = () => {
    const paths = ["/usr/bin/minitrue", "/logs/thoughtcrime", "/var/db/room101", "/sys/core/innerparty"];
    return `> ACCESSING ${paths[Math.floor(Math.random() * paths.length)]} ... 0x${Math.random().toString(16).slice(2, 8).toUpperCase()} OK`;
  };

  const generateFingerprint = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#00d4ff";
    ctx.fillRect(5, 5, 80, 15);
    ctx.fillStyle = "rgba(255,0,0,0.7)";
    ctx.font = "8px monospace";
    ctx.fillText("SIG_778_SCAN", 8, 15);
  };

  const wipeAndExit = () => {
    setLogs([{ text: "PURGING VOLATILE MEMORY...", type: "warning" }]);
    setTimeout(() => (window.location.href = "https://reil.studio"), 800);
  };

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="terminal-body">
      <div className="rec-indicator">
        <div className="red-dot" />
        <span>REC</span>
      </div>
      
      <div className="disclaimer">
        [DISCLAIMER]: SESSION_VOLATILE. NO DATA LOGGED. ALL VARIABLES DESTROYED ON EXIT.
      </div>
      
      <div className="log-container">
        {logs.map((log) => (
          <div key={log.id} className={`log-line ${log.type}`}>
            {log.text}
          </div>
        ))}
        <canvas ref={canvasRef} width="100" height="25" className="fp-canvas" />
        <div ref={scrollRef} />
      </div>

      {isComplete && (
        <button className="exit-btn" onClick={wipeAndExit}>WIPE AND GO BACK</button>
      )}
    </div>
  );
};

export default Surveillance;