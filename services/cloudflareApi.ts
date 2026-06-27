
import { CloudflareCredentials, ApiResponse } from '../types';

export class CloudflareService {
  private creds: CloudflareCredentials;
  // Always use /api proxy to avoid CORS issues. 
  // In dev: handled by vite.config.ts
  // In prod (Vercel): handled by vercel.json rewrites
  private baseUrl = '/api';

  constructor(creds: CloudflareCredentials) {
    this.creds = creds;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-Auth-Email': this.creds.email,
        'X-Auth-Key': this.creds.apiKey,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.errors?.[0]?.message || 'Cloudflare API request failed');
    }

    return response.json();
  }

  // Zones
  async listZones() {
    return this.request<any[]>(`/zones?status=active&per_page=50`);
  }

  // Settings
  async getSettings() {
    return this.request<any>(`/zones/${this.creds.zoneId}/email/routing`);
  }

  async enableRouting(name?: string) {
    const options: RequestInit = { method: 'POST' };
    if (name) {
      options.body = JSON.stringify({ name });
    }
    return this.request<any>(`/zones/${this.creds.zoneId}/email/routing/enable`, options);
  }

  async disableRouting(name?: string) {
    const options: RequestInit = { method: 'POST' };
    if (name) {
      options.body = JSON.stringify({ name });
    }
    return this.request<any>(`/zones/${this.creds.zoneId}/email/routing/disable`, options);
  }

  // Addresses
  async listAddresses(page = 1) {
    return this.request<any[]>(`/accounts/${this.creds.accountId}/email/routing/addresses?page=${page}`);
  }

  async createAddress(email: string) {
    return this.request<any>(`/accounts/${this.creds.accountId}/email/routing/addresses`, {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async deleteAddress(id: string) {
    return this.request<any>(`/accounts/${this.creds.accountId}/email/routing/addresses/${id}`, {
      method: 'DELETE',
    });
  }

  // DNS
  async getDnsSettings(subdomain?: string) {
    const query = subdomain ? `?subdomain=${encodeURIComponent(subdomain)}` : '';
    return this.request<any>(`/zones/${this.creds.zoneId}/email/routing/dns${query}`);
  }

  async listZoneDnsRecords() {
    let page = 1;
    let allRecords: any[] = [];
    while (true) {
      const res = await this.request<any[]>(`/zones/${this.creds.zoneId}/dns_records?per_page=100&page=${page}`);
      if (res.result) {
        allRecords = [...allRecords, ...res.result];
      }
      
      const info = res.result_info;
      if (!info || allRecords.length >= info.total_count) {
        break;
      }
      page++;
    }
    return { result: allRecords, success: true, errors: [], messages: [] };
  }

  async createZoneDnsRecord(record: { type: string; name: string; content: string; ttl?: number; priority?: number }) {
    return this.request<any>(`/zones/${this.creds.zoneId}/dns_records`, {
      method: 'POST',
      body: JSON.stringify(record),
    });
  }

  async updateZoneDnsRecord(id: string, record: { type?: string; name?: string; content?: string; ttl?: number; priority?: number }) {
    return this.request<any>(`/zones/${this.creds.zoneId}/dns_records/${id}`, {
      method: 'PUT',
      body: JSON.stringify(record),
    });
  }

  async deleteZoneDnsRecord(id: string) {
    return this.request<any>(`/zones/${this.creds.zoneId}/dns_records/${id}`, {
      method: 'DELETE',
    });
  }

  // Rules
  async listRules() {
    return this.request<any[]>(`/zones/${this.creds.zoneId}/email/routing/rules`);
  }

  async createRule(rule: Partial<any>) {
    return this.request<any>(`/zones/${this.creds.zoneId}/email/routing/rules`, {
      method: 'POST',
      body: JSON.stringify(rule),
    });
  }

  async deleteRule(id: string) {
    return this.request<any>(`/zones/${this.creds.zoneId}/email/routing/rules/${id}`, {
      method: 'DELETE',
    });
  }

  async updateRule(id: string, rule: Partial<any>) {
    return this.request<any>(`/zones/${this.creds.zoneId}/email/routing/rules/${id}`, {
      method: 'PUT',
      body: JSON.stringify(rule),
    });
  }

  // Catch-all
  async getCatchAll() {
    return this.request<any>(`/zones/${this.creds.zoneId}/email/routing/rules/catch_all`);
  }

  async updateCatchAll(data: any) {
    return this.request<any>(`/zones/${this.creds.zoneId}/email/routing/rules/catch_all`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }
}
