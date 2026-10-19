# Gather

Event invites that work in any messaging app. The host makes an account; everyone else RSVPs with just their first and last name.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000, click **Host an event**, and create an account. The SQLite database is created automatically at `data/gather.db`.

## What it does

**Hosts** (account required)
- Create an event: banner (upload a photo or pick a pattern), accent color, title, description, start/end time and time zone, place and address or video link, dress code.
- Cost: a fee toggle, amount, currency, and "how to pay" instructions. Gather shows the fee; it doesn't collect payments.
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
| Email | Their email | SendGrid |
| Snapchat, Instagram, Messenger | Guest picks SMS, WhatsApp or email (phone number field by default) | These apps don't let outside services message their users, so the phone number is the fallback |

Guests can also choose "No messages, I'll check this page." Guests have no password, so every text or email they get includes a personal link that signs them back in on any device.

## Turning on real messages

Without credentials, messages go to the server console and show as "logged" on the manage page. To send them for real, copy `.env.example` to `.env.local` and fill in:

- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` for SMS.
- `TWILIO_WHATSAPP_FROM` for WhatsApp. WhatsApp only allows free-form messages within 24 hours of the guest messaging you; after that, Meta requires approved message templates.
- `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL` for email.
- `APP_URL`, your public URL, so links in messages point to the live site.

## Deploying

The app uses SQLite on local disk, so deploy somewhere with a persistent disk: a VPS, Fly.io with a volume, Railway, Render with a disk, or an Azure App Service with mounted storage. Serverless hosts like Vercel don't keep the database file between requests. To use those, swap `src/lib/db.ts` for Postgres.

Set `DATABASE_PATH` to a file on the persistent volume.

## Known limits

- Next.js 14's link-preview image renderer fails on Windows, so local Windows dev serves the uploaded banner instead of the generated card. Linux hosts render the full card.
- `npm audit` flags advisories in Next 14. Upgrading to Next 15 means making `cookies()`, `headers()` and route `params` async.

## Layout

```
src/lib/        db schema, auth/sessions, event queries, notifications, validation
src/app/api/    JSON routes: auth, guest, events, rsvp, item claims, updates, banner, ics, og
src/app/        pages: landing, login/signup, dashboard, events/new, events/[id]/edit|manage, e/[slug] (guest page), k/[key] (personal sign-in link)
src/components/ EventForm, RsvpPanel, ItemsList, ShareInvite, SendUpdate, Tracker, Banner
```
