import React, { useState, useEffect } from 'react';
import { 
  Radio, 
  Terminal as TerminalIcon, 
  HelpCircle, 
  Compass, 
  Thermometer, 
  Network, 
  Layers, 
  RotateCw, 
  FolderLock, 
  Unlock, 
  CheckCircle2, 
  Info,
  Waves
} from 'lucide-react';
import { Transmission } from './types';
import SignalFrequency from './components/SignalFrequency';
import DecoderWorkspace from './components/DecoderWorkspace';
import CommunityBoard from './components/CommunityBoard';

export default function App() {
  const [transmissions, setTransmissions] = useState<Transmission[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  
  // Real-time canvas modulation states
  const [modifier1, setModifier1] = useState(0); 
  const [modifier2, setModifier2] = useState(0);

  // Live telemetry mock stats
  const [antennaTemp, setAntennaTemp] = useState(14.8);
  const [snrRatio, setSnrRatio] = useState(4.2);
  const [stationPing, setStationPing] = useState(132);

  // Fetch Signals
  const fetchTransmissions = async (autoSelectFirst = false) => {
    try {
      const res = await fetch('/api/transmissions');
      if (res.ok) {
        const data: Transmission[] = await res.json();
        setTransmissions(data);
        
        // Auto-select first if none is selected
        if (data.length > 0) {
          if (autoSelectFirst || !selectedId) {
            setSelectedId(data[0].id);
          } else {
            // Check if current selection was solved
            const currentSelected = data.find(t => t.id === selectedId);
            if (currentSelected && currentSelected.solved) {
              // state refresh matches solver success
            }
          }
        }
      }
    } catch (e) {
      console.warn("Failed to load telescope transmission streams.", e);
    }
  };

  useEffect(() => {
    fetchTransmissions(true);
    
    // Slight random flicker in telemetry stats to make it feel ALIVE
    const telemetryInterval = setInterval(() => {
      setAntennaTemp(prev => Math.max(12.1, Math.min(18.9, +(prev + (Math.random() - 0.5) * 0.4).toFixed(1))));
      setSnrRatio(prev => Math.max(2.1, Math.min(7.9, +(prev + (Math.random() - 0.5) * 0.3).toFixed(2))));
      setStationPing(prev => Math.max(110, Math.min(160, Math.floor(prev + (Math.random() - 0.5) * 10))));
    }, 4000);

    return () => clearInterval(telemetryInterval);
  }, []);

  const handleSolveSignal = async (id: string, solutionData: string) => {
    try {
      const res = await fetch('/api/transmissions/solve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, decodedText: solutionData })
      });
      if (res.ok) {
        // Refresh signal lists
        fetchTransmissions();
      }
    } catch (e) {
      console.warn("Transmitting decode report to server state failed.", e);
    }
  };

  const handleNewTransmissionCreated = () => {
    // Re-fetch transmissions and auto-select the newly added first element
    fetchTransmissions(true);
  };

  const activeTransmission = transmissions.find(t => t.id === selectedId) || null;
  const decodedCount = transmissions.filter(t => t.solved).length;

  return (
    <div className="min-h-screen bg-[#030712] text-zinc-100 scanlines flex flex-col font-sans select-none pb-12">
      
      {/* 1. TOP NAVIGATION & STATUS STRIP (HUD-STYLE) */}
      <header className="border-b border-zinc-800 bg-[#070a13]/90 sticky top-0 z-40 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 py-3.5 flex flex-col md:flex-row justify-between items-center gap-4">
          
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-950/40 border border-cyan-800 rounded-lg text-cyan-400 animate-pulse">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-display font-black text-sm tracking-[0.25em] text-zinc-100 uppercase flex items-center gap-2">
                THE SIGNAL <span className="text-cyan-400">PROJECT DEEPEYE</span>
              </h1>
              <p className="font-mono text-[9px] text-zinc-500 uppercase tracking-widest">
                Stellar Frequency Spectrogram & Matrix Decoder System
              </p>
            </div>
          </div>

          {/* TELEMETRY READOUTS */}
          <div className="flex items-center flex-wrap gap-4 md:gap-6 font-mono text-[10px] text-zinc-400">
            <div className="flex items-center gap-1.5 border-r border-zinc-850 pr-4">
              <Thermometer className="w-3.5 h-3.5 text-orange-400" />
              <span>ANT_TEMP:</span>
              <span className="text-white font-bold">{antennaTemp}°K</span>
            </div>
            <div className="flex items-center gap-1.5 border-r border-zinc-850 pr-4">
              <Waves className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
              <span>C_SNR:</span>
              <span className="text-white font-bold">{snrRatio} dB</span>
            </div>
            <div className="flex items-center gap-1.5 border-r border-zinc-850 pr-4">
              <Compass className="w-3.5 h-3.5 text-indigo-400" />
              <span>DEC_ANGLE:</span>
              <span className="text-white font-bold">144.02° ST</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Network className="w-3.5 h-3.5 text-green-400" />
              <span>PING:</span>
              <span className="text-white font-bold">{stationPing}ms</span>
            </div>
          </div>

        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 w-full mt-6 space-y-6">
        
        {/* 2. CORE GAMEPLAY GRID (Scanner list left, Decoder Workspace right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          
          {/* LEFT COLUMN: TRANSMISSIONS SEARCH INDEX RAIL (SIZE 4/12) */}
          <div className="lg:col-span-4 bg-zinc-900/50 glow-border rounded-xl p-4 flex flex-col justify-between min-h-[500px]">
            <div>
              <div className="flex justify-between items-center pb-3 border-b border-zinc-850 mb-3.5">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-cyan-400" />
                  <h2 className="font-display font-bold text-xs tracking-wider uppercase text-zinc-100">
                    SCANNER FEED DIRECTORY
                  </h2>
                </div>
                <div className="font-mono text-[10px] font-bold text-zinc-400 bg-zinc-950 border border-zinc-800 px-2 py-0.5 rounded flex items-center gap-1.5">
                  LOCKS: <span className="text-cyan-400">{decodedCount}</span> / <span className="text-zinc-600">{transmissions.length}</span>
                </div>
              </div>

              {/* Signals scroll container */}
              <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                {transmissions.map((t) => {
                  const isSelected = t.id === selectedId;
                  return (
                    <div 
                      key={t.id}
                      onClick={() => {
                        setSelectedId(t.id);
                        setModifier1(0);
                        setModifier2(0);
                      }}
                      className={`group p-3 rounded-lg border font-mono text-[11px] leading-relaxed transition-all cursor-pointer flex justify-between items-start ${
                        isSelected 
                          ? 'bg-cyan-950/20 border-cyan-800 shadow-[0_0_10px_rgba(6,182,212,0.06)]' 
                          : 'bg-zinc-950/60 border-zinc-850 hover:bg-zinc-900/60 hover:border-zinc-800'
                      }`}
                    >
                      <div className="space-y-1 w-3/4">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${t.solved ? 'bg-cyan-400' : 'bg-amber-500 animate-ping'}`} />
                          <span className="font-bold text-zinc-200 uppercase tracking-tight group-hover:text-cyan-400 transition-colors">
                            {t.source}
                          </span>
                        </div>
                        
                        <div className="text-[10px] text-zinc-500 uppercase flex gap-2">
                          <span>TYPE: {t.type}</span>
                          <span>|</span>
                          <span>DIFF: {t.difficulty}</span>
                        </div>

                        <p className="text-[9px] text-zinc-400 truncate opacity-80 italic pr-3">
                          {t.solved ? `✔ DECODED: ${t.decodedData}` : `✦ ENCODED: ${t.encodedData}`}
                        </p>
                      </div>

                      <div className="flex flex-col items-end justify-between h-full space-y-2">
                        <span className="text-[9px] text-zinc-600">
                          {new Date(t.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>
                        {t.solved ? (
                          <div className="text-cyan-400 flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider bg-cyan-950/40 p-0.5 px-1.5 rounded border border-cyan-900/40">
                            <Unlock className="w-2.5 h-2.5" /> SECURE
                          </div>
                        ) : (
                          <div className="text-amber-400 flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider bg-amber-950/20 p-0.5 px-1.5 rounded border border-amber-900/40 animate-pulse">
                            <RotateCw className="w-2.5 h-2.5 animate-spin-slow" /> SYNCING
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick Operational Information Section */}
            <div className="mt-4 pt-3.5 border-t border-zinc-850 font-mono text-[10px] text-zinc-500 space-y-1.5 leading-relaxed bg-[#060911]/45 p-3 rounded-lg border border-zinc-850">
              <span className="text-zinc-400 font-bold flex items-center gap-1 uppercase">
                <Info className="w-3.5 h-3.5 text-cyan-400" /> SYSTEM MANUAL:
              </span>
              <p>Each incoming node contains cosmic radio waves or symbol matrixes. Synchronize coordinate reticles, balance sound modulators, or spin ROT cipher wheels on the workspace to lock the carrier frequency!</p>
            </div>
          </div>

          {/* RIGHT COLUMN: RECTIFYING STREAM & ACTIVE DECODER DESK (SIZE 8/12) */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            
            {/* Live Antenna Signal Stream Panel */}
            <SignalFrequency 
              type={activeTransmission?.type || 'all'}
              difficulty={activeTransmission?.difficulty || 'LOW'}
              solved={activeTransmission?.solved || false}
              modifier1={modifier1}
              modifier2={modifier2}
            />

            {/* The Decoder Solver desk */}
            <DecoderWorkspace
              transmission={activeTransmission}
              onSolve={handleSolveSignal}
              onUpdateModifiers={(m1, m2) => {
                setModifier1(m1);
                setModifier2(m2);
              }}
            />

          </div>

        </div>

        {/* 3. COOPERATIVE BOARD & OUTBOX SUB-SPACE TRANSMITTER */}
        <section className="bg-zinc-950/50 rounded-xl space-y-4">
          <CommunityBoard 
            onNewTransmissionTriggered={handleNewTransmissionCreated}
            solvedCount={decodedCount}
          />
        </section>

      </main>

      {/* Decorative Outer Footing */}
      <footer className="mt-12 text-center font-mono text-[9px] text-zinc-600 uppercase tracking-widest max-w-7xl mx-auto w-full px-4 border-t border-zinc-900 pt-6">
        TRANSMISSION COHERENCY CHECK SUCCESS // STATION_ALT_OUTER_HORIZON_99X // SYSTEM ONLINE
      </footer>

    </div>
  );
}
