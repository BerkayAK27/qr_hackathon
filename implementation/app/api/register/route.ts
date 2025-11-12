// app/api/register/route.ts
import { NextRequest, NextResponse } from "next/server";

type Incoming = { id?: string };

const base = process.env.C8Y_BASEURL!;
const tenant = process.env.C8Y_TENANT!;
const user = process.env.C8Y_USER!;
const pass = process.env.C8Y_PASSWORD!;

function authHeader() {
  const token = Buffer.from(`${tenant}/${user}:${pass}`).toString("base64");
  return `Basic ${token}`;
}

export async function POST(req: NextRequest) {
  if (!base || !tenant || !user || !pass) {
    return NextResponse.json(
      { error: "Server misconfigured. Missing C8Y env vars." },
      { status: 500 }
    );
  }

  let body: Incoming;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const id = (body.id || "").trim();
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  try {
    const res = await fetch(`${base}/devicecontrol/newDeviceRequests`, {
      method: "POST",
      headers: {
        Authorization: authHeader(),
        Accept: "application/json",
        "Content-Type": "application/vnd.com.nsn.cumulocity.newdevicerequest+json",
        "X-Cumulocity-Processing-Mode": "PERSISTENT",
      },
      body: JSON.stringify({ id }),
    });

    const text = await res.text();
    const details = safeJson(text) ?? text;

    if (res.status === 201) {
      return NextResponse.json({ id, status: "created", details });
    }
    if (res.status === 409) {
      return NextResponse.json({ id, status: "exists", details });
    }

    return NextResponse.json(
      { error: "Cumulocity rejected the request", statusCode: res.status, details },
      { status: 502 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Network error calling Cumulocity" },
      { status: 502 }
    );
  }
}

function safeJson(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
