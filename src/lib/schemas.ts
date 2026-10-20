import { z } from 'zod';
import { ACCENTS, BANNER_PRESETS } from './banners';
import { NOTIFY, SOURCES } from './channels';
import { isValidTimeZone } from './format';

const localDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'Pick a date and time.');
const optionalDateTime = z.union([localDateTime, z.literal('')]);
const name = (label: string) => z.string().trim().min(1, `${label} is required.`).max(60, `${label} is too long.`);

export const signupSchema = z.object({
  firstName: name('First name'),
  lastName: name('Last name'),
  email: z.string().trim().email('Enter a valid email address.'),
  password: z.string().min(8, 'Use at least 8 characters for your password.').max(200),
  phone: z.string().max(30).optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
});

export const guestSchema = z.object({
  firstName: name('First name'),
  lastName: name('Last name'),
  phone: z.string().max(30).optional(),
  email: z.string().max(200).optional(),
});

export const eventSchema = z
  .object({
    title: z.string().trim().min(1, 'Give your event a title.').max(120, 'Keep the title under 120 characters.'),
    description: z.string().max(5000).default(''),
    bannerPreset: z.string().refine((k) => k in BANNER_PRESETS, 'Pick a banner style.'),
    bannerImage: z
      .string()
      .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/, 'The banner must be a JPEG, PNG or WebP image.')
      .max(2_000_000, 'The banner image is too large. Try a smaller photo.')
      .nullable()
      .optional(),
    accent: z.string().refine((k) => k in ACCENTS, 'Pick an accent color.'),
    startsAt: localDateTime,
    endsAt: optionalDateTime.default(''),
    timezone: z.string().refine(isValidTimeZone, 'Pick a valid time zone.'),
    locationName: z.string().trim().max(200).default(''),
    locationAddress: z.string().trim().max(300).default(''),
    onlineUrl: z.union([z.string().trim().url('Enter a full link, starting with https://'), z.literal('')]).default(''),
    hasFee: z.boolean(),
    feeAmount: z.number().min(0, 'The fee can’t be negative.').max(100000),
    feeCurrency: z.string().regex(/^[A-Z]{3}$/, 'Use a 3-letter currency code like USD.'),
    feeNote: z.string().trim().max(300).default(''),
    bringNote: z.string().trim().max(1000).default(''),
    dressCode: z.string().trim().max(120).default(''),
    capacity: z.number().int().min(1, 'Capacity must be at least 1.').max(100000).nullable(),
    maxPlusOnes: z.number().int().min(0).max(20, 'Allow at most 20 extra guests per person.'),
    rsvpDeadline: optionalDateTime.default(''),
    allowMaybe: z.boolean(),
    showGuestList: z.boolean(),
    inviteOnly: z.boolean(),
    features: z
      .array(z.string().trim().min(1).max(60, 'Keep each feature under 60 characters.'))
      .max(30, 'List at most 30 features.')
      .default([])
      // Drop repeats, ignoring case.
      .transform((list) => list.filter((f, i) => list.findIndex((g) => g.toLowerCase() === f.toLowerCase()) === i)),
    items: z
      .array(
        z.object({
          id: z.string().optional(),
          name: z.string().trim().min(1, 'Every item needs a name.').max(100),
          quantity: z.number().int().min(1, 'Item quantities must be at least 1.').max(999),
          note: z.string().trim().max(200).default(''),
        }),
      )
      .max(100, 'Keep the list to 100 items.'),
    invitees: z
      .array(
        z.object({
          id: z.string().optional(),
          name: z.string().trim().min(1, 'Every invitee needs a name.').max(100),
          phone: z.string().trim().max(30).default(''),
          email: z.string().trim().max(200).default(''),
        }),
      )
      .max(500, 'Invite at most 500 people per event.'),
    notifyMessage: z.string().trim().max(1000).optional(),
  })
  .refine((e) => !e.endsAt || e.endsAt > e.startsAt, { message: 'The end time must be after the start time.' })
  .refine((e) => !e.rsvpDeadline || e.rsvpDeadline <= e.startsAt, { message: 'The RSVP deadline must be before the event starts.' });

export type EventInput = z.infer<typeof eventSchema>;

export const rsvpSchema = z.object({
  status: z.enum(['going', 'maybe', 'declined']),
  plusOnes: z.number().int().min(0).max(20).default(0),
  note: z.string().trim().max(500).default(''),
  notify: z.enum(NOTIFY),
  phone: z.string().max(30).optional(),
  email: z.string().max(200).optional(),
  source: z.enum(SOURCES).default('link'),
  inviteToken: z.string().max(100).nullable().optional(),
});

export const claimSchema = z.object({
  quantity: z.number().int().min(0).max(999),
});

export const inviteNoteSchema = z.object({
  // null resets to the default wording; '' means send only the link.
  note: z.string().max(500, 'Keep the message under 500 characters.').nullable(),
});

export const updateSchema = z.object({
  message: z.string().trim().min(1, 'Write a message first.').max(1000, 'Keep updates under 1000 characters.'),
  audience: z.enum(['going', 'going_maybe', 'everyone']),
});
