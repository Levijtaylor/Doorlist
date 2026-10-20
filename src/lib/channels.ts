// Shared by server and client: where an invite link was shared, and how a guest wants updates.

// messenger/snapchat/instagram stay recognized for links shared before the single Share button.
export const SOURCES = ['sms', 'whatsapp', 'messenger', 'snapchat', 'instagram', 'email', 'share', 'link'] as const;
export type Source = (typeof SOURCES)[number];

export const SOURCE_LABEL: Record<Source, string> = {
  sms: 'Text message',
  whatsapp: 'WhatsApp',
  messenger: 'Messenger',
  snapchat: 'Snapchat',
  instagram: 'Instagram',
  email: 'Email',
  share: 'Share menu',
  link: 'Copied link',
};

export function parseSource(value: string | null | undefined): Source {
  return (SOURCES as readonly string[]).includes(value ?? '') ? (value as Source) : 'link';
}

export const NOTIFY = ['sms', 'whatsapp', 'email', 'none'] as const;
export type Notify = (typeof NOTIFY)[number];

export const NOTIFY_LABEL: Record<Notify, string> = {
  sms: 'Text message',
  whatsapp: 'WhatsApp',
  email: 'Email',
  none: "No messages, I'll check this page",
};

/** Updates go back to the app the link came from when that app lets us send messages. */
export function defaultNotify(source: Source): Notify {
  if (source === 'whatsapp') return 'whatsapp';
  if (source === 'email') return 'email';
  return 'sms';
}

/** Apps that don't let outside services message their users. */
export function cannotMessage(source: Source): boolean {
  return source === 'snapchat' || source === 'instagram' || source === 'messenger';
}

export function needsPhone(notify: Notify): boolean {
  return notify === 'sms' || notify === 'whatsapp';
}
