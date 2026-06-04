import { useEffect, useRef } from "react";
import { Volume2, VolumeX } from "lucide-react";

/**
 * Helper para emitir un pitido sintetizado (Web Audio API)
 * como respaldo si no carga el archivo de sonido MP3.
 */
const playFallbackBeep = () => {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // Tono alto 880Hz
    gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);

    oscillator.start();
    // Pitido corto doble
    setTimeout(() => {
      oscillator.stop();
      
      // Segundo pitido
      const osc2 = audioCtx.createOscillator();
      const gain2 = audioCtx.createGain();
      osc2.connect(gain2);
      gain2.connect(audioCtx.destination);
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(1046.5, audioCtx.currentTime); // Do alto (C6)
      gain2.gain.setValueAtTime(0.5, audioCtx.currentTime);
      osc2.start();
      setTimeout(() => osc2.stop(), 150);
    }, 150);
  } catch (e) {
    console.warn("No se pudo iniciar Web Audio API:", e);
  }
};

export const SoundNotification = ({ pendingCount, isMuted, setIsMuted }) => {
  const prevCountRef = useRef(pendingCount);
  const audioRef = useRef(null);

  useEffect(() => {
    // Si la cantidad de pedidos pendientes aumenta
    if (pendingCount > prevCountRef.current) {
      if (!isMuted) {
        if (audioRef.current) {
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch((err) => {
            console.warn("Autoplay bloqueado por el navegador. Usando fallback beep.", err);
            playFallbackBeep();
          });
        } else {
          playFallbackBeep();
        }
      }
    }
    prevCountRef.current = pendingCount;
  }, [pendingCount, isMuted]);

  return (
    <div className="flex items-center gap-2 bg-[#1e1e1e] border border-white/10 rounded-full px-4 py-2 text-white">
      <audio ref={audioRef} src="/notification.mp3" preload="auto" />
      <span className="text-sm font-medium text-white/80">
        Pedidos Pendientes: <strong className="text-[#ffd79b]">{pendingCount}</strong>
      </span>
      <button
        onClick={() => setIsMuted(!isMuted)}
        className={`p-1.5 rounded-full transition-colors cursor-pointer ${
          isMuted 
            ? "bg-[#e23636]/20 text-[#e23636] hover:bg-[#e23636]/30" 
            : "bg-[#ffd79b]/10 text-[#ffd79b] hover:bg-[#ffd79b]/20"
        }`}
        title={isMuted ? "Activar Sonido" : "Silenciar"}
      >
        {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
      </button>
    </div>
  );
};
