// app/api/device-credentials/route.ts
import { NextRequest, NextResponse } from "next/server";

const C8Y_BASEURL = process.env.C8Y_BASEURL!;                 // e.g. https://<tenant>.cumulocity.com
const C8Y_BOOTSTRAP_TENANT = process.env.C8Y_BOOTSTRAP_TENANT!; // e.g. t2115336841 (tenant of bootstrap user)
const C8Y_BOOTSTRAP_USER = process.env.C8Y_BOOTSTRAP_USER!;     // bootstrap username
const C8Y_BOOTSTRAP_PASSWORD = process.env.C8Y_BOOTSTRAP_PASSWORD!; // bootstrap password

const DEFAULT_POLL_MS = 2000;
const DEFAULT_TIMEOUT_MS = 60000;

function basicAuth(user: string, pass: string) {
  return "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");
}

export async function POST(req: NextRequest) {
  try {
    if (!C8Y_BASEURL || !C8Y_BOOTSTRAP_TENANT || !C8Y_BOOTSTRAP_USER || !C8Y_BOOTSTRAP_PASSWORD) {
      return NextResponse.json({ error: "Server misconfigured. Missing C8Y env vars." }, { status: 500 });
    }

    const { id, pollMs = DEFAULT_POLL_MS, timeoutMs = DEFAULT_TIMEOUT_MS } = await req.json();
    if (!id) return NextResponse.json({ error: "Missing device id." }, { status: 400 });

    const url = `${C8Y_BASEURL}/devicecontrol/deviceCredentials`;
    const headers = {
      // some tenants reply with plain application/json – accept both
      "Content-Type": "application/vnd.com.nsn.cumulocity.devicecredentials+json",
      Accept: "application/vnd.com.nsn.cumulocity.devicecredentials+json, application/json;q=0.9, */*;q=0.1",
      // IMPORTANT: bootstrap auth is <tenantId>/<username>:<password>
      Authorization: basicAuth(`${C8Y_BOOTSTRAP_TENANT}/${C8Y_BOOTSTRAP_USER}`, C8Y_BOOTSTRAP_PASSWORD),
    };

    const started = Date.now();

    while (true) {
      if (Date.now() - started > timeoutMs) {
        return NextResponse.json(
          { error: "Timed out waiting for credentials. Please approve the device in Cumulocity and try again." },
          { status: 504 }
        );
      }

      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({ id }),
      });

      // While pending, C8Y returns 404 with a JSON body that says PENDING_ACCEPTANCE
      if (res.status === 404) {
        // capture the message for the client, but keep polling
        const maybeJson = await res.json().catch(async () => ({ text: await res.text().catch(() => "") }));
        // brief delay before retrying
        await new Promise((r) => setTimeout(r, pollMs));
        continue;
      }

      // Success can be 201 (Created) (and sometimes 200 on some clusters)
      if (res.status === 201 || res.status === 200) {
        const rawText = await res.text();
        let raw: any = {};
        try {
          raw = rawText ? JSON.parse(rawText) : {};
        } catch {
          return NextResponse.json({ error: "Unexpected non-JSON response from Cumulocity.", raw: rawText }, { status: 502 });
        }

        // Normalize to the exact fields you showed
        const tenantId = raw.tenantId ?? raw.tenant?.id;
        const username = raw.username;
        const password = raw.password;

        if (!tenantId || !username || !password) {
          return NextResponse.json({ error: "Malformed credentials from Cumulocity.", raw }, { status: 502 });
        }

        return NextResponse.json(
          {
            ok: true,
            credentials: {
              tenantId: String(tenantId),
              username: String(username),
              password: String(password),
              id: raw.id ?? id,
              self: raw.self ?? null,
            },
            raw,
          },
          { status: 200 }
        );
      }

      // Any other status → bubble up details
      const text = await res.text().catch(() => "");
      return NextResponse.json({ error: `C8Y returned ${res.status}. ${text || ""}`.trim() }, { status: res.status });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unexpected error." }, { status: 500 });
  }
}
