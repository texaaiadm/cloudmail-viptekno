# Cloudmail Self-Hosted Inbox (Cloudflare Email Worker)

Inbox pribadi 100% di infrastruktur Cloudflare Anda. Email masuk → Email Routing
→ Email Worker → parse → simpan di **D1** (isi pesan) + **R2** (lampiran) →
frontend baca via HTTP endpoint Worker. Tanpa mail.tm / mail.gw.

Endpoint dibuat **drop-in kompatibel** dengan shape yang sudah dipakai `App.tsx`
(`/token`, `/me`, `/messages?page=1` → `hydra:member`, `/messages/:id`), jadi
frontend cukup diarahkan ulang lewat satu setting.

## Prasyarat
- Domain aktif di Cloudflare dengan **Email Routing** ON.
- `wrangler login` (akun Cloudflare Anda).

## Deploy

```bash
cd cloudflare-worker
npm install

# 1) Buat D1, salin database_id ke wrangler.toml
wrangler d1 create cloudmail_inbox
#   -> tempel "database_id" ke field REPLACE_WITH_D1_DATABASE_ID di wrangler.toml

# 2) Buat R2 bucket (lampiran)
wrangler r2 bucket create cloudmail-attachments

# 3) Terapkan skema tabel
npm run db:init          # = wrangler d1 execute cloudmail_inbox --remote --file=./schema.sql

# 4) Set secrets
wrangler secret put API_TOKEN         # token bearer bebas, mis. hasil: openssl rand -hex 24
wrangler secret put MAILBOX_PASSWORD  # password yang diketik user di tab Mailbox app

# 5) Deploy
npm run deploy
#   -> catat URL, mis. https://cloudmail-inbox.<akun>.workers.dev
```

## Arahkan Email Routing ke Worker

Cloudflare Dashboard → domain → **Email → Email Routing → Routing rules**:
- **Catch-all** → action **Send to a Worker** → pilih `cloudmail-inbox`.
  (Semua alamat @domain masuk ke inbox — cocok utk email acak/generate.)
- Atau buat rule alamat spesifik dengan action yang sama.

Verifikasi rule (opsional, via API app yang sudah ada):
`action: [{type:'worker', value:['cloudmail-inbox']}]`

## Sambungkan frontend

Di app (tab mana pun), buka DevTools Console lalu set:

```js
localStorage.setItem('inbox_api_base', 'https://cloudmail-inbox.<akun>.workers.dev');
location.reload();
```

Login mailbox di app: password = `MAILBOX_PASSWORD` di atas (field email bebas,
hanya label). Setelah itu tab Mailbox membaca dari inbox Cloudflare Anda sendiri.

Kosongkan setting untuk kembali ke mail.gw:
`localStorage.removeItem('inbox_api_base')`.

## Uji lokal tanpa deploy

```bash
wrangler dev --test-scheduled
# lalu POST contoh email via `curl` ke http://localhost:8787/cdn-cgi/... (email trigger)
# atau uji HTTP API langsung:
curl -X POST localhost:8787/token -d '{"address":"a@b","password":"<MAILBOX_PASSWORD>"}'
curl localhost:8787/messages?page=1 -H "Authorization: Bearer <API_TOKEN>"
```

## Batasan (jujur)
- **Incoming-only**: baca OTP/notifikasi. Kirim/balas email butuh jalur SMTP terpisah.
- Kuota: Workers free 100k req/hari, D1 & R2 punya free tier — cukup untuk OTP.
- Retensi diatur `RETENTION_HOURS` (default 72 jam), cron purge tiap jam.
- Wrangler v3 dipakai di sini; boleh upgrade ke v4 (`npm i -D wrangler@4`).
