'use client';

import { useRef, useState, useEffect } from 'react';
import { X, Save, Trash2 } from 'lucide-react';

export default function DrawingModal({ onClose, onSave }: { onClose: () => void, onSave: (base64: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [ctx, setCtx] = useState<CanvasRenderingContext2D | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    
    // Defer to ensure layout is complete before getting dimensions
    requestAnimationFrame(() => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      const context = canvas.getContext('2d');
      if (context) {
        context.lineCap = 'round';
        context.lineJoin = 'round';
        context.lineWidth = 3;
        context.strokeStyle = '#0ea5e9'; // Accent color
        setCtx(context);
      }
    });

    // Optional: handle window resize, but modal is fixed mostly
  }, []);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!ctx || !canvasRef.current) return;
    setIsDrawing(true);
    ctx.beginPath();
    const rect = canvasRef.current.getBoundingClientRect();
    const x = ('clientX' in e ? e.clientX : e.touches[0].clientX) - rect.left;
    const y = ('clientY' in e ? e.clientY : e.touches[0].clientY) - rect.top;
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !ctx || !canvasRef.current) return;
    e.preventDefault(); // Prevent scrolling on touch
    const rect = canvasRef.current.getBoundingClientRect();
    const x = ('clientX' in e ? e.clientX : e.touches[0].clientX) - rect.left;
    const y = ('clientY' in e ? e.clientY : e.touches[0].clientY) - rect.top;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!ctx) return;
    ctx.closePath();
    setIsDrawing(false);
  };

  const handleSave = () => {
    if (!canvasRef.current) return;
    // Extract as PNG
    const dataUrl = canvasRef.current.toDataURL('image/png');
    onSave(dataUrl);
  };

  const handleClear = () => {
    if (!ctx || !canvasRef.current) return;
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--bg-base)', borderRadius: 'var(--radius-xl)', padding: 24, width: '90%', maxWidth: 800, height: '80vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-display)' }}>Çizim Tahtası</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={handleClear}><Trash2 size={16} /> Temizle</button>
            <button className="btn btn-primary btn-sm" onClick={handleSave}><Save size={16} /> Kaydet ve Ekle</button>
            <button className="btn-icon" onClick={onClose}><X size={18} /></button>
          </div>
        </div>
        <div style={{ flex: 1, background: '#ffffff', borderRadius: 'var(--radius-lg)', border: '2px dashed var(--border)', overflow: 'hidden' }}>
          <canvas
            ref={canvasRef}
            style={{ width: '100%', height: '100%', cursor: 'crosshair', touchAction: 'none' }}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
          />
        </div>
        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-3)', textAlign: 'center' }}>
          Fare veya dokunmatik ekran ile çizim yapabilirsiniz. "Kaydet ve Ekle" diyerek nota resim olarak ekleyin.
        </div>
      </div>
    </div>
  );
}
