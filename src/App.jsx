import React, { useState, useEffect, useRef, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  signInWithCustomToken, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  onSnapshot, 
  updateDoc 
} from 'firebase/firestore';
import { 
  Play, Pause, SkipForward, RotateCcw, Monitor, 
  Smartphone, Zap, AlertTriangle, Crosshair, Users, Volume2, Menu
} from 'lucide-react';

// --- CUSTOM CSS FOR CINEMATIC EFFECTS ---
const customStyles = `
  @keyframes shake {
    0%, 100% { transform: translateX(0) translateY(0); }
    20% { transform: translateX(-5px) translateY(5px); }
    40% { transform: translateX(5px) translateY(-5px); }
    60% { transform: translateX(-5px) translateY(2px); }
    80% { transform: translateX(5px) translateY(-2px); }
  }
  .animate-shake {
    animation: shake 0.4s cubic-bezier(.36,.07,.19,.97) both;
  }
  
  @keyframes pulse-neon {
    0%, 100% { box-shadow: 0 0 10px #fff, 0 0 20px #fff, 0 0 30px var(--neon-color), 0 0 40px var(--neon-color); }
    50% { box-shadow: 0 0 5px #fff, 0 0 10px #fff, 0 0 15px var(--neon-color), 0 0 20px var(--neon-color); }
  }
  .overdrive {
    --neon-color: #3b82f6;
    animation: pulse-neon 1.5s ease-in-out infinite alternate;
  }
  
  @keyframes sparks {
    0% { background-position: 0 0; opacity: 0; }
    50% { opacity: 1; }
    100% { background-position: 100% 100%; opacity: 0; }
  }
  .sparks-overlay {
    background-image: radial-gradient(circle, #fbbf24 10%, transparent 20%), radial-gradient(circle, #f87171 10%, transparent 20%);
    background-size: 20px 20px;
    background-position: 0 0, 10px 10px;
    animation: sparks 0.5s linear infinite;
  }

  @keyframes introTextFade {
    0% { opacity: 0; transform: scale(0.9) translateY(20px); filter: blur(10px); }
    20% { opacity: 1; transform: scale(1) translateY(0); filter: blur(0px); }
    80% { opacity: 1; transform: scale(1) translateY(0); filter: blur(0px); }
    100% { opacity: 0; transform: scale(1.1) translateY(-20px); filter: blur(10px); }
  }
  .animate-intro-text {
    animation: introTextFade 2.5s cubic-bezier(0.2, 0.8, 0.2, 1) both;
  }
  
  .glass-panel {
    background: linear-gradient(145deg, rgba(20,20,25,0.9), rgba(5,5,10,0.95));
    backdrop-filter: blur(16px);
    border: 1px solid rgba(255,255,255,0.08);
    box-shadow: 0 20px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.1);
  }

  .text-glow {
    text-shadow: 0 0 20px currentColor, 0 0 40px currentColor;
  }
`;

// --- AUDIO SYNTHESIZER ---
class AudioFX {
  constructor() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
  }
  resume() { if (this.ctx.state === 'suspended') this.ctx.resume(); }

  playImpact() {
    this.resume();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(10, this.ctx.currentTime + 0.4);
    gain.gain.setValueAtTime(1, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.4);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.4);
  }

  playSuccess() {
    this.resume();
    const freqs = [523.25, 659.25, 783.99, 1046.50]; // C E G C
    freqs.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, this.ctx.currentTime + i * 0.1);
      gain.gain.linearRampToValueAtTime(0.3, this.ctx.currentTime + i * 0.1 + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + i * 0.1 + 0.5);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(this.ctx.currentTime + i * 0.1);
      osc.stop(this.ctx.currentTime + i * 0.1 + 0.5);
    });
  }

  playPowerDown() {
    this.resume();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(400, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, this.ctx.currentTime + 1);
    gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 1);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 1);
  }

  playAlarm() {
    this.resume();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(600, this.ctx.currentTime);
    osc.frequency.setValueAtTime(800, this.ctx.currentTime + 0.2);
    osc.frequency.setValueAtTime(600, this.ctx.currentTime + 0.4);
    osc.frequency.setValueAtTime(800, this.ctx.currentTime + 0.6);
    gain.gain.value = 0.1;
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.8);
  }
}

let fx = null;

// --- GAME BLUEPRINT / PLAYBOOK ---
const PLAYBOOK = [
  { id: 0, title: "Lobby / Setup", bg: "from-gray-900 to-black", text: "text-gray-400", time: 0, phases: ["Standby"] },
  { 
    id: 1, title: "Mission Silent", bg: "from-blue-950 to-slate-900", text: "text-blue-400", time: 180, 
    phases: ["Execution"],
    rules: "Non-verbal coordination.", actions: [{ label: "Talked", p: 0, s: -3 }, { label: "Completed", p: 10, s: 10 }]
  },
  { 
    id: 2, title: "Problem Storm", bg: "from-cyan-950 to-slate-900", text: "text-cyan-300", time: 180, 
    phases: ["Discussion (2m)", "Presentation (1m)"], phaseTimes: [120, 60],
    rules: "Survive a scenario.", actions: [{ label: "Interrupt", p: 0, s: -5 }, { label: "Collab Build", p: 10, s: 10 }]
  },
  { 
    id: 3, title: "The Minefield", bg: "from-orange-950 to-red-950", text: "text-orange-400", time: 240, 
    phases: ["Execution"],
    rules: "Blindfolded guidance.", actions: [{ label: "Hit Mine", p: -10, s: -5 }, { label: "Crossed", p: 20, s: 20 }]
  },
  { 
    id: 4, title: "The Blind Architect", bg: "from-green-950 to-emerald-950", text: "text-green-400", time: 240, 
    phases: ["Architect Build (1m)", "Builder Replication (3m)"], phaseTimes: [60, 180],
    rules: "Verbal building.", actions: [{ label: "Builder Spoke", p: 0, s: -5 }, { label: "Perfect Match", p: 20, s: 30 }]
  },
  { 
    id: 5, title: "The Pressure Hold", bg: "from-red-950 to-rose-950", text: "text-red-500", time: 360, 
    phases: ["Endurance"],
    rules: "Puzzle + Physical Pain.", actions: [{ label: "Drop Pose", p: -20, s: 0 }, { label: "Solved", p: 30, s: 30 }]
  },
  { 
    id: 6, title: "The Saboteur", bg: "from-purple-950 to-indigo-950", text: "text-purple-400", time: 150, 
    phases: ["Task (2m)", "Accusation (30s)"], phaseTimes: [120, 30],
    rules: "Hidden traitor.", actions: [{ label: "Wrong Accuse", p: -10, s: -10 }, { label: "Found", p: 20, s: 20 }]
  },
  { 
    id: 7, title: "FINAL SHOWDOWN", bg: "from-yellow-950 to-black", text: "text-yellow-400", time: 420, 
    phases: ["Sudden Death"],
    rules: "Top 2 Teams Only.", actions: [{ label: "Massive Hit", p: -20, s: -10 }, { label: "EPIC WIN", p: 50, s: 100 }]
  },
];

const INITIAL_TEAMS = [
  { id: 't1', name: "Team Alpha", power: 50, score: 0 },
  { id: 't2', name: "Team Bravo", power: 50, score: 0 },
  { id: 't3', name: "Team Charlie", power: 50, score: 0 },
  { id: 't4', name: "Team Delta", power: 50, score: 0 },
];

const INITIAL_STATE = {
  teams: INITIAL_TEAMS,
  round: 0,
  phaseIdx: 0,
  isFrozen: true,
  endTime: 0,
  pausedTime: 0, // Time left when paused
  lastEffect: null, // { id: str, teamId: str, type: 'damage'|'success'|'freeze' }
};

// --- FIREBASE SETUP ---
const firebaseConfig = {
  apiKey: "AIzaSyB84UjJrcR7CE0OhhyWhFJzgrNwzglm04M",
  authDomain: "fordatabase-2c541.firebaseapp.com",
  databaseURL: "https://fordatabase-2c541-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "fordatabase-2c541",
  storageBucket: "fordatabase-2c541.firebasestorage.app",
  messagingSenderId: "624817857038",
  appId: "1:624817857038:web:aab90c1a714f0f9863525f"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'master-game-sys';

// --- MAIN APP COMPONENT ---
export default function App() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null); // 'admin' | 'display'
  const [gameState, setGameState] = useState(INITIAL_STATE);
  const [connected, setConnected] = useState(false);

  // Init Firebase Auth
  useEffect(() => {
    if (!auth) return;
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          try {
            await signInWithCustomToken(auth, __initial_auth_token);
          } catch (tokenError) {
            console.warn("Custom token bypassed for external Firebase. Falling back to Anonymous auth...");
            await signInAnonymously(auth);
          }
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth error: Please ensure Anonymous Sign-in is enabled in your Firebase Console!", err);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // Listen to Game State
  useEffect(() => {
    if (!user || !db) return;
    const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'games', 'master');
    
    const unsubscribe = onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        setGameState(snap.data());
        setConnected(true);
      } else if (role === 'admin') {
        // Initialize if admin and not exists
        setDoc(docRef, INITIAL_STATE);
      }
    }, (err) => console.error("Snapshot error:", err));

    return () => unsubscribe();
  }, [user, role]);

  const updateServerState = async (updates) => {
    if (!db || !connected) return;
    const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'games', 'master');
    await updateDoc(docRef, updates);
  };

  if (!user || !db) {
    return <div className="min-h-screen bg-black text-white flex items-center justify-center font-mono">INITIALIZING SYSTEM CACHE...</div>;
  }

  if (!role) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center font-sans relative overflow-hidden">
        {/* Deep background glow effects */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-[#050505] to-[#050505]"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none"></div>

        <style>{customStyles}</style>
        
        <div className="relative z-10 flex flex-col items-center">
          <div className="flex items-center justify-center mb-6">
            <Zap className="w-16 h-16 text-blue-500 drop-shadow-[0_0_20px_rgba(59,130,246,0.6)] animate-pulse" />
          </div>
          <h1 className="text-5xl md:text-7xl font-black mb-3 tracking-[0.3em] text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-500 drop-shadow-2xl text-center">
            SYSTEM NEXUS
          </h1>
          <p className="text-blue-400/80 mb-16 uppercase tracking-[0.4em] text-sm font-bold shadow-blue-500/50">Establish Connection Level</p>
          
          <div className="flex flex-col md:flex-row gap-8">
            <button 
              onClick={() => setRole('display')}
              className="group flex flex-col items-center p-10 glass-panel rounded-3xl w-72 hover:border-blue-500/50 hover:shadow-[0_0_40px_rgba(59,130,246,0.2)] transition-all duration-500 hover:-translate-y-2"
            >
              <div className="p-5 bg-blue-500/10 border border-blue-500/20 rounded-2xl mb-6 group-hover:bg-blue-500/20 group-hover:border-blue-500/40 transition-all group-hover:scale-110 duration-500 shadow-[inset_0_0_20px_rgba(59,130,246,0.1)]">
                <Monitor size={48} className="text-blue-400 drop-shadow-[0_0_15px_rgba(59,130,246,0.8)]" />
              </div>
              <span className="font-black text-2xl tracking-[0.2em] mb-2 text-white">DISPLAY</span>
              <span className="text-xs font-bold text-gray-500 uppercase tracking-[0.2em]">Cinematic Matrix</span>
            </button>
            
            <button 
              onClick={() => { setRole('admin'); if(!connected) setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'games', 'master'), INITIAL_STATE); }}
              className="group flex flex-col items-center p-10 glass-panel rounded-3xl w-72 hover:border-emerald-500/50 hover:shadow-[0_0_40px_rgba(16,185,129,0.2)] transition-all duration-500 hover:-translate-y-2"
            >
              <div className="p-5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl mb-6 group-hover:bg-emerald-500/20 group-hover:border-emerald-500/40 transition-all group-hover:scale-110 duration-500 shadow-[inset_0_0_20px_rgba(16,185,129,0.1)]">
                <Smartphone size={48} className="text-emerald-400 drop-shadow-[0_0_15px_rgba(16,185,129,0.8)]" />
              </div>
              <span className="font-black text-2xl tracking-[0.2em] mb-2 text-white">ADMIN</span>
              <span className="text-xs font-bold text-gray-500 uppercase tracking-[0.2em]">Master Control</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{customStyles}</style>
      {role === 'display' ? (
        <MainDisplay state={gameState} />
      ) : (
        <AdminPanel state={gameState} updateState={updateServerState} />
      )}
    </>
  );
}

// --- MAIN DISPLAY (CINEMATIC VIEW) ---
function MainDisplay({ state }) {
  const [displayTime, setDisplayTime] = useState(0);
  const [animatingTeams, setAnimatingTeams] = useState({});
  const [introStage, setIntroStage] = useState(0); // 0: off, 1: show logo, 2: show ready, 3: fade out bg, 4: done
  const playbook = PLAYBOOK[state.round] || PLAYBOOK[0];
  
  // Audio setup
  useEffect(() => {
    if (!fx) fx = new AudioFX();
  }, []);

  // Timer loop
  useEffect(() => {
    const interval = setInterval(() => {
      if (!state.isFrozen && state.endTime > 0) {
        const remaining = Math.max(0, Math.ceil((state.endTime - Date.now()) / 1000));
        setDisplayTime(remaining);
      } else {
        setDisplayTime(state.pausedTime);
      }
    }, 200);
    return () => clearInterval(interval);
  }, [state.isFrozen, state.endTime, state.pausedTime]);

  // Effect Listener
  useEffect(() => {
    if (!state.lastEffect || !fx) return;
    const { id, teamId, type } = state.lastEffect;
    
    setAnimatingTeams(prev => ({ ...prev, [teamId]: type }));
    
    if (type === 'damage') {
      fx.playImpact();
    } else if (type === 'success') {
      fx.playSuccess();
    } else if (type === 'freeze') {
      fx.playPowerDown();
    }

    const timer = setTimeout(() => {
      setAnimatingTeams(prev => {
        const next = { ...prev };
        delete next[teamId];
        return next;
      });
    }, 600);

    return () => clearTimeout(timer);
  }, [state.lastEffect?.id]);

  // Alarms
  useEffect(() => {
    if (displayTime === 10 && !state.isFrozen && state.endTime > 0 && fx) {
      fx.playAlarm();
    }
  }, [displayTime, state.isFrozen, state.endTime]);

  // Intro Sequence
  useEffect(() => {
    if (state.round === 0) {
      setIntroStage(1);
      const t1 = setTimeout(() => setIntroStage(2), 2500);
      const t2 = setTimeout(() => setIntroStage(3), 5000);
      const t3 = setTimeout(() => setIntroStage(4), 6000);
      return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
    } else {
      setIntroStage(4); // Skip intro if joining mid-game
    }
  }, [state.round]);

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Process Teams (Sort for Final Round or just layout)
  let displayTeams = [...state.teams];
  if (state.round === 7) {
    displayTeams.sort((a, b) => b.score - a.score); // Top 2
  }

  return (
    <div className={`min-h-screen bg-gradient-to-br ${playbook.bg} text-white overflow-hidden relative transition-colors duration-1000 ease-in-out flex flex-col`}>
      
      {/* CINEMATIC INTRO */}
      {introStage < 4 && (
        <div className={`absolute inset-0 z-50 flex items-center justify-center bg-black transition-opacity duration-1000 ${introStage === 3 ? 'opacity-0' : 'opacity-100'}`}>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,30,80,0.5)_0%,rgba(0,0,0,1)_70%)]"></div>
          {introStage === 1 && (
            <div className="text-center z-10 animate-intro-text flex flex-col items-center">
              <div className="flex justify-center mb-6">
                <Zap className="w-24 h-24 text-blue-500 drop-shadow-[0_0_30px_rgba(59,130,246,0.8)]" />
              </div>
              <h1 className="text-7xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-500 tracking-[0.3em] drop-shadow-2xl text-center">
                MASTER<br/>SYSTEM
              </h1>
            </div>
          )}
          {introStage === 2 && (
            <div className="text-center z-10 animate-intro-text">
              <h1 className="text-6xl md:text-7xl font-black text-emerald-400 tracking-[0.4em] text-glow uppercase">
                System Online
              </h1>
            </div>
          )}
        </div>
      )}

      {/* HEADER */}
      <header className="flex justify-between items-end p-8 pb-6 border-b border-white/5 z-10 bg-black/60 backdrop-blur-xl shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className={`w-2 h-2 rounded-full ${state.isFrozen ? 'bg-red-500' : 'bg-emerald-500 animate-pulse'}`}></div>
            <h2 className="text-xl text-gray-400 tracking-[0.3em] uppercase font-bold">Phase {state.round}.{state.phaseIdx + 1}</h2>
          </div>
          <h1 className={`text-6xl font-black uppercase tracking-tight ${playbook.text} drop-shadow-[0_0_15px_currentColor]`}>
            {playbook.title}
          </h1>
          <p className="text-xl text-gray-300 mt-2 font-medium tracking-[0.2em] uppercase">{playbook.phases[state.phaseIdx]}</p>
        </div>
        <div className="text-right flex flex-col items-end">
          <div className={`text-[8rem] font-black tracking-tighter tabular-nums leading-none drop-shadow-2xl transition-colors duration-300 ${displayTime <= 10 && displayTime > 0 ? 'text-red-500 animate-pulse text-glow' : 'text-white'}`}>
            {formatTime(displayTime)}
          </div>
          {state.isFrozen && (
            <div className="bg-red-600/20 border border-red-500/50 text-red-500 px-6 py-2 mt-4 text-xl font-bold tracking-[0.3em] uppercase rounded backdrop-blur-sm animate-pulse">
              System Frozen
            </div>
          )}
        </div>
      </header>

      {/* OVERLAYS */}
      {state.isFrozen && state.round !== 0 && (
        <div className="absolute inset-0 z-40 bg-red-950/40 backdrop-blur-sm flex items-center justify-center pointer-events-none transition-all duration-500">
           <div className="text-center transform scale-110">
              <AlertTriangle className="w-40 h-40 text-red-500 mx-auto mb-8 opacity-90 drop-shadow-[0_0_30px_rgba(239,68,68,0.8)]" />
              <h1 className="text-[8rem] font-black text-white tracking-[0.2em] uppercase drop-shadow-[0_0_40px_rgba(239,68,68,1)] text-glow">Power Lost</h1>
           </div>
        </div>
      )}

      {/* MAIN GRID */}
      <main className="flex-1 p-8 z-10 flex items-center justify-center">
        <div className={`grid gap-10 w-full max-w-[90rem] mx-auto ${state.round === 7 ? 'grid-cols-2' : 'grid-cols-2 lg:grid-cols-4'}`}>
          {displayTeams.map((team, idx) => {
            const isEliminated = state.round === 7 && idx >= 2;
            const animType = animatingTeams[team.id];
            const isDanger = team.power < 20;
            const isOverdrive = team.power >= 100;

            if (isEliminated) return null;

            return (
              <div 
                key={team.id}
                className={`
                  relative glass-panel rounded-3xl p-8 overflow-hidden transition-all duration-500 transform hover:scale-[1.02]
                  ${animType === 'damage' ? 'animate-shake border-red-500 shadow-[0_0_40px_rgba(239,68,68,0.4)]' : ''}
                  ${animType === 'success' ? 'border-emerald-400 scale-[1.05] shadow-[0_0_40px_rgba(52,211,153,0.4)]' : ''}
                  ${isDanger ? 'border-red-600/50 shadow-[inset_0_0_60px_rgba(220,38,38,0.2)]' : ''}
                `}
              >
                {/* Visual fx layers */}
                {animType === 'damage' && <div className="absolute inset-0 sparks-overlay z-0 pointer-events-none opacity-50"></div>}
                {isDanger && <div className="absolute inset-0 bg-red-600/10 animate-pulse pointer-events-none"></div>}

                <div className="relative z-10 flex flex-col h-full">
                  <div className="flex items-center gap-3 mb-8">
                    <Users className={`w-6 h-6 ${isDanger ? 'text-red-500' : 'text-gray-400'}`} />
                    <h3 className="text-3xl font-black text-gray-200 tracking-[0.15em] uppercase">{team.name}</h3>
                  </div>
                  
                  {/* Score */}
                  <div className="mb-10 flex-1">
                    <div className="text-sm text-blue-400/80 uppercase tracking-[0.3em] font-bold mb-2">Data Mined</div>
                    <div className="text-[5rem] font-black tabular-nums leading-none text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-400 drop-shadow-lg">
                      {team.score}
                    </div>
                  </div>

                  {/* Power Bar */}
                  <div className="mt-auto">
                    <div className="flex justify-between items-end text-sm uppercase tracking-[0.2em] font-bold mb-3">
                      <span className={`${isDanger ? 'text-red-500 animate-pulse' : 'text-gray-400'} flex items-center gap-2`}>
                        {isDanger && <AlertTriangle size={14} className="text-red-500" />}
                        System Power
                      </span>
                      <span className={`text-xl ${isOverdrive ? 'text-blue-400 text-glow' : 'text-white'}`}>{team.power} <span className="text-sm text-gray-500">/ 120</span></span>
                    </div>
                    <div className={`h-8 w-full bg-black/80 rounded-full overflow-hidden border border-white/5 shadow-inner p-1 ${isOverdrive ? 'overdrive' : ''}`}>
                      <div 
                        className={`h-full rounded-full transition-all duration-700 ease-out shadow-[inset_0_2px_10px_rgba(255,255,255,0.3)]
                          ${isDanger ? 'bg-gradient-to-r from-red-700 to-red-500' : isOverdrive ? 'bg-gradient-to-r from-blue-600 to-cyan-400' : 'bg-gradient-to-r from-emerald-600 to-green-400'}
                        `}
                        style={{ width: `${Math.min(100, (team.power / 120) * 100)}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}

// --- ADMIN PANEL (CONTROL VIEW) ---
function AdminPanel({ state, updateState }) {
  const playbook = PLAYBOOK[state.round] || PLAYBOOK[0];
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const handleStartPause = () => {
    if (state.isFrozen) {
      // Unfreeze
      const newEndTime = Date.now() + (state.pausedTime * 1000);
      updateState({ 
        isFrozen: false, 
        endTime: newEndTime,
        lastEffect: { id: Date.now().toString(), type: 'success', teamId: 'sys' }
      });
    } else {
      // Freeze
      const rem = Math.max(0, Math.ceil((state.endTime - Date.now()) / 1000));
      updateState({ 
        isFrozen: true, 
        pausedTime: rem,
        lastEffect: { id: Date.now().toString(), type: 'freeze', teamId: 'sys' }
      });
    }
  };

  const setRound = (roundNum) => {
    const nextPlaybook = PLAYBOOK[roundNum];
    const initialTime = nextPlaybook.phaseTimes ? nextPlaybook.phaseTimes[0] : nextPlaybook.time;
    updateState({
      round: roundNum,
      phaseIdx: 0,
      isFrozen: true,
      pausedTime: initialTime,
      endTime: 0
    });
  };

  const nextPhase = () => {
    if (state.phaseIdx < playbook.phases.length - 1) {
      const nextIdx = state.phaseIdx + 1;
      const initialTime = playbook.phaseTimes ? playbook.phaseTimes[nextIdx] : playbook.time;
      updateState({
        phaseIdx: nextIdx,
        isFrozen: true,
        pausedTime: initialTime,
        endTime: 0
      });
    }
  };

  const resetTimer = () => {
    const initialTime = playbook.phaseTimes ? playbook.phaseTimes[state.phaseIdx] : playbook.time;
    updateState({
      isFrozen: true,
      pausedTime: initialTime,
      endTime: 0
    });
  };

  const modifyTeam = (teamId, powerDelta, scoreDelta) => {
    const teamIndex = state.teams.findIndex(t => t.id === teamId);
    if (teamIndex === -1) return;
    
    const team = state.teams[teamIndex];
    let newPower = team.power + powerDelta;
    if (newPower > 120) newPower = 120;
    if (newPower < 0) newPower = 0;

    const newTeams = [...state.teams];
    newTeams[teamIndex] = { ...team, power: newPower, score: team.score + scoreDelta };

    const effectType = (powerDelta < 0 || scoreDelta < 0) ? 'damage' : 'success';

    updateState({
      teams: newTeams,
      lastEffect: { id: Date.now().toString(), teamId, type: effectType }
    });
  };

  const displayTime = state.isFrozen 
    ? state.pausedTime 
    : Math.max(0, Math.ceil((state.endTime - Date.now()) / 1000));

  return (
    <div className="min-h-screen bg-zinc-950 text-neutral-300 font-sans flex flex-col selection:bg-blue-500/30">
      {/* ADMIN HEADER */}
      <header className="bg-zinc-900 border-b border-zinc-800 p-4 flex justify-between items-center sticky top-0 z-50 shadow-md">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 -ml-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <Menu size={24} />
          </button>
          <Zap className="text-blue-500" />
          <h1 className="text-xl font-black text-white tracking-[0.2em] uppercase hidden sm:block">Control Matrix</h1>
        </div>
        
        {/* Playback Controls */}
        <div className="flex gap-3">
          <button 
            onClick={resetTimer}
            className="p-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors border border-zinc-700"
            title="Reset Timer"
          >
            <RotateCcw size={20} className="text-zinc-300" />
          </button>
          <button 
            onClick={handleStartPause}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-bold tracking-[0.2em] uppercase transition-all shadow-lg ${
              state.isFrozen ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/50' : 'bg-red-600 hover:bg-red-500 text-white shadow-red-900/50'
            }`}
          >
            {state.isFrozen ? <><Play size={20} /> Start</> : <><Pause size={20} /> Freeze</>}
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* LEFT SIDEBAR - ROUND SELECTION */}
        <div className={`bg-zinc-900 border-zinc-800 overflow-hidden transition-all duration-300 ease-in-out hidden md:block ${isSidebarOpen ? 'w-72 border-r' : 'w-0 border-r-0'}`}>
          <div className="w-72 p-5 h-full overflow-y-auto">
            <h2 className="text-xs font-black text-zinc-500 tracking-[0.2em] uppercase mb-6">Scenario Sequence</h2>
            <div className="space-y-3">
              {PLAYBOOK.map(pb => (
                <button
                  key={pb.id}
                  onClick={() => setRound(pb.id)}
                  className={`w-full text-left px-5 py-4 rounded-xl border transition-all duration-300 ${
                    state.round === pb.id 
                      ? 'bg-blue-900/20 border-blue-500/50 text-blue-300 shadow-[0_0_15px_rgba(59,130,246,0.1)]' 
                      : 'bg-zinc-950 border-transparent text-zinc-400 hover:bg-zinc-800/80 hover:border-zinc-700'
                  }`}
                >
                  <div className="text-[10px] font-bold tracking-[0.2em] uppercase opacity-60 mb-1">Round {pb.id}</div>
                  <div className="font-bold text-sm">{pb.title}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* MAIN CONTROL AREA */}
        <main className="flex-1 p-8 overflow-y-auto bg-gradient-to-b from-zinc-950 to-black">
          {/* Current Status Banner */}
          <div className="bg-zinc-900/80 backdrop-blur-sm border border-zinc-800/80 rounded-2xl p-8 mb-8 flex justify-between items-center shadow-xl">
            <div>
              <div className="text-blue-400 text-xs font-black tracking-[0.3em] uppercase mb-2">Active Scenario</div>
              <h2 className="text-4xl font-black text-white tracking-tight">{playbook.title}</h2>
              <div className="text-zinc-400 mt-4 flex items-center gap-3">
                <span className="bg-zinc-800/80 px-4 py-1.5 rounded-lg text-sm font-semibold tracking-wider uppercase border border-zinc-700">{playbook.phases[state.phaseIdx]}</span>
                {state.phaseIdx < playbook.phases.length - 1 && (
                  <button onClick={nextPhase} className="text-sm font-bold tracking-wider uppercase bg-blue-600/20 hover:bg-blue-500 border border-blue-500/50 hover:border-transparent text-blue-300 hover:text-white px-4 py-1.5 rounded-lg flex items-center gap-2 transition-all">
                    Next Phase <SkipForward size={14}/>
                  </button>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className={`text-7xl font-black tabular-nums tracking-tighter drop-shadow-md ${state.isFrozen ? 'text-red-500' : 'text-emerald-400'}`}>
                {Math.floor(displayTime / 60)}:{(displayTime % 60).toString().padStart(2, '0')}
              </div>
              <div className={`text-sm font-black uppercase tracking-[0.3em] mt-2 ${state.isFrozen ? 'text-red-500/70' : 'text-emerald-500/70'}`}>
                {state.isFrozen ? 'System Halted' : 'Time Running'}
              </div>
            </div>
          </div>

          {/* Teams Grid */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4">
            {state.teams.map((team, idx) => {
               const isElim = state.round === 7 && idx >= 2;
               if (isElim) return null;

               return (
                <div key={team.id} className="bg-zinc-900/50 border border-zinc-800/80 rounded-2xl p-6 flex flex-col shadow-lg backdrop-blur-sm">
                  <div className="flex justify-between items-start mb-6 border-b border-zinc-800 pb-4">
                    <h3 className="text-2xl font-black text-white tracking-wide">{team.name}</h3>
                    <div className="text-right">
                      <div className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-zinc-400">{team.score}</div>
                      <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.2em] mt-1">Points</div>
                    </div>
                  </div>

                  {/* Power Management */}
                  <div className="mb-6 bg-black/40 rounded-xl p-4 border border-zinc-800/50">
                    <div className="flex justify-between items-end mb-3">
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Power Level</span>
                      <span className={`text-lg font-black ${team.power < 20 ? 'text-red-500' : 'text-blue-400'}`}>{team.power}</span>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      <button onClick={() => modifyTeam(team.id, -10, 0)} className="bg-red-950/30 hover:bg-red-900/50 text-red-500 py-2.5 rounded-lg text-sm font-black border border-red-900/30 transition-colors">-10</button>
                      <button onClick={() => modifyTeam(team.id, -5, 0)} className="bg-red-950/30 hover:bg-red-900/50 text-red-400 py-2.5 rounded-lg text-sm font-black border border-red-900/30 transition-colors">-5</button>
                      <button onClick={() => modifyTeam(team.id, 5, 0)} className="bg-emerald-950/30 hover:bg-emerald-900/50 text-emerald-400 py-2.5 rounded-lg text-sm font-black border border-emerald-900/30 transition-colors">+5</button>
                      <button onClick={() => modifyTeam(team.id, 10, 0)} className="bg-emerald-950/30 hover:bg-emerald-900/50 text-emerald-500 py-2.5 rounded-lg text-sm font-black border border-emerald-900/30 transition-colors">+10</button>
                    </div>
                  </div>

                  {/* Contextual Actions based on Round */}
                  {playbook.actions && (
                    <div className="mt-auto pt-2 space-y-3">
                      <div className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em] mb-1">Scenario Actions</div>
                      {playbook.actions.map((act, i) => (
                        <button 
                          key={i}
                          onClick={() => modifyTeam(team.id, act.p, act.s)}
                          className={`w-full py-3.5 rounded-xl text-xs font-bold uppercase tracking-[0.15em] flex justify-between items-center px-5 transition-all shadow-sm ${
                            act.s < 0 || act.p < 0 
                              ? 'bg-zinc-950 border border-red-900/20 text-red-400 hover:bg-red-950/40 hover:border-red-500/30' 
                              : 'bg-zinc-950 border border-emerald-900/20 text-emerald-400 hover:bg-emerald-950/40 hover:border-emerald-500/30'
                          }`}
                        >
                          <span>{act.label}</span>
                          <span className="text-[10px] font-black opacity-80 bg-black/40 px-2 py-1 rounded">
                            {act.s !== 0 && `${act.s > 0 ? '+' : ''}${act.s} Pts `}
                            {act.p !== 0 && `${act.s !== 0 ? '| ' : ''}${act.p > 0 ? '+' : ''}${act.p} Pwr`}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Generic Score Buttons (if no playbook actions or as backup) */}
                  {!playbook.actions && (
                    <div className="mt-auto pt-4 grid grid-cols-2 gap-3">
                       <button onClick={() => modifyTeam(team.id, 0, -10)} className="bg-zinc-800 hover:bg-zinc-700 py-3 rounded-xl text-sm font-bold tracking-wider text-zinc-300 transition-colors border border-zinc-700">-10 Pts</button>
                       <button onClick={() => modifyTeam(team.id, 0, 10)} className="bg-zinc-800 hover:bg-zinc-700 py-3 rounded-xl text-sm font-bold tracking-wider text-zinc-300 transition-colors border border-zinc-700">+10 Pts</button>
                    </div>
                  )}
                </div>
               );
            })}
          </div>
        </main>
      </div>
    </div>
  );
}