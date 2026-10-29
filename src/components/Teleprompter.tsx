import { useEffect, useRef, useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Minus,
  Plus,
  PencilLine,
  Check,
  ChevronDown,
  ChevronUp,
  AlignLeft,
} from 'lucide-react';
import { IconButton } from './ui';
import { formatTime } from '../model';
export function Teleprompter({
  script,
  onChange,
  sceneName,
  sceneId,
}: {
  script: string;
  onChange: (value: string) => void;
  sceneName: string;
  sceneId: string;
}) {
  const [editing, setEditing] = useState(false),
    [running, setRunning] = useState(false),
    [font, setFont] = useState(21),
    [speed, setSpeed] = useState(28),
    [paragraph, setParagraph] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const pos = useRef(0);
  useEffect(() => {
    if (!running || editing) return;
    let frame: number,
      last = performance.now();
    const tick = (now: number) => {
      const el = ref.current;
      if (el) {
        pos.current += ((now - last) * speed) / 1000;
        el.scrollTop = pos.current;
        if (el.scrollTop >= el.scrollHeight - el.clientHeight - 1) {
          setRunning(false);
        }
      }
      last = now;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [running, editing, speed]);
  useEffect(() => {
    pos.current = 0;
    if (ref.current) ref.current.scrollTop = 0;
    setParagraph(0);
    setRunning(false);
  }, [sceneId]);
  const next = (delta: number) => {
    const index = Math.max(0, Math.min(script.split('\n\n').length - 1, paragraph + delta));
    setParagraph(index);
    const child = ref.current?.querySelectorAll<HTMLElement>('.script-paragraph')[index];
    if (child && ref.current) {
      ref.current.scrollTop = child.offsetTop - ref.current.offsetTop - 32;
      pos.current = ref.current.scrollTop;
    }
  };
  const words = script.trim().split(/\s+/).filter(Boolean).length;
  return (
    <div className="teleprompter">
      <div className="script-header">
        <div>
          <AlignLeft size={14} />
          <span>{sceneName}</span>
        </div>
        <IconButton
          label={editing ? 'Done editing script' : 'Edit script'}
          onClick={() => {
            setEditing(!editing);
            setRunning(false);
          }}
        >
          {editing ? <Check size={15} /> : <PencilLine size={15} />}
        </IconButton>
      </div>
      <div className="script-meta">
        <span>{words} words</span>
        <span>~{formatTime(words / 2.3)} read</span>
      </div>
      {editing ? (
        <textarea
          maxLength={100000}
          className="script-editor"
          aria-label="Scene script"
          value={script}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Your next great story starts here…"
        />
      ) : (
        <div
          className="script-reader"
          ref={ref}
          style={{ fontSize: font }}
          onScroll={() => {
            if (!running) pos.current = ref.current?.scrollTop || 0;
          }}
        >
          <div className="script-reader-top">YOUR NEXT GREAT TAKE STARTS HERE</div>
          {script.split('\n\n').map((s, i) => (
            <p
              key={i}
              onClick={() => setParagraph(i)}
              className={`script-paragraph ${paragraph === i ? 'current' : ''}`}
            >
              {s || 'Add a script to find your flow.'}
            </p>
          ))}
          <div className="script-end">
            You’ve got this.<span>◉</span>
          </div>
        </div>
      )}
      <div className="prompter-controls">
        <div className="prompter-play">
          <IconButton
            label="Restart teleprompter"
            onClick={() => {
              if (ref.current) ref.current.scrollTop = 0;
              pos.current = 0;
              setParagraph(0);
            }}
          >
            <RotateCcw size={14} />
          </IconButton>
          <button
            className={`auto-scroll ${running ? 'running' : ''}`}
            onClick={() => {
              setRunning(!running);
              setEditing(false);
            }}
          >
            {running ? <Pause size={13} /> : <Play size={13} />}{' '}
            {running ? 'Pause scrolling' : 'Auto-scroll'}
          </button>
          <div className="paragraph-nav">
            <IconButton label="Previous paragraph" onClick={() => next(-1)}>
              <ChevronUp size={13} />
            </IconButton>
            <IconButton label="Next paragraph" onClick={() => next(1)}>
              <ChevronDown size={13} />
            </IconButton>
          </div>
        </div>
        <div className="prompter-adjust">
          <span>Text size</span>
          <IconButton label="Smaller script text" onClick={() => setFont(Math.max(14, font - 1))}>
            <Minus size={12} />
          </IconButton>
          <span>{font}</span>
          <IconButton label="Larger script text" onClick={() => setFont(Math.min(36, font + 1))}>
            <Plus size={12} />
          </IconButton>
          <label>
            Speed{' '}
            <select
              aria-label="Teleprompter speed"
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
            >
              <option value={14}>Slow</option>
              <option value={28}>Normal</option>
              <option value={42}>Fast</option>
            </select>
          </label>
        </div>
      </div>
      <div className="private-note">
        <span>◈</span>Your script is for your eyes only.
        <br />
        It won’t appear in your recording.
      </div>
    </div>
  );
}
