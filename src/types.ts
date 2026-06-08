export interface Transmission {
  id: string;
  type: 'text' | 'coordinates' | 'audio' | 'symbol';
  timestamp: string;
  source: string; // e.g., "ASTRO-CENTAURI", "VLF-309", "PULSAR-7"
  encodedData: string; // The encrypted or encrypted-looking data
  encodedText?: string; // Optional raw cypher characters for Caesar
  decodedData: string | null; // What reveals when solved
  solved: boolean;
  difficulty: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  
  // Type-specific puzzle properties
  cipherKey?: number; // e.g., shift amount for Caesar cipher, or index
  coordinates?: {
    x: number; // -100 to 100
    y: number; // -100 to 100
    z: number; // -100 to 100
    targetName: string;
    constellation: string;
  };
  audioParams?: {
    carrierFreq: number;    // Hz targets (amplitude/frequency)
    modulatorFreq: number;  // LFO frequency
    harmonicRatio: number;  // Timbre alignment
    pulseWidth: number;     // Waveform duty cycle
  };
  symbols?: {
    matrix: string[][]; // 4x4 coordinate symbol grid
    glyphSymbols: string[]; // Glyphs to align
    translationKey: { [key: string]: string };
  };
  
  narrativeContext?: string; // Prompt storage for Gemini to continue the state
}

export interface CommunityLog {
  id: string;
  username: string;
  timestamp: string;
  transmissionId?: string;
  type: 'theory' | 'decode_report' | 'sensor_probe';
  content: string;
  coordinatesMatched?: string;
}

export interface ProbeResult {
  status: 'SUCCESS' | 'VOIDSIG' | 'INTERCEPT';
  payload: string;
}
