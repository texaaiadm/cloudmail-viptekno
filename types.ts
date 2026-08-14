
export interface CloudflareCredentials {
  email: string;
  apiKey: string;
  zoneId: string;
  accountId: string;
  mailbox?: string;
  mailboxPassword?: string;
}

export interface Settings {
  id: string;
  enabled: boolean;
  name: string;
  created: string;
  modified: string;
  skip_wizard: boolean;
  status: 'ready' | 'needs_setup' | 'disabled';
  tag: string;
}

export interface Address {
  id: string;
  created: string;
  email: string;
  modified: string;
  tag: string;
  verified: string | null;
}

export interface Matcher {
  type: 'literal' | 'all';
  field: 'to';
  value: string;
}

export interface Action {
  type: 'forward' | 'drop';
  value: string[];
}

export interface EmailRoutingRule {
  id: string;
  actions: Action[];
  enabled: boolean;
  matchers: Matcher[];
  name: string;
  priority: number;
  tag: string;
}

export interface DNSRecord {
  content: string;
  name: string;
  priority?: number;
  type: string;
  ttl: number;
}

export interface ZoneDnsRecord extends DNSRecord {
  id: string;
  modified_on?: string;
  created_on?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  errors: any[];
  messages: any[];
  result: T;
  result_info?: {
    count: number;
    page: number;
    per_page: number;
    total_count: number;
  };
}
