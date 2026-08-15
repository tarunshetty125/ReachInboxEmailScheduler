interface EtherealAccountResponse {
  status?: string;
  error?: string;
  user?: string;
  pass?: string;
  smtp?: {
    host?: string;
    port?: number;
  };
}

export interface EtherealAccount {
  user: string;
  pass: string;
  smtp: {
    host: string;
    port: number;
  };
}

/**
 * Ethereal's Nodemailer helper caches one account per process by default.
 * ReachInbox instead provisions a new test account for every sender.
 */
export async function createFreshEtherealAccount(): Promise<EtherealAccount> {
  const apiUrl = (process.env.ETHEREAL_API ?? 'https://api.nodemailer.com').replace(/\/+$/, '');
  const response = await fetch(`${apiUrl}/user`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ requestor: 'reachinbox-email-scheduler', version: '1.0.0' }),
    signal: AbortSignal.timeout(20_000),
  });
  const account = await response.json() as EtherealAccountResponse;
  const user = account.user;
  const pass = account.pass;
  const smtpHost = account.smtp?.host;
  const smtpPort = account.smtp?.port;

  if (
    !response.ok ||
    account.status !== 'success' ||
    !user ||
    !pass ||
    !smtpHost ||
    typeof smtpPort !== 'number' ||
    !Number.isInteger(smtpPort)
  ) {
    throw new Error(account.error ?? 'Unable to create a fresh Ethereal sender account.');
  }

  return {
    user,
    pass,
    smtp: { host: smtpHost, port: smtpPort },
  };
}
