import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Play, Pause, RotateCcw, PencilLine, AlignLeft, X } from 'lucide-react';
import { IconButton } from './ui';

export function Teleprompter({
  script,
  sceneName,
  sceneId,
  fontSize,
  speed,
  blocked,
  onEdit,
  onClose,
}: {
  script: string;
  sceneName: string;
  sceneId: string;
  fontSize: number;
  speed: number;
  blocked: boolean;
  onEdit: () => void;
  onClose: () => void;
}) {
  const [running, setRunning] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pos = useRef(0);
  useEffect(() => {
    if (!running || blocked) return;
    let frame: number,
      last = performance.now();
    const tick = (now: number) => {
      const el = ref.current;
      if (!el) return;
      pos.current += ((now - last) * speed) / 1000;
      el.scrollTop = pos.current;
      if (el.scrollTop >= el.scrollHeight - el.clientHeight - 1) setRunning(false);
      else frame = requestAnimationFrame(tick);
      last = now;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [running, speed, blocked]);
  useLayoutEffect(() => {
    pos.current = 0;
    if (ref.current) ref.current.scrollTop = 0;
    setRunning(false);
  }, [sceneId]);
  return (
    <section className="script-bar" aria-label="Teleprompter">
      <h1 className="sr-only">Your ideas, in frame</h1>
      <div className="script-bar-label" title={sceneName}>
        <AlignLeft size={15} />
        <span>Script</span>
        <small>{sceneName}</small>
      </div>
      <div
        className="script-bar-reader"
        ref={ref}
        role="region"
        aria-label="Script reading area"
        tabIndex={0}
        style={{ fontSize }}
        onWheel={() => setRunning(false)}
        onKeyDown={(event) => {
          if (
            [' ', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].includes(event.key)
          ) {
            event.stopPropagation();
            setRunning(false);
          }
        }}
        onScroll={() => {
          if (!running) pos.current = ref.current?.scrollTop || 0;
        }}
      >
        {script.trim() ? (
          script.split('\n\n').map((text, index) => <p key={index}>{text}</p>)
        ) : (
          <p className="empty-script">Choose Edit script to add your words.</p>
        )}
      </div>
      <div className="script-bar-actions">
        <IconButton
          label="Restart teleprompter"
          className="script-restart"
          disabled={!script.trim()}
          onClick={() => {
            if (ref.current) ref.current.scrollTop = 0;
            pos.current = 0;
          }}
        >
          <RotateCcw size={14} />
        </IconButton>
        <IconButton
          label={running ? 'Pause scrolling' : 'Auto-scroll'}
          active={running}
          disabled={!script.trim()}
          onClick={() => setRunning((value) => !value)}
        >
          {running ? <Pause size={15} /> : <Play size={15} />}
        </IconButton>
        <IconButton
          label="Edit script"
          onClick={() => {
            setRunning(false);
            onEdit();
          }}
        >
          <PencilLine size={15} />
        </IconButton>
        <IconButton label="Close script" onClick={onClose}>
          <X size={16} />
        </IconButton>
      </div>
    </section>
  );
}
