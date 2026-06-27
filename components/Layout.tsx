
import React, { useState } from 'react';
import { CloudflareCredentials } from '../types';
import { Button } from './ui/Button';
import { Input } from './ui/Input';

interface LayoutProps {
  children: React.ReactNode;
  credentials: CloudflareCredentials | null;
  onSaveCredentials: (creds: CloudflareCredentials) => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
  defaultCredentials?: Partial<CloudflareCredentials>;
  isVoucherVerified?: boolean;
  voucherEmail?: string;
  onVoucherLogout?: () => void;
  onVoucherLogin?: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ 
  children, 
  credentials, 
  onSaveCredentials, 
  activeTab, 
  onTabChange,
  defaultCredentials,
  isVoucherVerified,
  voucherEmail,
  onVoucherLogout
}) => {
  const [showConfig, setShowConfig] = useState(false);
  const [form, setForm] = useState<CloudflareCredentials>(
    credentials || { 
      email: defaultCredentials?.email || '', 
      apiKey: defaultCredentials?.apiKey || '', 
      zoneId: defaultCredentials?.zoneId || '', 
      accountId: defaultCredentials?.accountId || '' 
    }
  );

  const [zones, setZones] = useState<{ id: string; name: string }[]>([]);
  const [loadingZones, setLoadingZones] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');

  React.useEffect(() => {
    if (credentials) {
      setForm(credentials);
    } else if (defaultCredentials) {
      setForm(prev => ({
        ...prev,
        ...defaultCredentials,
        email: prev.email || defaultCredentials.email || '',
        apiKey: prev.apiKey || defaultCredentials.apiKey || '',
        zoneId: prev.zoneId || defaultCredentials.zoneId || '',
        accountId: prev.accountId || defaultCredentials.accountId || ''
      }));
    }
  }, [defaultCredentials, credentials]);

  // Reset verification status when inputs change
  React.useEffect(() => {
    setVerificationStatus('idle');
  }, [form.email, form.apiKey]);

  const loadZones = async () => {
    if (!form.apiKey || !form.email) return;
    setLoadingZones(true);
    try {
      // Direct fetch to avoid circular dependency with CloudflareService or recreating it here
      // Assuming /api proxy works as configured in CloudflareService
      const res = await fetch('/api/zones?status=active&per_page=50', {
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Email': form.email,
          'X-Auth-Key': form.apiKey,
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.result) {
          setZones(data.result.map((z: any) => ({ id: z.id, name: z.name })));
          return true;
        }
      }
      return false;
    } catch (e) {
      console.error("Failed to load zones", e);
      return false;
    } finally {
      setLoadingZones(false);
    }
  };

  const verifyToken = async () => {
    if (!form.apiKey || !form.email) return;
    setVerificationStatus('checking');
    
    // We can use loadZones as verification since it hits the API
    const success = await loadZones();
    
    if (success) {
      setVerificationStatus('valid');
    } else {
      setVerificationStatus('invalid');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveCredentials(form);
    setShowConfig(false);
  };

  const navItems = [
    { id: 'subdomains', label: 'Subdomain', icon: 'M4 6h6M4 12h8M4 18h10M16 6h4M18 4v4M16 18h4' },
    { id: 'emails', label: 'Email & Forward', icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
    { id: 'mailbox', label: 'Mailbox', icon: 'M4 4h16v4H4zm0 6h10v10H4zm12 0h4v10h-4z' },
    { id: 'cleanup', label: 'Pembersihan', icon: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16' },
  ];

  // Admin-only items (not shown in sidebar, only via /admin route)
  const adminNavItems = [
    { id: 'members', label: 'Members', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
  ];

  const isAdminRoute = typeof window !== 'undefined' && window.location.pathname.startsWith('/admin');
  const displayNavItems = isAdminRoute ? adminNavItems : navItems;

  // handleSettingClick removed

  return (
    <div className="h-screen md:h-dvh bg-slate-50 flex flex-col md:flex-row overflow-hidden relative">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex w-64 bg-white border-r border-slate-200 flex-col h-full">
        <div className="p-6 border-b border-slate-200 flex items-center gap-3">
             <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
               <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
               </svg>
             </div>
             <h1 className="font-bold text-slate-900 tracking-tight">Email Route</h1>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {displayNavItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === item.id 
                  ? 'bg-blue-50 text-blue-700' 
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
              </svg>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-200">
          <Button 
            variant="outline" 
            className="w-full" 
            onClick={() => window.open('https://whatsapp.com/channel/0029Vb9qWR10bIdfgsBw4a3h', '_blank')}
          >
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            Support Tools
          </Button>
        </div>
      </aside>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around p-2 z-50 pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        {displayNavItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`flex flex-col items-center justify-center p-2 rounded-lg transition-colors w-full ${
                activeTab === item.id 
                  ? 'text-blue-600' 
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <svg className="w-6 h-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
              </svg>
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
        ))}
      </nav>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto w-full scroll-smooth pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-8 sticky top-0 z-10 shadow-sm">
          <div className="flex items-center gap-3">
             {/* Mobile Logo Only */}
             <div className="md:hidden w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
               <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
               </svg>
             </div>
             <h2 className="text-lg font-semibold text-slate-800">
                {[...navItems, ...adminNavItems].find(n => n.id === activeTab)?.label}
             </h2>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Voucher Status */}
            <div className="flex items-center gap-2 mr-2">
              {isVoucherVerified ? (
                <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-xs font-medium text-green-700 truncate max-w-[120px] hidden sm:inline">{voucherEmail}</span>
                  <button 
                    onClick={onVoucherLogout}
                    className="text-xs text-red-500 hover:text-red-700 font-medium ml-1"
                    title="Logout Voucher"
                  >
                    Keluar
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                  <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                  <span className="text-xs font-medium text-amber-700 hidden sm:inline">Belum Login</span>
                </div>
              )}
            </div>

            {credentials && (
              <div 
                className="text-xs md:text-sm hidden sm:flex items-center gap-2 font-bold animate-pulse cursor-pointer select-all mr-2"
                style={{
                  background: 'linear-gradient(to right, #3b82f6, #8b5cf6, #ec4899)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  textShadow: '0 0 10px rgba(139, 92, 246, 0.3)'
                }}
                title="Copyright"
              >
                <span className="w-2 h-2 rounded-full bg-gradient-to-r from-blue-500 to-purple-500"></span>
                Copy Right By ; TEKNOAIGLOBAL
              </div>
            )}
            
            <a
              href="https://wa.link/sgjf7o"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-full hover:bg-green-50 text-green-600 hover:text-green-700 transition-colors"
              title="Hubungi Admin TEKNO AI (Kendala & Layanan)"
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.008-.57-.008-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
              </svg>
            </a>
          </div>
        </header>

        <div className="p-4 md:p-8 max-w-6xl mx-auto">
          {children}
        </div>
      </main>

      {/* Config Overlay */}
      {showConfig && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-6">
            <div className="space-y-2">
              <h3 className="text-xl font-bold">Cloudflare Credentials</h3>
              <p className="text-sm text-slate-500">Enter your API details to manage your Email Routing settings.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input 
                label="Email" 
                placeholder="user@example.com" 
                value={form.email}
                onChange={e => setForm({...form, email: e.target.value})}
                required
              />
              <div className="space-y-1">
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <Input 
                      label="Global API Key / Token" 
                      type="password" 
                      placeholder="144c9defac04..." 
                      value={form.apiKey}
                      onChange={e => setForm({...form, apiKey: e.target.value})}
                      required
                      className={verificationStatus === 'valid' ? 'border-green-500 focus:ring-green-500' : verificationStatus === 'invalid' ? 'border-red-500 focus:ring-red-500' : ''}
                    />
                  </div>
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={verifyToken}
                    disabled={!form.email || !form.apiKey || verificationStatus === 'checking'}
                    className={`mb-0.5 ${
                      verificationStatus === 'valid' 
                        ? 'border-green-500 text-green-600 hover:bg-green-50 hover:text-green-700 bg-green-50' 
                        : verificationStatus === 'invalid' 
                          ? 'border-red-500 text-red-600 hover:bg-red-50 hover:text-red-700 bg-red-50' 
                          : ''
                    }`}
                  >
                    {verificationStatus === 'checking' ? 'Checking...' : verificationStatus === 'valid' ? 'Valid' : verificationStatus === 'invalid' ? 'Invalid' : 'Verify'}
                  </Button>
                </div>
                {verificationStatus === 'valid' && <p className="text-xs text-green-600 font-medium">Token is valid! Zones loaded successfully.</p>}
                {verificationStatus === 'invalid' && <p className="text-xs text-red-600 font-medium">Token is invalid or email mismatch. Please check your credentials.</p>}
              </div>
              
              <div className="flex justify-end -mt-2">
                <button
                  type="button"
                  onClick={loadZones}
                  disabled={!form.email || !form.apiKey || loadingZones}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50"
                >
                  {loadingZones ? 'Reloading Zones...' : 'Reload Zones'}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Zone / Domain</label>
                  {zones.length > 0 ? (
                    <select
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={form.zoneId}
                      onChange={e => setForm({...form, zoneId: e.target.value})}
                    >
                      <option value="">Select Domain</option>
                      {zones.map(z => (
                        <option key={z.id} value={z.id}>{z.name}</option>
                      ))}
                    </select>
                  ) : (
                    <Input 
                      placeholder="Zone ID (32 chars)" 
                      value={form.zoneId}
                      onChange={e => setForm({...form, zoneId: e.target.value})}
                      required
                    />
                  )}
                </div>
                <Input 
                  label="Account ID" 
                  placeholder="32 chars" 
                  value={form.accountId}
                  onChange={e => setForm({...form, accountId: e.target.value})}
                  required
                />
              </div>

              <div className="pt-2 flex gap-3">
                <Button 
                  type="button" 
                  variant="ghost" 
                  className="flex-1" 
                  onClick={() => credentials && setShowConfig(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" className="flex-1">Save Configuration</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
