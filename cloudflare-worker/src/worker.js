// Cloudmail self-hosted inbox — Cloudflare Email Worker
// Terima email via Email Routing, parse, simpan ke D1 (+R2 utk lampiran),
// sajikan lewat HTTP endpoint yang DROP-IN kompatibel dgn shape mail.gw/mail.tm
// yang dipakai frontend (App.tsx). Nol ketergantungan API pihak ketiga.
//
// Endpoint:
//   POST /token            {address,password} -> {token}
//   GET  /me               Bearer             -> {id,address}
//   GET  /messages?page=1  Bearer             -> {"hydra:member":[...]}
//   GET  /messages/:id     Bearer             -> {..., html:[], text, attachments:[]}
//   GET  /attachments/:id  Bearer             -> file biner
//   DELETE /messages/:id   Bearer             -> {ok:true}

import PostalMime from "postal-mime";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Authorization,Content-Type",
};

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });

function authed(request, env) {
  const h = request.headers.get("Authorization") || "";
  const token = h.replace(/^Bearer\s+/i, "").trim();
  return !!env.API_TOKEN && token === env.API_TOKEN;
}

// intro = ringkasan singkat (150 char) dari teks polos, meniru mail.gw
function makeIntro(text, html) {
  const src = (text || html || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return src.slice(0, 150);
}

export default {
  // ---- INCOMING EMAIL ----
  async email(message, env, ctx) {
    let parsed;
    try {
      parsed = await PostalMime.parse(message.raw);
    } catch (e) {
      // Kalau parse gagal, tetap simpan header minimal supaya OTP tak hilang total.
      parsed = { subject: message.headers.get("subject") || "(gagal parse)", text: "", html: "", attachments: [] };
    }

    const id = crypto.randomUUID();
    const fromAddr = (parsed.from && parsed.from.address) || message.from || "";
    const fromName = (parsed.from && parsed.from.name) || "";
    const toList = (parsed.to && parsed.to.length ? parsed.to : [{ address: message.to }]).map((t) => ({
      name: t.name || "",
      address: t.address || "",
    }));
    const subject = parsed.subject || "(tanpa subjek)";
    const text = parsed.text || "";
    const html = parsed.html || "";
    const intro = makeIntro(text, html);
    const receivedAt = new Date().toISOString();

    // Simpan lampiran ke R2 bila binding ATTACH tersedia. Tanpa R2, lampiran
    // dilewati (metadata dasar tetap dicatat) — isi pesan/OTP tak terpengaruh.
    const attachments = [];
    for (const att of parsed.attachments || []) {
      const attId = crypto.randomUUID();
      const size = att.content?.byteLength ?? (att.content?.length || 0);
      if (env.ATTACH) {
        const key = `${id}/${attId}`;
        try {
          await env.ATTACH.put(key, att.content, {
            httpMetadata: { contentType: att.mimeType || "application/octet-stream" },
          });
          attachments.push({ id: attId, filename: att.filename || "attachment", size, mime: att.mimeType || "", stored: true });
        } catch (_) {
          attachments.push({ id: attId, filename: att.filename || "attachment", size, mime: att.mimeType || "", stored: false });
        }
      } else {
        attachments.push({ id: attId, filename: att.filename || "attachment", size, mime: att.mimeType || "", stored: false });
      }
    }

    await env.DB.prepare(
      `INSERT INTO messages (id, to_json, from_addr, from_name, subject, intro, text, html, attachments_json, received_at, seen)
       VALUES (?,?,?,?,?,?,?,?,?,?,0)`
    )
      .bind(
        id,
        JSON.stringify(toList),
        fromAddr,
        fromName,
        subject,
        intro,
        text,
        html,
        JSON.stringify(attachments),
        receivedAt
      )
      .run();
  },

  // ---- CRON: purge pesan lama ----
  async scheduled(event, env, ctx) {
    const hours = parseInt(env.RETENTION_HOURS || "72", 10);
    const cutoff = new Date(Date.now() - hours * 3600 * 1000).toISOString();
    // Ambil id yang akan dihapus supaya lampiran R2-nya ikut dibersihkan.
    const old = await env.DB.prepare(`SELECT id, attachments_json FROM messages WHERE received_at < ?`).bind(cutoff).all();
    if (env.ATTACH) {
    for (const row of old.results || []) {
      try {
        const atts = JSON.parse(row.attachments_json || "[]");
        for (const a of atts) await env.ATTACH.delete(`${row.id}/${a.id}`);
      } catch (_) {}
    }
    }
    await env.DB.prepare(`DELETE FROM messages WHERE received_at < ?`).bind(cutoff).run();
  },

  // ---- HTTP API ----
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    // POST /token — validasi password, kembalikan token bearer.
    if (path === "/token" && request.method === "POST") {
      let body;
      try {
        body = await request.json();
      } catch (_) {
        return json({ message: "Body JSON tidak valid" }, 400);
      }
      const { address, password } = body || {};
      if (!password || password !== env.MAILBOX_PASSWORD) {
        return json({ message: "Autentikasi gagal" }, 401);
      }
      return json({ token: env.API_TOKEN, id: address || "inbox", "@id": "/me" });
    }

    // Endpoint di bawah butuh bearer.
    if (!authed(request, env)) return json({ message: "Unauthorized" }, 401);

    if (path === "/me" && request.method === "GET") {
      return json({ id: "inbox", address: url.searchParams.get("address") || "inbox" });
    }

    if (path === "/messages" && request.method === "GET") {
      const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
      const perPage = 50;
      const offset = (page - 1) * perPage;
      const rows = await env.DB.prepare(
        `SELECT id, to_json, from_addr, from_name, subject, intro, received_at, seen
         FROM messages ORDER BY received_at DESC LIMIT ? OFFSET ?`
      )
        .bind(perPage, offset)
        .all();
      const members = (rows.results || []).map((r) => ({
        id: r.id,
        from: { name: r.from_name || "", address: r.from_addr || "" },
        to: JSON.parse(r.to_json || "[]"),
        subject: r.subject || "",
        intro: r.intro || "",
        createdAt: r.received_at,
        seen: !!r.seen,
      }));
      return json({ "hydra:member": members, "hydra:totalItems": members.length });
    }

    const msgMatch = path.match(/^\/messages\/([\w-]+)$/);
    if (msgMatch) {
      const id = msgMatch[1];
      if (request.method === "DELETE") {
        const row = await env.DB.prepare(`SELECT attachments_json FROM messages WHERE id=?`).bind(id).first();
        if (row) {
          try {
            for (const a of JSON.parse(row.attachments_json || "[]")) await env.ATTACH.delete(`${id}/${a.id}`);
          } catch (_) {}
        }
        await env.DB.prepare(`DELETE FROM messages WHERE id=?`).bind(id).run();
        return json({ ok: true });
      }
      // GET single — tandai seen, kembalikan full.
      const r = await env.DB.prepare(`SELECT * FROM messages WHERE id=?`).bind(id).first();
      if (!r) return json({ message: "Tidak ditemukan" }, 404);
      await env.DB.prepare(`UPDATE messages SET seen=1 WHERE id=?`).bind(id).run();
      const atts = JSON.parse(r.attachments_json || "[]").map((a) => ({
        id: a.id,
        filename: a.filename,
        size: a.size,
        downloadUrl: `${url.origin}/attachments/${r.id}__${a.id}`,
      }));
      return json({
        id: r.id,
        from: { name: r.from_name || "", address: r.from_addr || "" },
        to: JSON.parse(r.to_json || "[]"),
        subject: r.subject || "",
        intro: r.intro || "",
        createdAt: r.received_at,
        seen: true,
        text: r.text || "",
        html: r.html ? [r.html] : [],
        attachments: atts,
      });
    }

    const attMatch = path.match(/^\/attachments\/([\w-]+)__([\w-]+)$/);
    if (attMatch && request.method === "GET") {
      const key = `${attMatch[1]}/${attMatch[2]}`;
      const obj = await env.ATTACH.get(key);
      if (!obj) return json({ message: "Lampiran tidak ditemukan" }, 404);
      const headers = new Headers(CORS);
      obj.writeHttpMetadata(headers);
      headers.set("Content-Disposition", "attachment");
      return new Response(obj.body, { headers });
    }

    return json({ message: "Not found" }, 404);
  },
};
