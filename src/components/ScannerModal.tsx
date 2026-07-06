'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

// Formats covering VINs (Code39/128/DataMatrix) and parts (Code128, EAN, QR, UPC)
const VIN_FORMATS = ['code_128', 'code_39', 'data_matrix'];
const PART_FORMATS = ['code_128', 'code_39', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'qr_code', 'data_matrix'];

export { VIN_FORMATS, PART_FORMATS };

interface ScannerModalProps {
  formats?: string[];
  title?: string;
  hint?: string;
  onScan: (value: string) => void;
  onClose: () => void;
}

export default function ScannerModal({
  formats = PART_FORMATS,
  title = 'Scan Barcode',
  hint = 'Point camera at barcode — auto-captures on detection',
  onScan,
  onClose,
}: ScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const detectorRef = useRef<any>(null);
  const [status, setStatus] = useState<'starting' | 'scanning' | 'unsupported' | 'denied' | 'error'>('starting');
  const [errMsg, setErrMsg] = useState('');
  const scannedRef = useRef(false);

  const cleanup = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !('BarcodeDetector' in window)) {
      setStatus('unsupported');
      return;
    }

    let alive = true;

    async function start() {
      try {
        detectorRef.current = new (window as any).BarcodeDetector({ formats });

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (!alive) { stream.getTracks().forEach(t => t.stop()); return; }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          if (alive) { setStatus('scanning'); scheduleDetect(); }
        }
      } catch (err: unknown) {
        if (!alive) return;
        if (err instanceof Error && err.name === 'NotAllowedError') {
          setStatus('denied');
        } else {
          setStatus('error');
          setErrMsg(err instanceof Error ? err.message : String(err));
        }
      }
    }

    function scheduleDetect() {
      rafRef.current = requestAnimationFrame(detect);
    }

    function detect() {
      if (!alive || scannedRef.current || !videoRef.current || !detectorRef.current) return;
      const video = videoRef.current;
      if (video.readyState < 2) { scheduleDetect(); return; }

      detectorRef.current.detect(video)
        .then((codes: any[]) => {
          if (!alive || scannedRef.current) return;
          if (codes.length > 0) {
            scannedRef.current = true;
            cleanup();
            onScan(codes[0].rawValue);
          } else {
            scheduleDetect();
          }
        })
        .catch(() => { if (alive) scheduleDetect(); });
    }

    start();

    return () => {
      alive = false;
      cleanup();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleClose() {
    cleanup();
    onClose();
  }

  const isLive = status === 'scanning';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{
        position: 'fixed', inset: 0, zIndex: 9100,
        background: 'rgba(0,0,0,0.9)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
      }}
    >
      {/* Header */}
      <div style={{
        width: '100%', maxWidth: 480,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '0.75rem',
      }}>
        <p style={{ color: '#fff', fontWeight: 700, fontSize: '1rem', letterSpacing: '-0.01em' }}>{title}</p>
        <button
          onClick={handleClose}
          aria-label="Close scanner"
          style={{
            background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff',
            width: 36, height: 36, borderRadius: '50%', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.1rem', lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>

      {/* Viewfinder */}
      <div style={{
        position: 'relative', width: '100%', maxWidth: 480,
        aspectRatio: '4 / 3', borderRadius: '1rem', overflow: 'hidden',
        background: '#111',
        boxShadow: '0 0 0 1px rgba(255,255,255,0.12)',
      }}>
        {/* Live video — always mounted so browser can stream */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            width: '100%', height: '100%', objectFit: 'cover',
            display: isLive ? 'block' : 'none',
          }}
        />

        {/* Targeting reticle (scanning state only) */}
        {isLive && (
          <svg
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            {/* Vignette borders */}
            <rect x="0"  y="0"  width="100" height="18" fill="rgba(0,0,0,0.4)" />
            <rect x="0"  y="82" width="100" height="18" fill="rgba(0,0,0,0.4)" />
            <rect x="0"  y="18" width="13" height="64"  fill="rgba(0,0,0,0.4)" />
            <rect x="87" y="18" width="13" height="64"  fill="rgba(0,0,0,0.4)" />

            {/* Corner marks */}
            {([
              [[13,18],[21,18]], [[13,18],[13,26]],
              [[87,18],[79,18]], [[87,18],[87,26]],
              [[13,82],[21,82]], [[13,82],[13,74]],
              [[87,82],[79,82]], [[87,82],[87,74]],
            ] as [[number,number],[number,number]][]).map(([[x1,y1],[x2,y2]], i) => (
              <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
                stroke="#22c55e" strokeWidth="1.8" strokeLinecap="round" />
            ))}

            {/* Animated scan line */}
            <line x1="13" y1="50" x2="87" y2="50"
              stroke="rgba(34,197,94,0.7)" strokeWidth="0.6">
              <animateTransform
                attributeName="transform" type="translate"
                values="0,-28; 0,28; 0,-28" dur="2.2s" repeatCount="indefinite"
              />
            </line>
          </svg>
        )}

        {/* Status overlays */}
        {status === 'starting' && (
          <Overlay icon="⏳" heading="Starting camera…" body="" />
        )}
        {status === 'unsupported' && (
          <Overlay
            icon="📷"
            heading="Scanner not supported"
            body="Use Chrome on Android or Safari 17.4+ on iOS. Enter the value manually instead."
          />
        )}
        {status === 'denied' && (
          <Overlay
            icon="🚫"
            heading="Camera access denied"
            body="Allow camera access in your browser settings, then try again."
          />
        )}
        {status === 'error' && (
          <Overlay
            icon="⚠️"
            heading="Camera error"
            body={errMsg || 'Could not start camera. Try reloading.'}
          />
        )}
      </div>

      {/* Hint */}
      <p style={{
        color: isLive ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.45)',
        fontSize: '0.8125rem', marginTop: '0.875rem', textAlign: 'center', maxWidth: 400,
      }}>
        {isLive ? hint : 'Close and enter the code manually.'}
      </p>
    </div>
  );
}

function Overlay({ icon, heading, body }: { icon: string; heading: string; body: string }) {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: '0.5rem', padding: '1.5rem', textAlign: 'center',
    }}>
      <span style={{ fontSize: '2.25rem', lineHeight: 1 }}>{icon}</span>
      <p style={{ color: '#fff', fontWeight: 700, fontSize: '0.9375rem' }}>{heading}</p>
      {body && <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.8125rem', maxWidth: 260 }}>{body}</p>}
    </div>
  );
}
