import { CloudflareCredentials } from '../types';

export const DEFAULT_CREDENTIALS: CloudflareCredentials = {
  email: import.meta.env.VITE_CF_EMAIL || 'cloudflare@email.teknoaiglobal.com',
  apiKey: import.meta.env.VITE_CF_API_KEY || 'bdf5ebe35a625271b4a1507c87aa3dfc3353c',
  zoneId: import.meta.env.VITE_CF_ZONE_ID || '5ad57fb06e03cc145dee0d6efe068ce0',
  accountId: import.meta.env.VITE_CF_ACCOUNT_ID || '64775c16472d1c2fa00c0b8abce4d24e',
  mailbox: import.meta.env.VITE_MAILBOX || 'inbox@teknoaiglobal.me',
  mailboxPassword: import.meta.env.VITE_MAILBOX_PASSWORD || 'teknoaiglobal',
};

export function parseCredsFromContent(content: string): CloudflareCredentials {
  const emailMatch = content.match(/(?:Email|EMAIL)\s*:\s*([^\s\r\n]+)/i);
  const apiKeyMatch = content.match(/(?:Global API Key \/ Token|API Key|ApiKey|API_KEY)\s*:\s*([^\s\r\n]+)/i);
  const zoneIdMatch = content.match(/(?:Zone ID|ZONE_ID)\s*:\s*([^\s\r\n]+)/i);
  const accountIdMatch = content.match(/(?:Account ID|ACCOUNT_ID)\s*:\s*([^\s\r\n]+)/i);
  const mailboxMatch = content.match(/(?:Mailbox|MAILBOX)\s*:\s*([^\s\r\n]+)/i);

  let password = DEFAULT_CREDENTIALS.mailboxPassword || 'teknoaiglobal';
  const pwMatch1 = content.match(/(?:Mailbox Password|MAILBOX_PASSWORD)\s*:\s*([^\s\r\n]+)/i);
  const pwMatch2 = content.match(/(?:Password|PASSWORD)\s*:\s*([^\s\r\n]+)/i);
  if (pwMatch1) {
    password = pwMatch1[1];
  } else if (pwMatch2) {
    password = pwMatch2[1];
  }

  return {
    email: emailMatch ? emailMatch[1] : DEFAULT_CREDENTIALS.email,
    apiKey: apiKeyMatch ? apiKeyMatch[1] : DEFAULT_CREDENTIALS.apiKey,
    zoneId: zoneIdMatch ? zoneIdMatch[1] : DEFAULT_CREDENTIALS.zoneId,
    accountId: accountIdMatch ? accountIdMatch[1] : DEFAULT_CREDENTIALS.accountId,
    mailbox: mailboxMatch ? mailboxMatch[1] : DEFAULT_CREDENTIALS.mailbox,
    mailboxPassword: password,
  };
}

export function loadStoredCredentials(): CloudflareCredentials {
  try {
    const saved = localStorage.getItem('cf_creds');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.apiKey && parsed.zoneId) {
        return {
          ...DEFAULT_CREDENTIALS,
          ...parsed,
        };
      }
    }
  } catch (e) {
    console.error('Failed to parse stored credentials:', e);
  }
  return DEFAULT_CREDENTIALS;
}

export async function fetchRemoteCredentials(): Promise<CloudflareCredentials | null> {
  try {
    const res = await fetch('/creds?action=get_file&filename=cloudmail');
    if (res.ok) {
      const data = await res.json();
      const fileData = data.cloudmail;
      if (fileData && typeof fileData.content === 'string') {
        const parsed = parseCredsFromContent(fileData.content);
        if (parsed.apiKey && parsed.zoneId) {
          localStorage.setItem('cf_creds', JSON.stringify(parsed));
          return parsed;
        }
      }
    }
  } catch (err) {
    console.warn('Unable to sync credentials from remote server, using local fallback:', err);
  }
  return null;
}

export async function saveRemoteCredentials(creds: CloudflareCredentials): Promise<boolean> {
  try {
    localStorage.setItem('cf_creds', JSON.stringify(creds));
    const content = `EMAIL: ${creds.email}
API_KEY: ${creds.apiKey}
ZONE_ID: ${creds.zoneId}
ACCOUNT_ID: ${creds.accountId}
PASSWORD: ${creds.mailboxPassword || 'teknoaiglobal'}`;

    const res = await fetch('/creds?action=save_file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: 'cloudmail',
        content,
      }),
    });
    return res.ok;
  } catch (err) {
    console.error('Failed to save remote credentials:', err);
    return false;
  }
}
