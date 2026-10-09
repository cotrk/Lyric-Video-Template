import { type CSSProperties, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Check, ChevronDown, Download, FileAudio, FileImage, Maximize2, Pause, Play, Upload, Volume2 } from 'lucide-react';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

const queryClient = new QueryClient();

function Home() {
  type Motion = 'Quiet' | 'Standard' | 'Intense';
  type LyricPart = { time?: number; text: string };
  type LyricLine = { time: number; text: string; parts: LyricPart[] };
  type Project = { title: string; artist: string; lyrics: string; motion: Motion; cover: string; audio?: string; audioName?: string };
  const starterLyrics = `[00:04] Bodies hit the floor when the bassline cracks
[00:09] South side pressure, no turning back
[00:14] Hear that steel in the kick drum talk
[00:19] Whole block move when the low end knocks
[00:24] Blacktop shine under green street lights
[00:29] Built from the cold, made for the fight
[00:34] TRP8 — let the whole room know
[00:39] When the beat cuts out, we still go`;
  const defaultCover = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600"><rect width="600" height="600" fill="#080a08"/><path d="M0 420 600 160v180L0 600z" fill="#39ff6a"/><path d="M0 470 600 210v36L0 506z" fill="#f2f2f0"/><circle cx="300" cy="300" r="172" fill="#0a0a0b" stroke="#f2f2f0" stroke-width="2"/><circle cx="300" cy="300" r="143" fill="none" stroke="#39ff6a" stroke-width="3"/><text x="300" y="325" text-anchor="middle" font-family="Arial,sans-serif" font-size="92" font-weight="900" letter-spacing="-8" fill="#f2f2f0">TRP8</text><text x="300" y="370" text-anchor="middle" font-family="monospace" font-size="17" letter-spacing="7" fill="#39ff6a">CHICAGO / IL</text></svg>`)}`;
  const freshProject = (): Project => ({ title: 'Pentakill Bodies', artist: 'TRP8', lyrics: starterLyrics, motion: 'Standard', cover: defaultCover });
  const [project, setProject] = useState<Project>(() => {
    try {
      const saved = localStorage.getItem('trp8-local-project-v1');
      return saved ? { ...freshProject(), ...JSON.parse(saved) } as Project : freshProject();
    } catch { return freshProject(); }
  });
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);
  const [storageStatus, setStorageStatus] = useState('Local project');
  const [recordMode, setRecordMode] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [coverName, setCoverName] = useState('');
  const [audioName, setAudioName] = useState(project.audioName || '');
  const audioRef = useRef<HTMLAudioElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);
  const audioInput = useRef<HTMLInputElement>(null);
  const importInput = useRef<HTMLInputElement>(null);
  const [audioUrl, setAudioUrl] = useState(() => project.audio || '');
  const parsedLyrics = useMemo<LyricLine[]>(() => {
    const lines = project.lyrics.split(/\r?\n/).map((line) => {
    const head = line.match(/^\s*\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]\s*(.*)$/);
    if (!head) return null;
    const stamp = (Number(head[1]) * 60 + Number(head[2]) + Number(`0.${head[3] || '0'}`));
    const text = head[4];
    const parts: LyricPart[] = [];
    const wordTiming = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\s+([^\]]+)\]/g;
    let cursor = 0;
    for (const match of text.matchAll(wordTiming)) {
      const index = match.index ?? 0;
      if (index > cursor) parts.push({ text: text.slice(cursor, index) });
      parts.push({
        time: Number(match[1]) * 60 + Number(match[2]) + Number(`0.${match[3] || '0'}`),
        text: match[4].trim(),
      });
      cursor = index + match[0].length;
    }
    if (cursor < text.length) parts.push({ text: text.slice(cursor) });
    const cleanText = parts.map((part) => part.text).join('').trim();
    return { time: stamp, text: cleanText, parts };
    }).filter((line): line is LyricLine => line !== null).sort((a, b) => a.time - b.time);
    return lines.map((line, index) => {
      if (line.parts.some((part) => part.time !== undefined)) return line;
      const chunks = line.text.match(/\S+\s*/g) || [];
      const nextTime = lines[index + 1]?.time ?? line.time + 4;
      return {
        ...line,
        parts: chunks.map((text, wordIndex) => ({
          text,
          time: line.time + ((nextTime - line.time) * wordIndex) / Math.max(chunks.length, 1),
        })),
      };
    });
  }, [project.lyrics]);
  const activeIndex = parsedLyrics.reduce((found, line, index) => line.time <= currentTime ? index : found, -1);
  const activeLine = activeIndex >= 0 ? parsedLyrics[activeIndex] : null;
  const particles = useMemo(() => Array.from({ length: project.motion === 'Quiet' ? 24 : project.motion === 'Intense' ? 120 : 60 }, (_, i) => ({
    left: `${(i * 37 + 11) % 97}%`, top: `${(i * 61 + 8) % 94}%`, size: `${6 + (i % 4) * 1.5}px`, opacity: `${0.72 + (i % 3) * 0.09}`, duration: `${3.4 + (i % 8) * .55}s`, delay: `${-(i % 9) * .48}s`, drift: `${(i % 2 ? 1 : -1) * (2 + (i % 5) * 1.5)}px`,
  })), [project.motion]);

  useEffect(() => {
    try {
      localStorage.setItem('trp8-local-project-v1', JSON.stringify(project));
      setStorageStatus('Saved on this device');
    } catch {
      setStorageStatus('Storage full — export a project file');
    }
  }, [project]);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    if (!recordMode) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setRecordMode(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [recordMode]);

  const patchProject = (updates: Partial<Project>) => setProject((current) => ({ ...current, ...updates }));
  const toDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Could not read that file.'));
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.readAsDataURL(file);
  });
  const uploadCover = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setNotice({ text: 'Choose an image file for cover art.', error: true }); return; }
    try { patchProject({ cover: await toDataUrl(file) }); setCoverName(file.name); setNotice({ text: 'Cover art updated locally.' }); }
    catch { setNotice({ text: 'Cover art could not be read.', error: true }); }
  };
  const uploadAudio = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('audio/')) { setNotice({ text: 'Choose an audio file to load a track.', error: true }); return; }
    try {
      const data = await toDataUrl(file);
      patchProject({ audio: data, audioName: file.name });
      setAudioName(file.name);
      setAudioUrl(data);
      setPlaying(false); setCurrentTime(0);
      setNotice({ text: `Track loaded: ${file.name}` });
    } catch { setNotice({ text: 'Audio file could not be loaded.', error: true }); }
  };
  const togglePlay = async () => {
    if (!audioRef.current) { setNotice({ text: 'Upload an audio track before playback.', error: true }); return; }
    try {
      if (audioRef.current.paused) { await audioRef.current.play(); setPlaying(true); }
      else { audioRef.current.pause(); setPlaying(false); }
    } catch { setNotice({ text: 'This audio file could not be played. Try another file.', error: true }); }
  };
  const seek = (seconds: number) => {
    if (!audioRef.current) { setNotice({ text: 'Upload an audio track to seek lyrics.', error: true }); return; }
    audioRef.current.currentTime = Math.max(0, seconds);
    setCurrentTime(Math.max(0, seconds));
  };
  const seekLyricsEditorLine = (textarea: HTMLTextAreaElement) => {
    const lineNumber = textarea.value.slice(0, textarea.selectionStart).split('\n').length - 1;
    const sourceLine = textarea.value.split(/\r?\n/)[lineNumber] || '';
    const timecode = sourceLine.match(/^\s*\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/);
    if (!timecode) return;
    seek(Number(timecode[1]) * 60 + Number(timecode[2]) + Number(`0.${timecode[3] || '0'}`));
  };
  const downloadProject = () => {
    try {
      const blob = new Blob([JSON.stringify({ format: 'trp8-lyric-project', version: 1, ...project }, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url; link.download = `${project.title.trim().replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'trp8-project'}.trp8.json`; link.click();
      URL.revokeObjectURL(url);
      setNotice({ text: 'Project JSON exported, including local media data.' });
    } catch { setNotice({ text: 'Project export failed.', error: true }); }
  };
  const importProject = async (file?: File) => {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as Partial<Project>;
      if (typeof parsed.title !== 'string' || typeof parsed.artist !== 'string' || typeof parsed.lyrics !== 'string') throw new Error('This file is missing project title, artist, or lyrics.');
      if (parsed.cover && !parsed.cover.startsWith('data:image/')) throw new Error('Cover art data is not a supported image.');
      if (parsed.audio && !parsed.audio.startsWith('data:audio/')) throw new Error('Audio data is not a supported audio file.');
      const next = { ...freshProject(), ...parsed };
      setProject(next);
      setCoverName('');
      setAudioName(next.audioName || '');
      setAudioUrl(next.audio || '');
      setCurrentTime(0); setPlaying(false);
      setNotice({ text: 'Project imported to this device.' });
    } catch (error) { setNotice({ text: error instanceof Error ? error.message : 'Could not import this project file.', error: true }); }
  };
  const formatClock = (time: number) => `${Math.floor(time / 60).toString().padStart(2, '0')}:${Math.floor(time % 60).toString().padStart(2, '0')}`;
  const stage = (
    <div className="stage" aria-label="Vertical lyric video preview">
      <div className="stage-grain" />
      {particles.map((particle, i) => <span key={i} className="particle" style={{ left: particle.left, top: particle.top, '--size': particle.size, '--opacity': particle.opacity, '--duration': particle.duration, '--delay': particle.delay, '--drift': particle.drift } as CSSProperties} />)}
      <div className="stage-topline"><span className="stage-live"><i className="live-dot" /> TRP8 / LIVE VISUAL</span><span>CHICAGO · 8 / 8</span></div>
      <div className="cover-wrap"><span className="cover-ring" /><img className="cover-image" src={project.cover} alt="Project cover art" /></div>
      <h2 className="stage-title glitch" data-text={project.title}>{project.title || 'UNTITLED'}</h2>
      <div className="stage-artist">{project.artist || 'ARTIST'}</div>
      <div className="lyrics-window">
        {parsedLyrics.length ? parsedLyrics.slice(Math.max(0, activeIndex - 2), Math.min(parsedLyrics.length, Math.max(4, activeIndex + 4))).map((line, index) => {
          const actualIndex = parsedLyrics.indexOf(line);
          const isActive = actualIndex === activeIndex;
          return <div key={`${line.time}-${actualIndex}`} className={`stage-lyric ${isActive ? 'active' : ''}`} onClick={() => seek(line.time)} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') seek(line.time); }}>
            {line.parts.map((part, partIndex) => <span key={`${part.time ?? 'plain'}-${partIndex}`} className={part.time === undefined ? '' : `stage-word ${isActive && part.time <= currentTime ? 'active' : ''}`}>{part.text}</span>)}
          </div>;
        }) : <div className="stage-lyric active">Add timed lyrics to light the stage.</div>}
      </div>
      <div className="stage-bottom"><span>NO SIGNAL / NO MERCY</span><span>TRP8 — INDEPENDENT</span></div>
      {!audioUrl && <div className="missing-track"><strong>NO TRACK LOADED</strong><br />Upload audio to run the lyric sync.</div>}
    </div>
  );

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup"><span className="brand-mark" /> TRP8 <span style={{ color: '#77777a', fontSize: 13, letterSpacing: '.13em' }}>VISUAL LAB</span></div>
        <div className="topbar-note">Local-first lyric video editor <span style={{ color: '#39ff6a', marginLeft: 9 }}>●</span></div>
        <div className="top-actions">
          <button className="button button-quiet" data-testid="button-import-project" onClick={() => importInput.current?.click()}><Upload size={14} /> Import</button>
          <input ref={importInput} className="file-input" type="file" accept="application/json,.json" data-testid="input-import-project" onChange={(event) => { void importProject(event.target.files?.[0]); event.currentTarget.value = ''; }} />
          <button className="button button-primary" data-testid="button-export-project" onClick={downloadProject}><Download size={14} /> Export project</button>
        </div>
      </header>
      <div className="workspace">
        <section className="editor">
          <div className="eyebrow">Artist workspace / 001</div>
          <h1 className="page-title">Make the words<br />hit harder.</h1>
          <p className="lede">Build a vertical stage. The files stay on this device.</p>
          <section className="control-section">
            <div className="section-head"><h2 className="section-title">01 / Record identity</h2><span className="section-meta">TITLE CARD</span></div>
            <div className="field-grid">
              <label><span className="field-label">Track title</span><input className="text-field" data-testid="input-title" value={project.title} onChange={(event) => patchProject({ title: event.target.value })} maxLength={64} /></label>
              <label><span className="field-label">Artist name</span><input className="text-field" data-testid="input-artist" value={project.artist} onChange={(event) => patchProject({ artist: event.target.value })} maxLength={40} /></label>
            </div>
          </section>
          <section className="control-section">
            <div className="section-head"><h2 className="section-title">02 / Source material</h2><span className="section-meta">DEVICE ONLY</span></div>
            <div className="upload-row">
              <button className="button" data-testid="button-upload-cover" onClick={() => coverInput.current?.click()}><FileImage size={14} /> {coverName ? 'Replace cover' : 'Upload cover'}</button>
              <input ref={coverInput} className="file-input" type="file" accept="image/*" data-testid="input-cover" onChange={(event) => { void uploadCover(event.target.files?.[0]); event.currentTarget.value = ''; }} />
              <span className="file-name">{coverName || 'Abstract cover art ready'}</span>
            </div>
            <div className="upload-row" style={{ marginTop: 10 }}>
              <button className="button" data-testid="button-upload-audio" onClick={() => audioInput.current?.click()}><FileAudio size={14} /> {audioName ? 'Replace track' : 'Upload audio'}</button>
              <input ref={audioInput} className="file-input" type="file" accept="audio/*" data-testid="input-audio" onChange={(event) => { void uploadAudio(event.target.files?.[0]); event.currentTarget.value = ''; }} />
              <span className="file-name">{audioName || 'No track loaded'}</span>
            </div>
          </section>
          <section className="control-section">
            <div className="section-head"><h2 className="section-title">03 / Motion profile</h2><span className="section-meta">PARTICLES</span></div>
            <div className="motion-options" role="group" aria-label="Motion intensity">
              {(['Quiet', 'Standard', 'Intense'] as Motion[]).map((motion, index) => <button key={motion} className={`motion-button ${project.motion === motion ? 'active' : ''}`} aria-pressed={project.motion === motion} data-testid={`button-motion-${motion.toLowerCase()}`} onClick={() => patchProject({ motion })}>{motion} <span style={{ opacity: .65 }}>{[24, 60, 120][index]}</span></button>)}
            </div>
            <p className="motion-hint">Reduced motion preference keeps particles fixed at lower intensity.</p>
          </section>
          <section className="control-section">
            <div className="section-head"><h2 className="section-title">04 / Timed lyrics</h2><span className="line-count">{parsedLyrics.length} LINES</span></div>
            <label className="field-label" htmlFor="lyrics-input">One timestamp per line · [mm:ss] lyric text</label>
            <textarea id="lyrics-input" className="lyrics-field" data-testid="input-lyrics" value={project.lyrics} onChange={(event) => patchProject({ lyrics: event.target.value })} onClick={(event) => seekLyricsEditorLine(event.currentTarget)} spellCheck={false} />
            <p className="lyrics-help">Word timing: [mm:ss.ms word] inside a line, e.g. [00:04.25 Bodies]. Click a timestamped line here or in the preview to seek.</p>
          </section>
          <div className="editor-footer">
            <div className={`status-line ${storageStatus.includes('full') ? 'error' : ''}`} data-testid="status-storage"><Check size={12} style={{ verticalAlign: 'middle', marginRight: 5 }} />{storageStatus}</div>
            <button className="button button-quiet" data-testid="button-record-mode" onClick={() => setRecordMode(true)}><Maximize2 size={14} /> Fullscreen record</button>
          </div>
        </section>
        <section className="preview-column">
          <div className="preview-heading"><span>Live stage / 9:16</span><span>Preview output <ChevronDown size={12} style={{ verticalAlign: 'middle' }} /></span></div>
          {stage}
          <div className="transport">
            <button className="button button-primary button-icon" aria-label={playing ? 'Pause audio' : 'Play audio'} data-testid="button-play-pause" onClick={() => void togglePlay()}>{playing ? <Pause size={15} /> : <Play size={15} />}</button>
            <input className="seek-range" aria-label="Seek audio" type="range" min={0} max={duration || 100} step=".05" value={Math.min(currentTime, duration || 100)} onChange={(event) => seek(Number(event.target.value))} data-testid="input-audio-seek" />
            <span className="clock" data-testid="text-audio-time">{formatClock(currentTime)} / {formatClock(duration)}</span>
          </div>
          <p className="preview-caption"><Volume2 size={12} style={{ verticalAlign: 'middle', marginRight: 5 }} /> PLAYBACK AND LYRICS STAY ON YOUR DEVICE</p>
        </section>
      </div>
      <audio ref={audioRef} src={audioUrl || undefined} preload="metadata" onTimeUpdate={() => { if (audioRef.current) setCurrentTime(audioRef.current.currentTime); }} onLoadedMetadata={() => { if (audioRef.current) setDuration(audioRef.current.duration || 0); }} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} onError={() => { if (audioUrl) setNotice({ text: 'Audio could not be decoded. Try a different audio file.', error: true }); }} />
      {recordMode && <div className="record-mode"><div className="record-exit"><button className="button button-quiet" data-testid="button-exit-record" onClick={() => setRecordMode(false)}>Exit record · Esc</button></div>{stage}<div className="record-hint">Press Escape to return to the editor</div></div>}
      {notice && <div className={`notice ${notice.error ? 'error' : ''}`} role="status" data-testid="status-notice">{notice.text}</div>}
    </main>
  );
}

function Router() {
  return (
    // Keep a shared shell (sidebar, navbar) outside the boundary so it
    // survives a page crash.
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Home} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
