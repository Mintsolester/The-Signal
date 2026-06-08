import React, { useState, useEffect } from 'react';
import { Send, Users, Radio, HelpCircle, CheckCircle, Terminal, AlertTriangle } from 'lucide-react';
import { CommunityLog } from '../types';

interface CommunityBoardProps {
  onNewTransmissionTriggered: () => void;
  solvedCount: number;
}

export default function CommunityBoard({
  onNewTransmissionTriggered,
  solvedCount,
}: CommunityBoardProps) {
  const [logs, setLogs] = useState<CommunityLog[]>([]);
  const [username, setUsername] = useState('');
  const [logType, setLogType] = useState<'theory' | 'decode_report'>('theory');
  const [newLogContent, setNewLogContent] = useState('');

  // Probe Broadcast States
  const [probeInput, setProbeInput] = useState('');
  const [isProbing, setIsProbing] = useState(false);
  const [probeResult, setProbeResult] = useState<{
    status: string;
    payload: string;
    newSignalSource?: string;
  } | null>(null);

  // Load Community Logs on Mount
  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/community-logs');
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch (e) {
      console.warn("Failed to fetch community logs", e);
    }
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 8000); // Poll logs every 8 seconds
    return () => clearInterval(interval);
  }, []);

  const handlePostLogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !newLogContent.trim()) return;

    try {
      const res = await fetch('/api/community-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          type: logType,
          content: newLogContent.trim(),
        }),
      });

      if (res.ok) {
        setNewLogContent('');
        fetchLogs();
      }
    } catch (err) {
      console.warn("Posting log failed:", err);
    }
  };

  // Broadcast out deep space probe to prompt reactive Gemini adaptions!
  const handleBroadcastProbe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!probeInput.trim()) return;

    setIsProbing(true);
    setProbeResult(null);

    try {
      const res = await fetch('/api/probe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: probeInput.trim(),
          localTelemetry: { solvedCount }
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setProbeResult({
          status: data.status,
          payload: data.payload,
          newSignalSource: data.newTransmission?.source
        });
        setProbeInput('');

        // Notify parent framework that active signal files updated
        if (data.createsNewTransmission) {
          onNewTransmissionTriggered();
        }
      }
    } catch (err) {
      setProbeResult({
        status: 'VOIDSIG',
        payload: 'ERROR: Subspace transmitter carrier failed. Deep sky void background noise returned. Check terminal secrets configuration.'
      });
    } finally {
      setIsProbing(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      
      {/* LEFT: Subspace probe broadcasting console */}
      <div className="lg:col-span-5 bg-zinc-900/50 glow-border rounded-xl p-5 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2 mb-3.5">
            <Radio className="w-5 h-5 text-amber-500 animate-pulse" />
            <h3 className="font-display font-semibold text-zinc-100 text-sm tracking-widest uppercase">
              DEEP WAVE PROBE TRANSMITTER
            </h3>
          </div>
          
          <p className="font-mono text-[11px] text-zinc-400 leading-relaxed mb-4">
            Broadcast responsive sensor arrays or custom energy waveforms out to telescope grids. The unknown intelligent signal adapts and generates real-time telemetry backloads.
          </p>

          <form onSubmit={handleBroadcastProbe} className="space-y-3">
            <div className="relative">
              <textarea
                value={probeInput}
                onChange={(e) => setProbeInput(e.target.value)}
                placeholder="E.g., Speak to the entity, request spatial coordinate vectors, align radar beam values, etc."
                disabled={isProbing}
                rows={3}
                className="w-full bg-zinc-950 border border-zinc-800 focus:border-amber-500 text-amber-400 placeholder-zinc-600 font-mono text-xs p-3 rounded-lg focus:outline-none resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={isProbing || !probeInput.trim()}
              className="w-full bg-amber-950/40 border border-amber-800/80 hover:bg-amber-500 hover:text-black transition-all py-2 rounded-lg font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isProbing ? 'ENGAGING MICROWAVE DISH BEAMS...' : 'BROADCAST VECTOR PROBE'}
            </button>
          </form>
        </div>

        {/* Live probe sensor feedback */}
        {probeResult && (
          <div className="mt-4 bg-zinc-950/80 p-3.5 rounded-lg border border-zinc-800">
            <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-zinc-900 font-mono text-[10px]">
              <span className="text-zinc-500 uppercase">PROBE SECTOR REPORT:</span>
              <span className={`font-bold ${probeResult.status === 'SUCCESS' ? 'text-green-400' : 'text-zinc-500'}`}>
                {probeResult.status}
              </span>
            </div>
            
            <p className="font-mono text-xs text-amber-300 italic leading-relaxed">
              &quot;{probeResult.payload}&quot;
            </p>

            {probeResult.newSignalSource && (
              <div className="mt-2 text-[10px] font-mono text-cyan-400 bg-cyan-950/20 border border-cyan-900 p-1 px-2 rounded animate-pulse">
                ✦ ALIEN CARRIER MUTATION TRACED: New transmission node received from [{probeResult.newSignalSource}]. See SCANNER feed!
              </div>
            )}
          </div>
        )}
      </div>

      {/* RIGHT: Community log reports board */}
      <div className="lg:col-span-7 bg-zinc-900/50 glow-border rounded-xl p-5 flex flex-col">
        <div className="flex justify-between items-center pb-3 border-b border-zinc-800 mb-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-cyan-400" />
            <h3 className="font-display font-semibold text-zinc-100 text-sm tracking-widest uppercase">
              COOPERATIVE INTELLIGENCE LOG
            </h3>
          </div>
          <span className="font-mono text-[9px] text-zinc-500 uppercase bg-zinc-950 px-2 py-0.5 rounded border border-zinc-850">
            STATION ACTIVE // COOP_MEM_SYNCED
          </span>
        </div>

        {/* Input Logger Form */}
        <form onSubmit={handlePostLogSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-3 mb-5 bg-zinc-950/40 p-3.5 rounded-lg border border-zinc-850">
          <div className="md:col-span-4">
            <input
              type="text"
              placeholder="EXPLORER CALLSIGN"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-850 text-zinc-200 font-mono text-[11px] p-2 rounded focus:outline-none focus:border-cyan-500 uppercase"
            />
          </div>
          <div className="md:col-span-4">
            <select
              value={logType}
              onChange={(e: any) => setLogType(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-850 text-zinc-300 font-mono text-[11px] p-2 rounded focus:outline-none focus:border-cyan-500"
            >
              <option value="theory">THEORY DECORRELATION</option>
              <option value="decode_report">FIELD TRACE SUCCESS</option>
            </select>
          </div>
          <div className="md:col-span-12 flex gap-2">
            <input
              type="text"
              placeholder="INPUT OBSERVATION NOTES, CIPHER KEYS, COORDINATE PLOTS..."
              value={newLogContent}
              onChange={(e) => setNewLogContent(e.target.value)}
              className="flex-grow bg-zinc-950 border border-zinc-850 text-zinc-200 font-mono text-[11px] p-2 rounded focus:outline-none focus:border-cyan-500"
            />
            <button
              type="submit"
              className="bg-cyan-950 border border-cyan-800 text-cyan-400 hover:bg-cyan-500 hover:text-black transition p-2 px-3.5 rounded font-mono text-xs font-semibold"
            >
              PUBLISH
            </button>
          </div>
        </form>

        {/* Logs Feed Scroller */}
        <div className="flex-1 max-h-56 overflow-y-auto space-y-3 pr-1">
          {logs.length === 0 ? (
            <div className="text-center font-mono text-zinc-600 text-[10px] py-8">
              NO ANOMALIES LOGGED YET BY STATION ANALYSTS.
            </div>
          ) : (
            logs.map((log) => (
              <div 
                key={log.id} 
                className={`p-3 rounded-lg border text-[11px] font-mono leading-relaxed transition-all ${
                  log.type === 'decode_report' 
                    ? 'bg-emerald-950/10 border-emerald-900/40 text-emerald-300' 
                    : 'bg-zinc-950/50 border-zinc-800 text-zinc-300'
                }`}
              >
                <div className="flex justify-between items-center mb-1 text-[9px] text-zinc-500 uppercase">
                  <div className="flex items-center gap-1.5 font-bold">
                    <span className={`w-1 h-1 rounded-full ${log.type === 'decode_report' ? 'bg-emerald-500' : 'bg-cyan-500'}`} />
                    {log.username}
                  </div>
                  <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                </div>
                <p>{log.content}</p>
                {log.type === 'decode_report' && (
                  <div className="mt-1 flex items-center gap-1 text-[8px] text-emerald-400 font-bold uppercase tracking-widest bg-emerald-950/30 w-fit p-0.5 px-1.5 rounded">
                    <CheckCircle className="w-2.5 h-2.5" /> telemetry unlocked & verified
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
}
