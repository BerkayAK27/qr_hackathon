"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
  X,
  Loader2,
  Shield,
  Info,
  Menu,
  Image as ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

// ——— Types ———
interface ScanResult { raw: string; parsedId?: string; isCumulocity: boolean; payload?: any }

// ——— Utilities ———
const useInterval = (callback: () => void, delay: number | null) => {
  const saved = useRef(callback);
  useEffect(() => { saved.current = callback; }, [callback]);
  useEffect(() => {
    if (delay === null) return;
    const id = setInterval(() => saved.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
};

const Corner = ({ className = "" }) => (
  <div className={`absolute w-8 h-8 border-2 rounded-none ${className}`} style={{ borderColor: "currentColor" }} />
);

// ——— Components ———
function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const nav = [
    { href: "/", label: "Home" },
    { href: "/scan", label: "Scan" },

  ];

  return (
    <div className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="mx-auto max-w-6xl px-4">
        <div className="flex h-14 items-center justify-between">
          {/* Brand */}
          <Link href="/" className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 grid place-items-center shadow-sm">
              <QrCode className="h-4 w-4 text-white" />
            </div>
            <div className="hidden sm:block">
              <div className="font-semibold leading-tight">Akkan Device Hub</div>
              <div className="text-xs text-slate-500">Cumulocity Connector</div>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {nav.map((n) => {
              const active = pathname === n.href;
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`relative rounded-lg px-3 py-2 text-sm hover:bg-slate-100 transition ${active ? "text-blue-700" : "text-slate-600"}`}
                >
                  {n.label}
                  {active && (
                    <span className="absolute left-3 right-3 -bottom-[1px] h-[2px] bg-gradient-to-r from-blue-600 via-sky-500 to-indigo-600 rounded-full" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Right actions */}
          <div className="hidden md:flex items-center gap-2">
            <Button size="sm" className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-600/90 hover:to-indigo-600/90">Neuer Scan</Button>
          </div>

          {/* Mobile toggle */}
          <button onClick={() => setOpen((v) => !v)} className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-700">
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Mobile sheet */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="md:hidden overflow-hidden border-t border-slate-200 bg-white"
          >
            <div className="mx-auto max-w-6xl px-4 py-3 flex flex-col gap-2">
              {nav.map((n) => {
                const active = pathname === n.href;
                return (
                  <Link key={n.href} href={n.href} onClick={() => setOpen(false)} className={`rounded-lg px-3 py-2 text-sm ${active ? "text-blue-700 bg-blue-50" : "text-slate-700 hover:bg-slate-100"}`}>
                    {n.label}
                  </Link>
                );
              })}
              <div className="flex items-center justify-between pt-2">
                <div className="text-xs text-slate-500 flex items-center gap-1"><Shield className="h-3.5 w-3.5" /> privacy-first</div>
                <Button size="sm" className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white" onClick={() => setOpen(false)}>Neuer Scan</Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Accent bar */}
      <div className="h-[3px] w-full bg-gradient-to-r from-blue-500 via-sky-500 to-indigo-500" />
    </div>
  );
}

// ——— Page ———
export default function ScanPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);

  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string | undefined>();
  const [hasCamera, setHasCamera] = useState(true);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [frameReady, setFrameReady] = useState(false);
  const [scanning, setScanning] = useState(true);

  const [result, setResult] = useState<ScanResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [barcodeSupported, setBarcodeSupported] = useState(false);
  const [manualId, setManualId] = useState("");
  const [payloadText, setPayloadText] = useState("");

  useEffect(() => { setBarcodeSupported(typeof (window as any).BarcodeDetector !== "undefined"); }, []);

  // Auto-dismiss success toast after a short delay
  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(null), 2800);
    return () => clearTimeout(t);
  }, [success]);

  // Init camera
  useEffect(() => {
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        streamRef.current = stream;
        const track = stream.getVideoTracks()[0];
        trackRef.current = track;
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); setFrameReady(true); }
        const caps = track.getCapabilities?.();
        setTorchSupported(!!(caps && (caps as any).torch));
        const all = await navigator.mediaDevices.enumerateDevices();
        const cams = all.filter(d => d.kind === "videoinput");
        setDevices(cams);
        const back = cams.find(d => /back|rear|environment/i.test(d.label));
        setDeviceId(back?.deviceId || cams[0]?.deviceId);
      } catch (e) {
        console.error(e);
        setHasCamera(false);
        setError("Kamera konnte nicht gestartet werden. Erlaube Zugriff oder nutze Datei/Manuell.");
      }
    })();
    return () => { streamRef.current?.getTracks().forEach(t => t.stop()); };
  }, []);

  const switchCamera = async () => {
    if (!devices.length) return;
    const idx = devices.findIndex(d => d.deviceId === deviceId);
    const next = devices[(idx + 1) % devices.length];
    await startWithDevice(next.deviceId);
  };

  const startWithDevice = async (id?: string) => {
    try {
      setDeviceId(id);
      streamRef.current?.getTracks().forEach(t => t.stop());
      const s = await navigator.mediaDevices.getUserMedia({ video: { deviceId: id ? { exact: id } : undefined }, audio: false });
      streamRef.current = s;
      const track = s.getVideoTracks()[0];
      trackRef.current = track;
      const caps = track.getCapabilities?.();
      setTorchSupported(!!(caps && (caps as any).torch));
      if (videoRef.current) { videoRef.current.srcObject = s; await videoRef.current.play(); }
    } catch (e) {
      console.error(e);
      setError("Kamerawechsel fehlgeschlagen.");
    }
  };

  const toggleTorch = async () => {
    try {
      const track = trackRef.current; if (!track?.applyConstraints) return;
      const next = !torchOn;
      await track.applyConstraints({ advanced: [{ torch: next }] as any });
      setTorchOn(next);
    } catch (e) {
      console.error(e);
      setError("Taschenlampe nicht verfügbar.");
    }
  };

  // Decode loop
  useInterval(async () => {
    if (!scanning || !videoRef.current || !frameReady || !barcodeSupported) return;
    try {
      const detector = new (window as any).BarcodeDetector({ formats: ["qr_code"] });
      const codes = await detector.detect(videoRef.current);
      if (codes?.length) handleRaw(codes[0].rawValue || "");
    } catch {}
  }, 170);

  const tryParse = (raw: string): ScanResult => {
    let isC8y = false, id: string | undefined, payload: any;
    try {
      payload = JSON.parse(raw);
      if (payload?.check === "cumulocity") { isC8y = true; id = payload.id; }
    } catch {}
    return { raw, parsedId: id, isCumulocity: isC8y, payload };
  };

  const registerDevice = async (id: string) => {
    setSuccess(null);
    try {
      const res = await fetch("/api/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      if (!res.ok) { const data = await res.json().catch(() => ({})); throw new Error(data?.error || `Registrierung fehlgeschlagen (${res.status}).`); }
      setSuccess(`Gerät ${id} erfolgreich registriert.`);
      setScanning(false);
    } catch (e: any) { setError(e?.message || "Registrierung fehlgeschlagen."); }
  };

  const handleRaw = async (raw: string) => {
    if (busy) return; setBusy(true); setError(null);
    try {
      const parsed = tryParse(raw); setResult(parsed);
      if (!parsed.isCumulocity) { setError("Kein gültiger Cumulocity-QR. Du kannst auch manuell registrieren."); return; }
      await registerDevice(parsed.parsedId!);
    } finally { setBusy(false); }
  };

  // Image upload
  const hiddenFile = useRef<HTMLInputElement | null>(null);
  const onImageSelected = async (file?: File) => {
    if (!file) return; setError(null);
    try {
      const bitmap = await createImageBitmap(file);
      if (barcodeSupported) {
        const detector = new (window as any).BarcodeDetector({ formats: ["qr_code"] });
        const codes = await detector.detect(bitmap as any);
        if (codes?.length) { await handleRaw(codes[0].rawValue || ""); return; }
      }
      setError("QR konnte nicht erkannt werden. Bitte erneut versuchen oder manuell eingeben.");
    } catch { setError("Bild konnte nicht verarbeitet werden."); }
  };

  const onManual = async (e: React.FormEvent) => { e.preventDefault(); if (!manualId.trim()) return setError("Bitte eine ID eingeben."); await registerDevice(manualId.trim()); };
  const onPayload = async () => { if (!payloadText.trim()) return; await handleRaw(payloadText.trim()); };
  const reset = () => { setScanning(true); setSuccess(null); setError(null); setResult(null); };

  // ——— UI ———
  return (
    <div className="min-h-[100dvh] bg-white text-slate-900">
      <Navbar />

      {/* Hero strip */}
      <div className="bg-gradient-to-r from-blue-50 via-sky-50 to-indigo-50 border-b border-slate-200/60">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Gerät per QR-Code verbinden</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">Scanne einen Cumulocity-QR (<code className="bg-white border px-1 py-0.5 rounded">{"{\"id\":\"u256172\",\"check\":\"cumulocity\"}"}</code>) oder nutze die Alternativen. Blau-Akzente führen visuell durch den Flow.</p>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8 grid grid-cols-1 lg:grid-cols-3 gap-5 lg:gap-6">
        {/* Left column: scanner card */}
        <Card className="lg:col-span-2 overflow-hidden border-slate-200">
          <div className="relative">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-500 via-sky-500 to-indigo-500" />
          </div>
          <CardContent className="pt-5">
            <div className="relative rounded-2xl border border-slate-200 bg-slate-950 aspect-[4/3] sm:aspect-[16/9] overflow-hidden">
              {hasCamera ? (
                <>
                  <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
                  {/* framing */}
                  <div className="pointer-events-none absolute inset-0 grid place-items-center">
                    <div className="relative h-56 w-56 sm:h-64 sm:w-64 text-blue-300/70">
                      <Corner className="left-0 top-0 rounded-tl-2xl" />
                      <Corner className="right-0 top-0 rounded-tr-2xl" />
                      <Corner className="left-0 bottom-0 rounded-bl-2xl" />
                      <Corner className="right-0 bottom-0 rounded-br-2xl" />
                      <motion.div
                        className="absolute left-6 right-6 top-1/2 h-[2px] bg-gradient-to-r from-blue-400 via-sky-300 to-indigo-400"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1, y: [0, -92, 92, 0] }}
                        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-slate-50">
                  <div className="flex flex-col items-center gap-2 text-slate-500">
                    <CameraOff className="h-8 w-8" />
                    <p>Keine Kamera verfügbar. Bitte Bild hochladen oder ID manuell eingeben.</p>
                  </div>
                </div>
              )}

              {/* Badges */}
              <div className="absolute left-3 top-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-slate-900/70 px-3 py-1 text-xs text-white backdrop-blur border border-slate-700/50">
                  {barcodeSupported ? "BarcodeDetector aktiv" : "Fallback-Modus"}
                </span>
                {torchSupported && (
                  <span className="rounded-full bg-slate-900/70 px-3 py-1 text-xs text-white border border-slate-700/50">Torch</span>
                )}
              </div>

              <AnimatePresence>
                {busy && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 grid place-items-center bg-slate-900/30 backdrop-blur-sm">
                    <Loader2 className="h-8 w-8 animate-spin text-white" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Controls row */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button variant="secondary" size="sm" onClick={switchCamera} disabled={!devices.length} className="touch-manipulation border-slate-300">
                <RotateCw className="mr-2 h-4 w-4" /> Kamera wechseln
              </Button>
              <Button variant="secondary" size="sm" onClick={toggleTorch} disabled={!torchSupported} className="touch-manipulation border-slate-300">
                <Flashlight className="mr-2 h-4 w-4" /> Taschenlampe
              </Button>
              <label className="inline-flex">
                <input ref={hiddenFile} type="file" accept="image/*" className="hidden" onChange={(e) => onImageSelected(e.target.files?.[0])} />
                <Button type="button" variant="secondary" size="sm" className="touch-manipulation border-slate-300">
                  <Upload className="mr-2 h-4 w-4" /> Bild hochladen
                </Button>
              </label>
            </div>

            {/* Helper / tip moved below controls */}
            <div className="mt-3 flex items-center justify-between">
              <AnimatePresence>
                {error && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2 text-red-600">
                    <XCircle className="h-4 w-4" /> <span className="text-sm">{error}</span>
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="text-xs text-slate-500 mt-5">Tipp: <kbd className="rounded border bg-white px-1">U</kbd> lädt ein Bild hoch</div>
            </div>

            {success && (
              <></>
            )}
          </CardContent>
        </Card>

        {/* Right column: tabs with alternatives */}
        <Card className="border-slate-200 overflow-hidden">
          <div className="h-1 w-full bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-500" />
          <CardContent className="pt-5">
            <Tabs defaultValue="manual">
              <TabsList className="grid grid-cols-2 w-full bg-slate-100">
                <TabsTrigger value="manual" className="data-[state=active]:bg-white data-[state=active]:text-blue-700">Manuell</TabsTrigger>
                <TabsTrigger value="payload" className="data-[state=active]:bg-white data-[state=active]:text-blue-700">Payload</TabsTrigger>
              </TabsList>

              <TabsContent value="manual" className="mt-4 space-y-3">
                <Label htmlFor="manualId" className="text-slate-900">ID manuell eingeben</Label>
                <div className="flex items-center gap-2">
                  <Input id="manualId" placeholder="z. B. u256172" value={manualId} onChange={(e) => setManualId(e.target.value)} className="bg-white border-slate-300" />
                  <Button onClick={onManual} className="bg-blue-600 hover:bg-blue-600/90">Registrieren</Button>
                </div>
                <p className="text-xs text-slate-500">Nur die <span className="font-medium">id</span> wird an <code>/api/register</code> gesendet.</p>
              </TabsContent>

              <TabsContent value="payload" className="mt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="payload" className="text-slate-900 flex items-center gap-2"><ImageIcon className="h-4 w-4" /> QR-Payload einfügen</Label>
                  <Button type="button" size="sm" variant="secondary" onClick={() => setPayloadText('{"id":"u256172","check":"cumulocity"}')} className="border-slate-300">Beispiel</Button>
                </div>
                <Textarea id="payload" placeholder='{"id":"u256172","check":"cumulocity"}' value={payloadText} onChange={(e) => setPayloadText(e.target.value)} className="min-h-[96px] bg-white border-slate-300" />
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" className="bg-blue-600 hover:bg-blue-600/90" onClick={onPayload}>Payload verarbeiten</Button>
                  <Button type="button" variant="ghost" onClick={() => setPayloadText("")}>Leeren</Button>
                </div>
                <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-3 text-xs text-slate-700">
                  <div className="flex items-start gap-2">
                    <Info className="mt-0.5 h-4 w-4 text-blue-600" />
                    <p>Erwartetes Format: <code className="bg-white px-1 py-0.5 rounded border">{"{ \"id\": \"<DEVICE_ID>\", \"check\": \"cumulocity\" }"}</code>.</p>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <div className="mt-6 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-slate-700">
                <span>Automatisch weiter scannen</span>
                <Switch checked={scanning} onCheckedChange={setScanning} />
              </div>
            </div>
          </CardContent>
          <CardFooter>
              <div className="text-xs text-slate-500">Sicherheit: Kamera bleibt lokal</div>

          </CardFooter>
        </Card>
      </div>

      {/* Success toast moved outside of camera, fixed bottom-right */}
      <AnimatePresence>
        {success && (
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            className="fixed bottom-4 right-4 z-40"
          >
            <div className="flex items-center gap-3 rounded-2xl bg-emerald-600/20 px-4 py-2 text-emerald-900 backdrop-blur border border-emerald-700/20 shadow-lg">
              <CheckCircle2 className="h-6 w-6" />
              <span className="text-sm font-medium">{success}</span>
              <button className="ml-1 rounded-md p-1 text-emerald-900/80 hover:bg-emerald-900/10" onClick={() => setSuccess(null)}>
                <X className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="mx-auto max-w-6xl px-4 pb-8 pt-2 text-xs text-slate-500 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2"><Shield className="h-4 w-4" /> Made by Akkan Group.</div>
        <div className="ml-auto flex items-center gap-2 text-xs text-slate-500">
                <Shield className="h-4 w-4" /> Kamera-Daten verlassen deinen Browser nicht
              </div>
      </footer>

      {/* Hidden uploader activation with U */}
      <input ref={hiddenFile} type="file" accept="image/*" className="hidden" onChange={(e) => onImageSelected(e.target.files?.[0])} />
      {typeof window !== "undefined" && (<Shortcut onU={() => hiddenFile.current?.click()} />)}
    </div>
  );
}

// Small helper to register window key listener without SSR issues
function Shortcut({ onU }: { onU: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "u" || e.key === "U") onU(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onU]);
  return null;
}
