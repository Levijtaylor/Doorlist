# Doorlist

Event invites that work in any messaging app. The host makes an account; everyone else RSVPs with just their first and last name.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000, click **Host an event**, and create an account. In development the database is a local SQLite file, created automatically at `data/doorlist.db`. In production it's Turso (see below).

## What it does

**Hosts** (account required)
- Create an event: banner (upload a photo or pick a pattern), accent color, title, description, start/end time and time zone, place and address or video link, dress code.
- Cost: a fee toggle, amount, currency, and "how to pay" instructions. Doorlist shows the fee; it doesn't collect payments.
- What to bring: a note for everyone, plus a sign-up list of items with quantities that guests claim.
- Guests: plus-ones per person, capacity, RSVP deadline, whether "Maybe" is allowed, whether guests see the guest list, and invite-only mode.
- Who's invited: a list of names with an optional phone and email. Each person gets a personal link, so the tracker can show who hasn't replied.
- Manage page: a live tracker (going, maybe, can't go, no reply yet, headcount including plus-ones, spots left), which app each guest came from, a guest table, the item sign-up summary, and updates.
- Send invites with one-tap buttons for Text, WhatsApp, Messenger, Snapchat, Instagram and Email, or copy the link. Each button uses its own `?via=` link.
- Post updates, or attach a message when editing the event. These reach guests by text, WhatsApp or email.

**Guests** (no account needed)
- Open the link, choose Going / Maybe / Can't go, add plus-ones and a note, and enter a first and last name.
- Pick how to get updates. The default follows the app the link came from (see below).
- Claim items from the sign-up list.
- Add to calendar (.ics), and get a link preview card when the link is pasted into a chat.
- Optionally save an account later. Their RSVPs carry over, and logging in to an existing account merges them.

## How updates follow the invite link

Every invite link carries `?via=sms|whatsapp|messenger|snapchat|instagram|email|link`. That value is saved with the RSVP and sets the guest's default update channel:

| Link came from | Updates go to | Why |
|---|---|---|
| Text message | SMS to their number | Twilio |
| WhatsApp | WhatsApp to their number | Twilio WhatsApp |
| Email | Their email | Resend |
| Snapchat, Instagram, Messenger | Guest picks SMS, WhatsApp or email (phone number field by default) | These apps don't let outside services message their users, so the phone number is the fallback |

Guests can also choose "No messages, I'll check this page." Guests have no password, so every text or email they get includes a personal link that signs them back in on any device.

## Deploying for free: Vercel + Turso + Resend

### 1. Database (Turso, free tier)

Install the Turso CLI (on Windows, via WSL or `scoop install turso`), then:

```bash
turso auth signup
turso db create doorlist
turso db show doorlist --url
turso db tokens create doorlist
```

Keep the URL (`libsql://...`) and the token. The tables are created automatically on first request.

### 2. Hosting (Vercel Hobby, free)

1. Push this repo to GitHub.
2. In Vercel, click **Add New → Project** and import the repo. The defaults are correct for Next.js.
3. Under **Environment Variables**, add `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`, plus `APP_URL` set to your Vercel URL (for example `https://doorlist-yourname.vercel.app`) or your own domain.
4. Deploy. Every push to `main` redeploys.

Vercel's Hobby plan is for non-commercial use. If you start charging for the app, move to the Pro plan.

### 3. Email (Resend, free tier)

1. Sign up at resend.com, add your domain, and add the DNS records it shows you (SPF/DKIM). Without a verified domain, Resend only sends to your own address.
2. Create an API key.
3. In Vercel, add `RESEND_API_KEY` and `EMAIL_FROM` (for example `Doorlist <invites@yourdomain.com>`), then redeploy.

### 4. Text messages (optional, paid)

Add `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` and `TWILIO_FROM_NUMBER`. US carriers require the number to be registered (toll-free verification or A2P 10DLC) before texts are delivered. `TWILIO_WHATSAPP_FROM` adds WhatsApp; outside a 24-hour reply window, WhatsApp only allows Meta-approved message templates.

Until a provider is configured, its messages go to the server log (on Vercel, the deployment's **Logs** tab) and show as "logged" on the manage page.

## Known limits

- Next.js 14's link-preview image renderer fails on Windows, so local Windows dev serves the uploaded banner instead of the generated card. Vercel renders the full card.
- `npm audit` flags advisories in Next 14. Upgrading to Next 15 means making `cookies()`, `headers()` and route `params` async.

## Layout

```
src/lib/        db schema (libSQL/Turso), auth/sessions, event queries, notifications, validation
src/app/api/    JSON routes: auth, guest, events, rsvp, item claims, updates, banner, ics, og
src/app/        pages: landing, login/signup, dashboard, events/new, events/[id]/edit|manage, e/[slug] (guest page), k/[key] (personal sign-in link)
src/components/ EventForm, RsvpPanel, ItemsList, ShareInvite, SendUpdate, Tracker, Banner
```
