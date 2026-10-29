import { useCallback, useEffect, useRef, useState } from 'react';
type BrowserStatus = 'idle' | 'connecting' | 'ready' | 'error';
export function useWebsiteBrowser(onLost: () => void) {
  const [status, setStatus] = useState<BrowserStatus>('idle');
  const [message, setMessage] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [pageInfo, setPageInfo] = useState({ url: '', title: '', expiresAt: 0 });
  const canvas = useRef<HTMLCanvasElement | undefined>(undefined);
  const socket = useRef<WebSocket | undefined>(undefined);
  const generation = useRef(0);
  const lost = useRef(onLost);
  lost.current = onLost;
  const deliberate = useRef(false);
  useEffect(() => {
    let live = true;
    void fetch(`${import.meta.env.BASE_URL}browser-config.json`, { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : null))
      .then((config) => {
        const configured = import.meta.env.VITE_BROWSER_SERVICE_URL || config?.endpoint;
        if (!live || !configured) return;
        const url = new URL(configured);
        if (
          url.username ||
          url.password ||
          (url.protocol !== 'https:' &&
            !(['localhost', '127.0.0.1'].includes(url.hostname) && url.protocol === 'http:'))
        )
          return;
        setEndpoint(url.href);
      })
      .catch(() => {});
    return () => {
      live = false;
      generation.current++;
      deliberate.current = true;
      socket.current?.close();
    };
  }, []);
  const disconnect = useCallback(() => {
    deliberate.current = true;
    generation.current++;
    socket.current?.close();
    socket.current = undefined;
    setStatus('idle');
    setMessage('');
    canvas.current = undefined;
  }, []);
  const send = useCallback((value: Record<string, unknown>) => {
    if (socket.current?.readyState === WebSocket.OPEN) socket.current.send(JSON.stringify(value));
  }, []);
  const connect = useCallback(
    (url: string) => {
      disconnect();
      if (!endpoint) {
        setStatus('error');
        setMessage('The live browser service is unavailable. Share a website tab to continue.');
        return;
      }
      const token = generation.current;
      deliberate.current = false;
      setStatus('connecting');
      setMessage('Starting the mobile browser…');
      const destination = new URL(endpoint);
      destination.protocol = destination.protocol === 'https:' ? 'wss:' : 'ws:';
      destination.pathname = '/stream';
      const ws = new WebSocket(destination);
      ws.binaryType = 'blob';
      socket.current = ws;
      let navigated = false,
        hasFrame = false,
        decoding = false;
      const ready = () => {
        if (navigated && hasFrame) {
          setStatus('ready');
          setMessage('');
          clearTimeout(timer);
        }
      };
      const timer = setTimeout(() => {
        if (!(navigated && hasFrame) && generation.current === token) {
          setStatus('error');
          setMessage('The browser is taking too long to start. Retry or share the website tab.');
          ws.close();
        }
      }, 60000);
      ws.onopen = () => ws.send(JSON.stringify({ type: 'start', url }));
      ws.onmessage = async (event) => {
        if (token !== generation.current) return;
        if (typeof event.data === 'string') {
          let data;
          try {
            data = JSON.parse(event.data);
          } catch {
            return;
          }
          if (data.type === 'ready') {
            navigated = true;
            setPageInfo({ url: data.url, title: data.title, expiresAt: data.expiresAt || 0 });
            ready();
          } else if (data.type === 'status') setMessage(data.message);
          else if (data.type === 'error' || data.type === 'expired') {
            clearTimeout(timer);
            setStatus('error');
            setMessage(data.message);
            lost.current();
          }
          return;
        }
        if (decoding) return;
        decoding = true;
        try {
          const frame = await createImageBitmap(event.data);
          if (token !== generation.current) {
            frame.close();
            return;
          }
          const target = canvas.current || document.createElement('canvas');
          if (target.width !== frame.width || target.height !== frame.height) {
            target.width = frame.width;
            target.height = frame.height;
          }
          target.getContext('2d')!.drawImage(frame, 0, 0);
          frame.close();
          canvas.current = target;
          hasFrame = true;
          ready();
        } catch {
          /* The next complete frame can recover a dropped decode. */
        } finally {
          decoding = false;
        }
      };
      ws.onerror = () => {
        if (token === generation.current) {
          setStatus('error');
          setMessage('The browser service could not be reached. Retry or share a website tab.');
        }
      };
      ws.onclose = () => {
        clearTimeout(timer);
        if (token !== generation.current || deliberate.current) return;
        setStatus('error');
        setMessage(
          'The live browser disconnected. Your recording is paused. Reconnect to continue.',
        );
        lost.current();
      };
    },
    [disconnect, endpoint],
  );
  return {
    status,
    message,
    available: !!endpoint,
    frame: canvas.current,
    pageInfo,
    connect,
    disconnect,
    send,
  };
}
