import React, { useState, useEffect, useRef } from 'react';
import { Shield, KeyRound, Map, Zap, Cpu, Volume2, VolumeX, Eye } from 'lucide-react';
import { Transmission } from '../types';

interface DecoderWorkspaceProps {
  transmission: Transmission | null;
  onSolve: (id: string, decodedMessage: string) => void;
  onUpdateModifiers: (mod1: number, mod2: number) => void;
}

export default function DecoderWorkspace({
  transmission,
  onSolve,
  onUpdateModifiers,
}: DecoderWorkspaceProps) {
  if (!transmission) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8 bg-zinc-950/40 rounded-xl border border-zinc-900 border-dashed">
        <Cpu className="w-12 h-12 text-zinc-600 mb-3 animate-pulse" />
        <p className="font-mono text-xs text-zinc-500 max-w-sm">
          NO ACTIVE TRACE LOADED FOR ANALYSIS.<br />
          SELECT AN INCOMING FREQUENCY CAPTURE TO INITIALIZE DECODER SUB-PROCESSORS.
        </p>
      </div>
    );
  }

  // Common State
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // 1. Text Cipher States
  const [cipherShift, setCipherShift] = useState(0);
  const [userHexText, setUserHexText] = useState('');

  // 2. Coordinate States
  const [plotX, setPlotX] = useState(0); // -100 to 100
  const [plotY, setPlotY] = useState(0); // -100 to 100
  const [isPlotLocked, setIsPlotLocked] = useState(false);

  // 3. Audio States
  const [audioCarrier, setAudioCarrier] = useState(300); // Hz slider
  const [audioModulator, setAudioModulator] = useState(4); // Hz slider (LFO)
  const [isMuted, setIsMuted] = useState(true);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const carrierOscRef = useRef<OscillatorNode | null>(null);
  const modOscRef = useRef<OscillatorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);

  // 4. Symbol States
  const [resolvedSymbols, setResolvedSymbols] = useState<Record<string, string>>({});
  const [matrixActiveCode, setMatrixActiveCode] = useState('');

  // Reset solver states on transmission changes
  useEffect(() => {
    setSuccessMsg(null);
    setIsPlotLocked(false);
    setUserHexText('');
    setCipherShift(0);
    setResolvedSymbols({});
    
    if (transmission.type === 'text') {
      onUpdateModifiers(0, 0);
    } else if (transmission.type === 'coordinates') {
      setPlotX(0);
      setPlotY(0);
      onUpdateModifiers(0, 0);
    } else if (transmission.type === 'audio') {
      setAudioCarrier(250);
      setAudioModulator(2);
      onUpdateModifiers(250, 2);
    } else if (transmission.type === 'symbol' && transmission.symbols) {
      const keys = transmission.symbols.glyphSymbols;
      const initialMap: Record<string, string> = {};
      keys.forEach((k) => { initialMap[k] = ''; });
      setResolvedSymbols(initialMap);
      onUpdateModifiers(0, 0);
    }

    // Clean up synthesizers if running
    cleanupAudio();
  }, [transmission.id]);

  // Audio Synth Synthesizer management (interactive space-like sound effect)
  const initAudioCtx = () => {
    if (!audioCtxRef.current) {
      // @ts-ignore
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      audioCtxRef.current = new AudioCtxClass();
    }
  };

  const startAudioSynth = () => {
    if (isMuted) return;
    try {
      initAudioCtx();
      const ctx = audioCtxRef.current;
      if (!ctx) return;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      cleanupAudio();

      // Create units
      const carrierOsc = ctx.createOscillator();
      const modOsc = ctx.createOscillator();
      const modGain = ctx.createGain();
      const mainGain = ctx.createGain();

      carrierOsc.type = 'sawtooth';
      carrierOsc.frequency.value = audioCarrier;

      modOsc.type = 'sine';
      modOsc.frequency.value = audioModulator;
      modGain.gain.value = 150 * (audioModulator / 10); // modulation index

      mainGain.gain.setValueAtTime(0, ctx.currentTime);
      mainGain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.1); 

      // Connect LFO Modulator -> Carrier Frequency
      modOsc.connect(modGain);
      modGain.connect(carrierOsc.frequency);

      // Connect Carrier -> Main Out
      carrierOsc.connect(mainGain);
      mainGain.connect(ctx.destination);

      carrierOsc.start();
      modOsc.start();

      carrierOscRef.current = carrierOsc;
      modOscRef.current = modOsc;
      gainNodeRef.current = mainGain;
    } catch (e) {
      console.warn("Audio Context init blocked or failed:", e);
    }
  };

  const cleanupAudio = () => {
    try {
      if (carrierOscRef.current) {
        carrierOscRef.current.stop();
        carrierOscRef.current.disconnect();
        carrierOscRef.current = null;
      }
      if (modOscRef.current) {
        modOscRef.current.stop();
        modOscRef.current.disconnect();
        modOscRef.current = null;
      }
      if (gainNodeRef.current) {
        gainNodeRef.current.disconnect();
        gainNodeRef.current = null;
      }
    } catch (e) {
      // sound already cleaned
    }
  };

  // Toggle Mute
  const handleToggleMute = () => {
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    if (!nextMute) {
      // delayed trigger to play
      setTimeout(() => {
        startAudioSynth();
      }, 50);
    } else {
      cleanupAudio();
    }
  };

  // Update sound pitches interactively
  useEffect(() => {
    if (carrierOscRef.current && modOscRef.current && !isMuted) {
      carrierOscRef.current.frequency.setTargetAtTime(audioCarrier, audioCtxRef.current!.currentTime, 0.05);
      modOscRef.current.frequency.setTargetAtTime(audioModulator, audioCtxRef.current!.currentTime, 0.05);
    }
  }, [audioCarrier, audioModulator]);

  useEffect(() => {
    return () => cleanupAudio();
  }, []);

  // -------------------------
  // SOLVING ENGINES
  // -------------------------

  // 1. Caesar Shift Cipher solver helper
  const decryptCaesar = (encodedTextRaw: string, shift: number) => {
    // We assume incoming base64 encodes a rot13/shift phrase
    // Base64 decode then rotate back by 'shift'
    try {
      const decodedBase64 = atob(encodedTextRaw);
      return decodedBase64.toUpperCase().split('').map(char => {
        const code = char.charCodeAt(0);
        if (code >= 65 && code <= 90) {
          // rotate backward (reverse)
          let rotated = code - 65 - shift;
          while (rotated < 0) rotated += 26;
          return String.fromCharCode((rotated % 26) + 65);
        }
        return char;
      }).join('');
    } catch (e) {
      return "ENCRYPTION BLOCK ERROR";
    }
  };

  const handleCipherVerify = () => {
    if (!transmission.cipherKey) return;
    const cleanProposed = userHexText.trim().toUpperCase();
    const correctTranslation = transmission.decodedData?.trim().toUpperCase() || '';

    // If proposed shift match the correct caesar rotated phrase
    const currentRotPhrase = decryptCaesar(transmission.encodedData, cipherShift);

    if (cleanProposed === correctTranslation || currentRotPhrase === correctTranslation) {
      onSolve(transmission.id, correctTranslation);
      setSuccessMsg(`CIPHER BREAK SUCCESS: "${correctTranslation}" LOCKED`);
    } else {
      alert("WARNING: CIPHER CHECKSUM DISCREPANCY. THE ANOMALY CONTINUES SCRAMBLING.");
    }
  };

  // 2. Coordinate Vector locked
  const handleCoordinatePlotVerify = () => {
    if (!transmission.coordinates) return;
    const targetX = transmission.coordinates.x;
    const targetY = transmission.coordinates.y;

    // Give tolerance threshold (e.g. +/- 4 units)
    const distanceThreshold = 5;
    const dist = Math.sqrt(Math.pow(plotX - targetX, 2) + Math.pow(plotY - targetY, 2));

    if (dist <= distanceThreshold) {
      setIsPlotLocked(true);
      const solvedMsg = `COORDINATE COUPLING RECOLLECTED PIN: [Target: ${transmission.coordinates.targetName}]`;
      onSolve(transmission.id, solvedMsg);
      setSuccessMsg(`SECTOR RESOLVED: "${transmission.coordinates.targetName}" mapped in ${transmission.coordinates.constellation}`);
    } else {
      alert(`DIFFERENCE CRITICAL: Sector alignment delta standard error too high. Target unresolved.`);
    }
  };

  // 3. Audio Synthesizer Match solver
  const handleAudioTuneVerify = () => {
    if (!transmission.audioParams) return;
    const targetCarrier = transmission.audioParams.carrierFreq;
    const targetModulator = transmission.audioParams.modulatorFreq;

    // Check tolerances
    const carrierError = Math.abs(audioCarrier - targetCarrier);
    const modError = Math.abs(audioModulator - targetModulator);

    if (carrierError <= 10 && modError <= 1.5) {
      cleanupAudio();
      setIsMuted(true);
      onSolve(transmission.id, "HARMONIC ALIGNED AT " + targetCarrier + "HZ (LFO: " + targetModulator + "HZ)");
      setSuccessMsg(`CARRIER HARMONIC LOCKED: Audio transient filtered out cosmic envelope.`);
    } else {
      alert(`ALIGNMENT DEVIATION: Waveform amplitude phase mismatch. Keep balancing Carrier and Mod LFO.`);
    }
  };

  // 4. Alien Symbol Decoder solver
  const handleSymbolMatrixVerify = () => {
    if (!transmission.symbols) return;
    const correctMap = transmission.symbols.translationKey;
    
    // Check if every glyph map match
    let isAllMatch = true;
    Object.keys(correctMap).forEach((g) => {
      const userVal = (resolvedSymbols[g] || '').toUpperCase().trim();
      const correctVal = correctMap[g].toUpperCase().trim();
      if (userVal !== correctVal) {
        isAllMatch = false;
      }
    });

    if (isAllMatch) {
      const solution = transmission.decodedData || "SYMBOL STRUCTURES FULLY ALIGNED";
      onSolve(transmission.id, solution);
      setSuccessMsg(`MATRIX SYMMETRY RESTORED: "${solution}"`);
    } else {
      alert("ALiEN INDEX PARITY REJECTED: Symbology grid polarity checks do not match. Read instructions carefully.");
    }
  };

  return (
    <div className="id-decoder-panel bg-zinc-900/50 glow-border rounded-xl p-5 md:p-6 flex flex-col h-full bg-linear-to-b from-zinc-900/90 to-zinc-950/90">
      
      {/* Header Tag */}
      <div className="flex justify-between items-center pb-4 mb-4 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <div className="p-1 px-2 text-[10px] bg-red-950/50 border border-red-800 text-red-400 font-mono tracking-widest rounded uppercase">
            {transmission.difficulty} TASK
          </div>
          <p className="font-mono text-xs text-zinc-500 uppercase tracking-widest">
            NODE // {transmission.source}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${transmission.solved ? 'bg-cyan-500 shadow-[0_0_8px_#06b6d4]' : 'bg-amber-500 animate-pulse'}`} />
          <span className="font-mono text-[10px] text-zinc-400 capitalize">
            {transmission.solved ? 'Decoded & Stable' : 'Scrambled'}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-1">
        {/* Story Intro Context */}
        <div className="mb-5 bg-zinc-950/70 border border-zinc-800/80 p-3.5 rounded-lg">
          <p className="font-mono text-[9px] text-zinc-500 uppercase tracking-widest mb-1.5 flex items-center gap-1.5 ">
            <Eye className="w-3 h-3 text-cyan-500" /> CHRONO SIGNAL HISTORY:
          </p>
          <p className="font-mono text-xs text-zinc-300 leading-relaxed italic">
            &quot;{transmission.narrativeContext || 'A strange residual hum floating over telescope sensors.'}&quot;
          </p>
        </div>

        {/* Dynamic Puzzle Subsystems */}
        {successMsg ? (
          <div className="h-44 flex flex-col items-center justify-center text-center bg-cyan-950/20 glow-border rounded-xl p-4 animate-fade-in">
            <Shield className="w-10 h-10 text-cyan-400 mb-2.5 animate-bounce" />
            <h4 className="font-display font-medium text-cyan-300 text-sm tracking-wide uppercase mb-1">
              SIGNAL DECLASSIFIED
            </h4>
            <p className="font-mono text-[11px] text-zinc-300 max-w-sm">
              {successMsg}
            </p>
            <p className="font-mono text-[10px] text-zinc-500 mt-3 uppercase tracking-widest">
              State log forwarded to local intelligence blackboard.
            </p>
          </div>
        ) : (
          <>
            {/* 1. TEXT CIPHER PUZZLE PANEL */}
            {transmission.type === 'text' && (
              <div className="space-y-4">
                <div className="bg-zinc-950/80 p-3 rounded-lg border border-zinc-800/60 font-mono text-center">
                  <div className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">RAW ENCRYPTED HARMONIC</div>
                  <div className="text-sm font-bold text-amber-500 tracking-wider">
                    {transmission.encodedText || decryptCaesar("URYYB JBEYQ", 0)}
                  </div>
                </div>

                <div className="bg-zinc-950/40 p-4 rounded-lg border border-zinc-850 space-y-3.5">
                  <div className="flex justify-between items-center">
                    <label className="font-mono text-xs text-zinc-400 flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5 text-cyan-400" />
                      ROTATION TRANSFORMATION OFFSET
                    </label>
                    <span className="font-mono text-[11px] text-cyan-400 font-bold bg-cyan-950/30 px-1.5 py-0.5 rounded">
                      +{cipherShift} CHARS
                    </span>
                  </div>

                  <input
                    type="range"
                    min="0"
                    max="25"
                    value={cipherShift}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      setCipherShift(val);
                      onUpdateModifiers(val, 0);
                    }}
                    className="w-full accent-cyan-500 cursor-pointer h-1.5 bg-zinc-800 rounded-lg"
                  />

                  <div className="bg-zinc-950/90 p-3 rounded border border-zinc-800 font-mono">
                    <div className="text-[9px] text-zinc-500 uppercase tracking-widest mb-1">REAL-TIME DEMODULATED LOOKAHEAD</div>
                    <div className="text-xs text-cyan-300 tracking-wide font-semibold truncate">
                      {decryptCaesar(transmission.encodedData, cipherShift)}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="font-mono text-[10px] text-zinc-500">
                    IF TRANSLATION ALIGNS TO AN INTELLIGENT STATEMENT, LOCK THE TELEMETRY:
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={userHexText}
                      onChange={(e) => setUserHexText(e.target.value)}
                      placeholder="ENTER CRITICAL TRANSLATED SIGNAL PHRASE"
                      className="flex-1 bg-zinc-950 border border-zinc-800 text-zinc-200 font-mono text-xs p-2.5 rounded focus:outline-none focus:border-cyan-500 uppercase"
                    />
                    <button
                      onClick={handleCipherVerify}
                      className="bg-cyan-950/60 text-cyan-400 border border-cyan-800 px-4 rounded font-mono text-xs font-semibold hover:bg-cyan-500 hover:text-black transition"
                    >
                      LOCK
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 2. COORDINATES GRAPH PLOTTER PANEL */}
            {transmission.type === 'coordinates' && transmission.coordinates && (
              <div className="space-y-4">
                <div className="font-mono text-[11px] text-zinc-400 flex justify-between">
                  <span className="flex items-center gap-1"><Map className="w-3.5 h-3.5 text-teal-400" /> RADAR VECTOR LOCK CHART</span>
                  <span className="text-zinc-500 font-semibold uppercase">{transmission.coordinates.constellation} SECTOR</span>
                </div>

                <div className="relative aspect-square w-full max-w-xs mx-auto bg-zinc-950 rounded-xl overflow-hidden border border-zinc-800/80 flex items-center justify-center p-2">
                  {/* Grid Lines */}
                  <div className="absolute inset-0 bg-zinc-950 grid-bg opacity-40 pointer-events-none" />
                  <div className="absolute left-1/2 top-0 bottom-0 w-px bg-zinc-800/40 pointer-events-none" />
                  <div className="absolute top-1/2 left-0 right-0 h-px bg-zinc-800/40 pointer-events-none" />

                  {/* Target Zone Ring */}
                  <div 
                    className="absolute w-8 h-8 rounded-full border border-dashed border-teal-500/20 animate-spin-slow pointer-events-none flex items-center justify-center"
                    style={{
                      left: `calc(50% + ${transmission.coordinates.x * 0.45}% - 16px)`,
                      top: `calc(50% - ${transmission.coordinates.y * 0.45}% - 16px)`,
                    }}
                  >
                    <div className="w-1.5 h-1.5 bg-teal-500 rounded-full animate-ping" />
                  </div>

                  {/* Player Reticle Target (Plot Selector) */}
                  <div 
                    className="absolute w-6 h-6 flex items-center justify-center pointer-events-none"
                    style={{
                      left: `calc(50% + ${plotX * 0.45}% - 12px)`,
                      top: `calc(50% - ${plotY * 0.45}% - 12px)`,
                    }}
                  >
                    <div className="w-5 h-5 rounded-full border border-cyan-400 absolute animate-pulse" />
                    <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full" />
                  </div>

                  {/* Click/Drag overlay area to select plot */}
                  <div 
                    className="absolute inset-0 cursor-crosshair"
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const clickX = e.clientX - rect.left;
                      const clickY = e.clientY - rect.top;
                      const relativeX = Math.round(((clickX / rect.width) * 200) - 100);
                      const relativeY = Math.round(-(((clickY / rect.height) * 200) - 100)); // invert Y
                      setPlotX(relativeX);
                      setPlotY(relativeY);
                      onUpdateModifiers(relativeX, relativeY);
                    }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3.5 bg-zinc-950/70 p-3 rounded-lg border border-zinc-800/60 font-mono text-[11px]">
                  <div>
                    <span className="text-zinc-500">CORRECT SENSOR VECTOR:</span>
                    <p className="text-teal-400 font-bold font-mono">X: {transmission.coordinates.x} | Y: {transmission.coordinates.y}</p>
                  </div>
                  <div>
                    <span className="text-zinc-500">CURRENT SCOPE OFFSET:</span>
                    <p className="text-cyan-400 font-bold font-mono">X: {plotX} | Y: {plotY}</p>
                  </div>
                </div>

                <button
                  onClick={handleCoordinatePlotVerify}
                  className="w-full bg-teal-950/50 hover:bg-teal-500 text-teal-400 hover:text-black border border-teal-800 transition py-2.5 rounded font-mono text-xs uppercase tracking-widest font-semibold"
                >
                  INTERCEPT VECTOR ANGLE
                </button>
              </div>
            )}

            {/* 3. AUDIO TUNING PANEL */}
            {transmission.type === 'audio' && transmission.audioParams && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="font-mono text-xs text-zinc-400 flex items-center gap-1.5">
                    <Volume2 className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
                    HARMONIC FREQUENCY RESONATOR
                  </span>
                  <button
                    onClick={handleToggleMute}
                    className={`flex items-center gap-1 font-mono text-[9px] px-2 py-1 rounded transition ${isMuted ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700' : 'bg-blue-900/60 border border-blue-600 text-blue-200'}`}
                  >
                    {isMuted ? (
                      <><VolumeX className="w-3 h-3" /> AUDIO UNMUTED</>
                    ) : (
                      <><Volume2 className="w-3 h-3 animate-ping" /> FEED OUT BROADCAST</>
                    )}
                  </button>
                </div>

                <div className="space-y-4 bg-zinc-950/60 p-4 rounded-xl border border-zinc-850">
                  {/* Slider 1: Carrier Frequency */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between font-mono text-[10px]">
                      <span className="text-zinc-400">CARRIER CONSTANT (SINE)</span>
                      <span className="text-blue-400 font-bold">{audioCarrier} Hz</span>
                    </div>
                    <input
                      type="range"
                      min="200"
                      max="600"
                      step="1"
                      value={audioCarrier}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        setAudioCarrier(val);
                        onUpdateModifiers(val, audioModulator);
                      }}
                      className="w-full accent-blue-500 cursor-pointer h-1.5 bg-zinc-800 rounded-lg"
                    />
                  </div>

                  {/* Slider 2: Modulator Frequency */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between font-mono text-[10px]">
                      <span className="text-zinc-400">LOW FREQUENCY OSCILLATOR (LFO)</span>
                      <span className="text-blue-400 font-bold">{audioModulator} Hz</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="15"
                      step="0.1"
                      value={audioModulator}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setAudioModulator(val);
                        onUpdateModifiers(audioCarrier, val);
                      }}
                      className="w-full accent-blue-500 cursor-pointer h-1.5 bg-zinc-800 rounded-lg"
                    />
                  </div>
                </div>

                <div className="p-3 bg-zinc-950/90 rounded border border-zinc-800/80 font-mono text-[10px] space-y-2 text-zinc-500 leading-normal">
                  <span className="text-zinc-400 font-bold">TUNER REPORT CHECK:</span>
                  <p>Slowly slide Carrier Pitch and LFO frequency rates. Standard parameters for typical hydrogen anomalies of cosmic pulses align around <span className="text-blue-400 font-bold">{transmission.audioParams.carrierFreq}Hz</span> and modulation rates near <span className="text-blue-400 font-bold">{transmission.audioParams.modulatorFreq}Hz</span>.</p>
                </div>

                <button
                  onClick={handleAudioTuneVerify}
                  className="w-full bg-blue-950/50 hover:bg-blue-500 text-blue-400 hover:text-black border border-blue-800 transition py-2.5 rounded font-mono text-xs uppercase tracking-widest font-semibold"
                >
                  DE-MODULATE CARRIER HARMONICS
                </button>
              </div>
            )}

            {/* 4. ALIEN SYMBOL DECODER PANEL */}
            {transmission.type === 'symbol' && transmission.symbols && (
              <div className="space-y-4">
                <div className="font-mono text-xs text-zinc-400 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-pink-400 animate-pulse" />
                  ALIEN Runes KEY REFERENCE CHART
                </div>

                <div className="bg-zinc-950/70 border border-zinc-800/60 p-4 rounded-xl flex flex-col items-center">
                  {/* Grid layout visualizing the matrix pattern */}
                  <div className="grid grid-cols-4 gap-2 mb-4">
                    {transmission.symbols.matrix.flat().map((symbol, idx) => (
                      <div 
                        key={idx} 
                        className="w-10 h-10 bg-zinc-900 border border-zinc-800 text-pink-400 font-mono flex items-center justify-center rounded font-bold text-sm select-none"
                      >
                        {symbol}
                      </div>
                    ))}
                  </div>

                  <p className="font-mono text-[9px] text-zinc-500 text-center uppercase tracking-widest mb-3 leading-relaxed">
                    INTEREST RATIO FOUND: EACH ROW PATTERN MAPS TO HUMAN SYLLABLES.<br />
                    SWAP OR GUESS CHARACTERS BELOW:
                  </p>

                  {/* Glyph swap dictionary editors */}
                  <div className="grid grid-cols-2 gap-3.5 w-full max-w-sm">
                    {transmission.symbols.glyphSymbols.map((glyph, idx) => (
                      <div key={idx} className="flex gap-2 items-center bg-zinc-950 p-2 rounded border border-zinc-850">
                        <span className="font-mono text-pink-400 font-bold text-xs bg-pink-950/20 px-2 py-1.5 rounded border border-pink-900/30">
                          {glyph}
                        </span>
                        <input
                          type="text"
                          maxLength={1}
                          placeholder="?"
                          value={resolvedSymbols[glyph] || ''}
                          onChange={(e) => {
                            const val = e.target.value.toUpperCase();
                            setResolvedSymbols({
                              ...resolvedSymbols,
                              [glyph]: val
                            });
                          }}
                          className="w-full bg-zinc-900 border border-zinc-800 text-zinc-100 font-mono text-center outline-none focus:border-pink-500 rounded text-xs p-1"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-3 bg-zinc-950/90 rounded border border-zinc-850 font-mono text-[10px] text-zinc-400 leading-normal">
                  <span className="text-zinc-500">HISTORIC CLUE INDEX:</span>
                  <p>Observatories state the primary vector maps to the English characters: <span className="text-pink-400 font-bold">{Object.values(transmission.symbols.translationKey).join(", ")}</span> (maybe scrambled).</p>
                </div>

                <button
                  onClick={handleSymbolMatrixVerify}
                  className="w-full bg-pink-950/50 hover:bg-pink-500 text-pink-400 hover:text-black border border-pink-800 transition py-2.5 rounded font-mono text-xs uppercase tracking-widest font-semibold"
                >
                  DECODE Rune SYSTEM ALIGNMENT
                </button>
              </div>
            )}
          </>
        )}
      </div>

    </div>
  );
}
