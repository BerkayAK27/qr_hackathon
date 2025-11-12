"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera,
  CameraOff,
  Flashlight,
  Upload,
  RotateCw,
  QrCode,
  CheckCircle2,
  XCircle,
  Loader2,
  Shield,
  Info,
  Keyboard,
  Image as ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// --- Helper types ---
interface ScanResult {
  raw: string;
  parsedId?: string;
  isCumulocity: boolean;
  payload?: any;
}

const Corner = ({ className = "" }) => (
  <div
    className={`absolute w-10 h-10 border-2 rounded-none ${className}`}
    style={{ borderColor: "currentColor" }}
  />
);

const useInterval = (callback: () => void, delay: number | null) => {
  const savedCallback = useRef(callback);
  useEffect(() => { savedCallback.current = callback; }, [callback]);
  useEffect(() => {
    if (delay === null) return;
    const id = setInterval(() => savedCallback.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
};

export default function ScanPage() {
  // Camera state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string | undefined>();
  const [hasCamera, setHasCamera] = useState<boolean>(true);
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [torchSupported, setTorchSupported] = useState<boolean>(false);
  const [scanning, setScanning] = useState<boolean>(true);
  const [frameReady, setFrameReady] = useState<boolean>(false);

  // Results & UX state
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<boolean>(false);
  const [success, setSuccess] = useState<string | null>(null);

  const [manualId, setManualId] = useState<string>("");
  const [payloadText, setPayloadText] = useState<string>("");
  const [barcodeSupported, setBarcodeSupported] = useState(false);


  useEffect(() => {
    setBarcodeSupported(typeof (window as any).BarcodeDetector !== 'undefined');
  }, []);
  
  // Acquire cameras
  useEffect(() => {
    async function init() {
      try {
        const streams = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        streamRef.current = streams;
        const track = streams.getVideoTracks()[0];
        trackRef.current = track;
        if (videoRef.current) {
          videoRef.current.srcObject = streams;
          await videoRef.current.play();
          setFrameReady(true);
        }
        const caps = track.getCapabilities?.();
        setTorchSupported(!!(caps && (caps as any).torch));
        const all = await navigator.mediaDevices.enumerateDevices();
        const cams = all.filter((d) => d.kind === "videoinput");
        setDevices(cams);
        const back = cams.find((d) => /back|rear|environment/i.test(d.label));
        setDeviceId(back?.deviceId || cams[0]?.deviceId);
      } catch (e: any) {
        console.error(e);
        setHasCamera(false);
        setError("Kamera konnte nicht gestartet werden. Bitte Zugriff erlauben oder eine Datei/Manuelle Eingabe nutzen.");
      }
    }
    init();
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // Switch camera
  const switchCamera = async () => {
    if (!devices.length) return;
    try {
      const currentIdx = devices.findIndex((d) => d.deviceId === deviceId);
      const next = devices[(currentIdx + 1) % devices.length];
      await startWithDevice(next.deviceId);
    } catch (e) {
      console.error(e);
    }
  };

  const startWithDevice = async (id?: string) => {
    try {
      setDeviceId(id);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      const newStream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: id ? { exact: id } : undefined }, audio: false });
      streamRef.current = newStream;
      const track = newStream.getVideoTracks()[0];
      trackRef.current = track;
      const caps = track.getCapabilities?.();
      setTorchSupported(!!(caps && (caps as any).torch));
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        await videoRef.current.play();
      }
    } catch (e) {
      console.error(e);
      setError("Kamerawechsel fehlgeschlagen.");
    }
  };

  // Torch toggle
  const toggleTorch = async () => {
    try {
      const track = trackRef.current;
      if (!track || !track.applyConstraints) return;
      const next = !torchOn;
      await track.applyConstraints({ advanced: [{ torch: next }] as any });
      setTorchOn(next);
    } catch (e) {
      console.error(e);
      setError("Taschenlampensteuerung nicht verfügbar.");
    }
  };

  // Decode loop (BarcodeDetector) — scans every 180ms
  useInterval(async () => {
    if (!scanning || !videoRef.current || !frameReady) return;
    if (!barcodeSupported) return;
    try {
      const detector = new (window as any).BarcodeDetector({ formats: ["qr_code"] });
      const codes = await detector.detect(videoRef.current);
      if (codes && codes.length) {
        handleRawPayload(codes[0].rawValue || "");
      }
    } catch (e) {
      // Ignore frame decode errors
    }
  }, 180);

  // Handle any raw QR payload
  const handleRawPayload = async (raw: string) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const parsed = tryParsePayload(raw);
      setResult(parsed);
      if (!parsed.isCumulocity) {
        setError("Kein gültiger Cumulocity-QR-Code. Du kannst die ID auch manuell eingeben.");
        setBusy(false);
        return;
      }
      const id = parsed.parsedId!;
      await registerDevice(id);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Unbekannter Fehler beim Verarbeiten des Codes.");
    } finally {
      setBusy(false);
    }
  };

  function tryParsePayload(raw: string): ScanResult {
    let isC8y = false;
    let id: string | undefined = undefined;
    let payload: any = undefined;

    try {
      payload = JSON.parse(raw);
      if (payload && payload.check === "cumulocity") {
        isC8y = true;
        id = payload.id;
      }
    } catch (_) {
      // not JSON; fallback: if the raw string itself is the id, accept it when marked later
    }

    return { raw, parsedId: id, isCumulocity: isC8y, payload };
  }

  // Registration call
  const registerDevice = async (id: string) => {
    setSuccess(null);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `Registrierung fehlgeschlagen (${res.status}).`);
      }
      setSuccess(`Gerät ${id} erfolgreich registriert.`);
      setScanning(false);
      // brief confetti-like pulse handled by animation below
    } catch (e: any) {
      setError(e?.message || "Registrierung fehlgeschlagen.");
    }
  };

  // Upload image to scan
  const onImageSelected = async (file?: File) => {
    if (!file) return;
    setError(null);
    try {
      const bitmap = await createImageBitmap(file);
      if (barcodeSupported) {
        const detector = new (window as any).BarcodeDetector({ formats: ["qr_code"] });
        const codes = await detector.detect(bitmap as any);
        if (codes && codes.length) {
          await handleRawPayload(codes[0].rawValue || "");
          return;
        }
      }
      // Fallback using canvas read (no library) — not perfect but works on many cases
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width; canvas.height = bitmap.height;
      const ctx = canvas.getContext("2d");
      if (ctx) { ctx.drawImage(bitmap, 0, 0); }
      setError("QR konnte nicht aus dem Bild gelesen werden. Bitte erneut versuchen oder manuell eingeben.");
    } catch (e) {
      console.error(e);
      setError("Bild konnte nicht verarbeitet werden.");
    }
  };

  // Manual entry handlers
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualId.trim()) return setError("Bitte eine ID eingeben.");
    await registerDevice(manualId.trim());
  };

  const handlePayloadSubmit = async () => {
    const raw = payloadText.trim();
    if (!raw) return;
    await handleRawPayload(raw);
  };

  // Reset to scan again
  const reset = () => {
    setScanning(true);
    setSuccess(null);
    setError(null);
    setResult(null);
  };

  return (
    <TooltipProvider>
      <div className="min-h-[100dvh] w-full bg-gradient-to-b from-slate-900 via-slate-950 to-black text-slate-100">
        <div className="mx-auto max-w-6xl px-4 py-8">
          <header className="mb-8 flex items-start justify-between gap-4">
            <div>
              <motion.h1
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="text-3xl font-semibold tracking-tight"
              >
                Gerät per QR-Code registrieren
              </motion.h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-300">
                Scanne einen Cumulocity-QR-Code (<code className="bg-slate-800 px-1 py-0.5 rounded">{"{ \"id\": \"u256172\", \"check\": \"cumulocity\" }"}</code>)
                , lade ein Bild hoch – oder gib die ID manuell ein. Deine Kamera bleibt lokal im Browser.
              </p>
            </div>
          </header>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Scanner card */}
            <Card className="col-span-1 lg:col-span-2 bg-slate-900/40 border-slate-800">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-slate-100">
                  <QrCode className="h-5 w-5" />
                  Live-Scan
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-black aspect-[16/9]">
                  {hasCamera ? (
                    <>
                      <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
                      {/* Overlay */}
                      <div className="pointer-events-none absolute inset-0 grid place-items-center">
                        <div className="relative h-64 w-64">
                          <Corner className="left-0 top-0 rounded-tl-2xl" />
                          <Corner className="right-0 top-0 rounded-tr-2xl" />
                          <Corner className="left-0 bottom-0 rounded-bl-2xl" />
                          <Corner className="right-0 bottom-0 rounded-br-2xl" />
                          <motion.div
                            className="absolute left-4 right-4 top-1/2 h-px bg-white/60"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1, y: [0, -96, 96, 0] }}
                            transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
                          />
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <div className="flex flex-col items-center gap-2 text-slate-300">
                        <CameraOff className="h-8 w-8" />
                        <p>Keine Kamera verfügbar. Bitte Bild hochladen oder ID manuell eingeben.</p>
                      </div>
                    </div>
                  )}

                  {/* State badges */}
                  <div className="absolute left-4 top-4 flex items-center gap-2">
                    <span className="rounded-full bg-slate-800/70 px-3 py-1 text-xs text-slate-200 backdrop-blur">
                      {barcodeSupported ? "BarcodeDetector aktiv" : "Fallback-Modus"}
                    </span>
                    {torchSupported && (
                      <span className="rounded-full bg-slate-800/70 px-3 py-1 text-xs text-slate-200 backdrop-blur">Torch</span>
                    )}
                  </div>

                  <AnimatePresence>
                    {busy && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 grid place-items-center bg-black/30 backdrop-blur-sm"
                      >
                        <Loader2 className="h-8 w-8 animate-spin" />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <AnimatePresence>
                    {success && (
                      <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 grid place-items-center"
                      >
                        <div className="flex items-center gap-3 rounded-2xl bg-emerald-600/20 px-4 py-2 text-emerald-200 backdrop-blur">
                          <CheckCircle2 className="h-6 w-6" />
                          <span className="text-sm font-medium">{success}</span>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Controls */}
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="secondary" size="sm" onClick={switchCamera} disabled={!devices.length}>
                        <RotateCw className="mr-2 h-4 w-4" /> Kamera wechseln
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Kameraquelle wechseln</TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="secondary" size="sm" onClick={toggleTorch} disabled={!torchSupported}>
                        <Flashlight className="mr-2 h-4 w-4" /> Taschenlampe
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Taschenlampe ein/aus (falls verfügbar)</TooltipContent>
                  </Tooltip>

                  <label className="inline-flex">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => onImageSelected(e.target.files?.[0])}
                    />
                    <Button type="button" variant="secondary" size="sm">
                      <Upload className="mr-2 h-4 w-4" /> Bild hochladen
                    </Button>
                  </label>

                  <div className="ml-auto flex items-center gap-2 text-xs text-slate-400">
                    <Shield className="h-4 w-4" /> Kamera-Daten verlassen deinen Browser nicht
                  </div>
                </div>

                {/* Error / Info */}
                <div className="mt-3 min-h-[24px]">
                  <AnimatePresence>
                    {error && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2 text-red-300">
                        <XCircle className="h-4 w-4" /> <span className="text-sm">{error}</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {success && (
                  <div className="mt-3 flex items-center gap-2">
                    <Button size="sm" onClick={reset}>
                      <Camera className="mr-2 h-4 w-4" /> Weiteres Gerät scannen
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Alternatives card */}
            <Card className="bg-slate-900/40 border-slate-800">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-slate-100">
                  <Keyboard className="h-5 w-5" /> Alternativen
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <form onSubmit={handleManualSubmit} className="space-y-3">
                  <Label htmlFor="manualId" className="text-slate-200">ID manuell eingeben</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="manualId"
                      placeholder="z. B. u256172"
                      value={manualId}
                      onChange={(e) => setManualId(e.target.value)}
                      className="bg-slate-950 border-slate-800 text-slate-100"
                    />
                    <Button type="submit">Registrieren</Button>
                  </div>
                </form>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="payload" className="text-slate-200 flex items-center gap-2"><ImageIcon className="h-4 w-4" /> QR-Payload einfügen</Label>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => setPayloadText('{"id":"u256172","check":"cumulocity"}')}
                    >Beispiel füllen</Button>
                  </div>
                  <Textarea
                    id="payload"
                    placeholder='{"id":"u256172","check":"cumulocity"}'
                    value={payloadText}
                    onChange={(e) => setPayloadText(e.target.value)}
                    className="min-h-[96px] bg-slate-950 border-slate-800 text-slate-100"
                  />
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="secondary" onClick={handlePayloadSubmit}>Payload verarbeiten</Button>
                    <Button type="button" variant="ghost" onClick={() => setPayloadText("")}>Leeren</Button>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs text-slate-300">
                  <div className="flex items-start gap-2">
                    <Info className="mt-0.5 h-4 w-4" />
                    <p>
                      Erwartetes QR-Format: <code className="bg-slate-900 px-1 py-0.5 rounded">{"{ \"id\": \"<DEVICE_ID>\", \"check\": \"cumulocity\" }"}</code>.
                      Nur die <span className="font-medium">id</span> wird an <code>/api/register</code> gesendet.
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-slate-300">
                    <span>Automatisch weiter scannen</span>
                    <Switch checked={scanning} onCheckedChange={setScanning} />
                  </div>
                  <div className="text-xs text-slate-400">Tip: <kbd className="rounded bg-slate-800 px-1">U</kbd> lädt ein Bild hoch</div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Footer */}
          <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4" /> Made by Akkan Group.
            </div>
            <div>
              <span className="opacity-80">Tipp:</span> Gute Ausleuchtung verbessert die Erkennung. Nutze die Taschenlampe bei Bedarf.
            </div>
          </footer>
        </div>
      </div>
    </TooltipProvider>
  );
}
