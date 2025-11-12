"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  QrCode,
  Shield,
  ArrowRight,
  Gauge,
  ScanLine,
  Upload,
  Keyboard,
  CheckCircle2,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function Navbar() {
  const pathname = usePathname();
  const nav = [
    { href: "/", label: "Home" },
    { href: "/scan", label: "Scan" },
  ];
  return (
    <div className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="mx-auto max-w-6xl px-4">
        <div className="flex h-14 items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 grid place-items-center shadow-sm">
              <QrCode className="h-4 w-4 text-white" />
            </div>
            <div className="hidden sm:block">
              <div className="font-semibold leading-tight">Akkan Device Hub</div>
              <div className="text-xs text-slate-500">Cumulocity Connector</div>
            </div>
          </Link>
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
          <div className="hidden md:flex items-center gap-2">
            <div className="text-xs text-slate-500 hidden lg:flex items-center gap-1">
            </div>
            <Button asChild size="sm" className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-600/90 hover:to-indigo-600/90">
              <Link href="/scan">Jetzt scannen</Link>
            </Button>
          </div>
          <Link
            href="/scan"
            className="md:hidden inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-slate-700"
          >
            <ScanLine className="h-4 w-4" /> Scan
          </Link>
        </div>
      </div>
      <div className="h-[3px] w-full bg-gradient-to-r from-blue-500 via-sky-500 to-indigo-500" />
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="min-h-[100dvh] bg-white text-slate-900">
      <Navbar />

      {/* Hero */}
      <section className="bg-gradient-to-r from-blue-50 via-sky-50 to-indigo-50 border-b border-slate-200/60">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div>
              <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
                Geräte-QRs scannen & in Cumulocity registrieren
              </h1>
              <p className="mt-3 text-slate-600 max-w-prose">
                Schneller, sicherer Onboarding-Flow für neue Geräte. Kamera läuft lokal im Browser, nur die <code className="bg-white border px-1 py-0.5 rounded">id</code> wird an <code className="bg-white border px-1 py-0.5 rounded">/api/register</code> gesendet.
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Button asChild size="lg" className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-600/90 hover:to-indigo-600/90">
                  <Link href="/scan" className="inline-flex items-center gap-2">
                    Jetzt scannen <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Link href="/help" className="text-sm text-blue-700 hover:underline">Wie funktioniert das?</Link>
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
                <Shield className="h-4 w-4" /> Kamera-Daten verlassen deinen Browser nicht
              </div>
            </div>
            <div className="order-first md:order-last">
              <Card className="overflow-hidden border-slate-200">
                <div className="h-1 w-full bg-gradient-to-r from-blue-500 via-sky-500 to-indigo-500" />
                <CardHeader className="pb-2">
                  <CardTitle className="text-slate-900 text-base">Was wird gescannt?</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                    Erwartetes QR-Format:
                    <pre className="mt-2 rounded-lg bg-slate-50 p-3 border text-xs overflow-x-auto">{`{ "id": "u256172", "check": "cumulocity" }`}</pre>
                    <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                      <Info className="h-4 w-4" /> Nur <code className="bg-white border px-1 rounded">id</code> wird gesendet.
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section>
        <div className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="border-slate-200">
              <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Gauge className="h-4 w-4" /> Schnell starten</CardTitle></CardHeader>
              <CardContent className="text-sm text-slate-600">Kein Installationsaufwand. Browser öffnen, scannen, fertig.</CardContent>
            </Card>
            <Card className="border-slate-200">
              <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><ScanLine className="h-4 w-4" /> Live-Scan & Upload</CardTitle></CardHeader>
              <CardContent className="text-sm text-slate-600">Live-Kamera oder Bild-Upload. Manuelle ID-Eingabe optional.</CardContent>
            </Card>
            <Card className="border-slate-200">
              <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Shield className="h-4 w-4" /> Privacy-first</CardTitle></CardHeader>
              <CardContent className="text-sm text-slate-600">Kamera bleibt lokal. Es wird nur die ID an den Server geschickt.</CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-slate-200">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
          <h2 className="text-lg font-semibold tracking-tight">So funktioniert’s</h2>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-slate-200">
              <CardHeader className="pb-1"><CardTitle className="text-base">1 · QR-Code öffnen</CardTitle></CardHeader>
              <CardContent className="text-sm text-slate-600">QR-Label bereit halten oder Bilddatei vorbereiten.</CardContent>
            </Card>
            <Card className="border-slate-200">
              <CardHeader className="pb-1"><CardTitle className="text-base">2 · <span className="text-blue-700">Jetzt scannen</span></CardTitle></CardHeader>
              <CardContent className="text-sm text-slate-600">Auf <span className="font-medium">Scan</span> klicken, Kamera freigeben oder Bild hochladen.</CardContent>
            </Card>
            <Card className="border-slate-200">
              <CardHeader className="pb-1"><CardTitle className="text-base">3 · Bestätigen</CardTitle></CardHeader>
              <CardContent className="text-sm text-slate-600">Wir senden nur die <code className="bg-slate-50 px-1 rounded">id</code> an <code className="bg-slate-50 px-1 rounded">/api/register</code>.</CardContent>
            </Card>
          </div>
          <div className="mt-6">
            <Button asChild className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-600/90 hover:to-indigo-600/90">
            </Button>
          </div>
        </div>
      </section>

      {/* Keyboard tips */}
      <section className="border-t border-slate-200">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
          <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-4">
            <div className="flex flex-wrap items-center gap-4 text-sm text-slate-700">
              <div className="inline-flex items-center gap-2"><Upload className="h-4 w-4" /> Bild-Upload möglich</div>
              <div className="inline-flex items-center gap-2"><Keyboard className="h-4 w-4" /> Tipp: <kbd className="rounded border bg-white px-1">U</kbd> öffnet den Uploader</div>
              <div className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> Erfolgsfeedback als Toast</div>
            </div>
          </div>
        </div>
      </section>

      <footer className="mx-auto max-w-6xl px-4 pb-8 pt-2 text-xs text-slate-500 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2"><Shield className="h-4 w-4" /> Made by Akkan Group.</div>
        <div>© {new Date().getFullYear()} – All rights reserved.</div>
      </footer>
    </div>
  );
}
