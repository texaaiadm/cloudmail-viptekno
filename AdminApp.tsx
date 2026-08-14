import React, { useState, useEffect, useMemo } from 'react';
import { CloudflareCredentials, Settings } from './types';
import { CloudflareService } from './services/cloudflareApi';
import { Layout } from './components/Layout';
import { Button } from './components/ui/Button';
import { Input } from './components/ui/Input';

type MemberRecord = {
  id: string;
  name: string;
  email: string;
  wa: string;
  exp?: number;
  cooldownHours?: number;
  cooldownEnabled?: boolean;
  createdAt?: string;
};

const AdminApp: React.FC = () => {
  const [credentials, setCredentials] = useState<CloudflareCredentials | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [members, setMembers] = useState<MemberRecord[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [newWa, setNewWa] = useState('');
  const [durationMode, setDurationMode] = useState<'monthly' | 'custom'>('monthly');
  const [durationValue, setDurationValue] = useState<number>(1);
  const [cooldownHours, setCooldownHours] = useState<number>(8);
  const [actionLoading, setActionLoading] = useState(false);

  // State edit inline per member
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editEmail, setEditEmail] = useState('');
  const [editWa, setEditWa] = useState('');
  const [editDurationMode, setEditDurationMode] = useState<'monthly' | 'custom'>('monthly');
  const [editDurationValue, setEditDurationValue] = useState<number>(1);
  const [editCooldownHours, setEditCooldownHours] = useState<number>(8);
  const [editCooldownEnabled, setEditCooldownEnabled] = useState<boolean>(true);

  const [isAdminVerified, setIsAdminVerified] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [adminLoginError, setAdminLoginError] = useState<string | null>(null);

  // State untuk form Pengaturan Kredensial
  const [credEmail, setCredEmail] = useState('');
  const [credApiKey, setCredApiKey] = useState('');
  const [credZoneId, setCredZoneId] = useState('');
  const [credAccountId, setCredAccountId] = useState('');
  const [credMailbox, setCredMailbox] = useState('');
  const [credPassword, setCredPassword] = useState('');
  const [credLoading, setCredLoading] = useState(false);
  const [credMessage, setCredMessage] = useState('');

  useEffect(() => {
    if (localStorage.getItem('adminPanelVerified') === 'true') {
      setIsAdminVerified(true);
    }
  }, []);

  const handleAdminLogin = () => {
    if (adminPasswordInput === 'Tekno@Project03') {
      setIsAdminVerified(true);
      localStorage.setItem('adminPanelVerified', 'true');
      setAdminLoginError(null);
    } else {
      setAdminLoginError('Password salah!');
    }
  };

  const api = useMemo(() => credentials ? new CloudflareService(credentials) : null, [credentials]);

  useEffect(() => {
    const localCreds = localStorage.getItem('cf_creds');
    if (localCreds) {
      try {
        const parsed = JSON.parse(localCreds);
        setCredentials(parsed);
        setCredEmail(parsed.email || '');
        setCredApiKey(parsed.apiKey || '');
        setCredZoneId(parsed.zoneId || '');
        setCredAccountId(parsed.accountId || '');
        // default mailbox
        setCredMailbox('tekno@emalupe.com');
        setCredPassword('teknoaiglobal');
      } catch (err: any) {
        setError(err.message);
      }
    } else {
      // Fallback ke default environment variables atau hardcoded fallback (untuk setup awal)
      const envEmail = import.meta.env.VITE_CF_EMAIL || 'cloudflare@email.teknoaiglobal.com';
      const envApiKey = import.meta.env.VITE_CF_API_KEY || 'bdf5ebe35a625271b4a1507c87aa3dfc3353c';
      const envZoneId = import.meta.env.VITE_CF_ZONE_ID || '5ad57fb06e03cc145dee0d6efe068ce0';
      const envAccountId = import.meta.env.VITE_CF_ACCOUNT_ID || '64775c16472d1c2fa00c0b8abce4d24e';

      if (envEmail && envApiKey && envZoneId) {
        const defaultCreds = {
          email: envEmail,
          apiKey: envApiKey,
          zoneId: envZoneId,
          accountId: envAccountId
        };
        setCredentials(defaultCreds);
        setCredEmail(envEmail);
        setCredApiKey(envApiKey);
        setCredZoneId(envZoneId);
        setCredAccountId(envAccountId);
      }

      // set defaults
      setCredMailbox('tekno@emalupe.com');
      setCredPassword('teknoaiglobal');
    }
  }, []);

  const fetchData = async () => {
    if (!api) return;
    setLoading(true);
    try {
      const s = await api.getSettings();
      setSettings(s.result);
      
      const domainName = s.result.name.replace(/\.$/, '');
      const zoneRecords = await api.listZoneDnsRecords();
      const records = zoneRecords.result || [];
      
      const memberPrefix = `_member.${domainName}`;
      
      const parsedMembers: MemberRecord[] = records
        .filter((r: any) => r.type === 'TXT' && r.name === memberPrefix)
        .map((r: any) => {
           // parse "email:xxx|wa:yyy|exp:zzz|cooldown_h:8|cooldown_on:1"
           const content = r.content || '';
           const emailMatch = content.match(/email:([^|]+)/);
           const waMatch = content.match(/wa:([^|]+)/);
           const expMatch = content.match(/exp:(\d+)/);
           const cooldownMatch = content.match(/cooldown_h:(\d+)/);
           const cooldownOnMatch = content.match(/cooldown_on:(\d+)/);
           return {
               id: r.id,
               name: r.name,
               email: emailMatch ? emailMatch[1] : 'Unknown',
               wa: waMatch ? waMatch[1] : '',
               exp: expMatch ? parseInt(expMatch[1]) : undefined,
               cooldownHours: cooldownMatch ? parseInt(cooldownMatch[1]) : undefined,
               cooldownEnabled: cooldownOnMatch ? cooldownOnMatch[1] === '1' : true,
               createdAt: r.created_on
           };
        });
        
      setMembers(parsedMembers);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (credentials) fetchData();
  }, [credentials]);

  const handleAddMember = async () => {
      if (!api || !settings) return;
      if (!newEmail || !newWa) {
          alert('Email dan WhatsApp harus diisi');
          return;
      }
      
      setActionLoading(true);
      try {
          const domainName = settings.name.replace(/\.$/, '');
          const expTimestamp = durationMode === 'monthly'
              ? Date.now() + (durationValue * 30 * 24 * 60 * 60 * 1000)
              : Date.now() + (durationValue * 24 * 60 * 60 * 1000);

          const content = `email:${newEmail}|wa:${newWa}|exp:${expTimestamp}|cooldown_h:${cooldownHours}|cooldown_on:1`;
          await api.createZoneDnsRecord({
              type: 'TXT',
              name: `_member.${domainName}`,
              content: content
          });
          
          setNewEmail('');
          setNewWa('');
          await fetchData();
      } catch (err: any) {
          alert('Gagal menambah member: ' + err.message);
      } finally {
          setActionLoading(false);
      }
  };

  const handleDeleteMember = async (id: string) => {
      if (!api) return;
      if (!confirm('Yakin ingin menghapus member ini?')) return;
      
      setActionLoading(true);
      try {
          await api.deleteZoneDnsRecord(id);
          await fetchData();
      } catch (err: any) {
          alert('Gagal menghapus member: ' + err.message);
      } finally {
          setActionLoading(false);
      }
  };

  const handleStartEdit = (member: MemberRecord) => {
    setEditingMemberId(member.id);
    setEditEmail(member.email);
    setEditWa(member.wa);
    setEditCooldownHours(member.cooldownHours ?? 8);
    setEditCooldownEnabled(member.cooldownEnabled ?? true);
    // Hitung durasi dari exp
    if (member.exp) {
      const remainingMs = member.exp - Date.now();
      if (remainingMs > 0) {
        const remainingDays = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
        if (remainingDays % 30 === 0 && remainingDays >= 30) {
          setEditDurationMode('monthly');
          setEditDurationValue(remainingDays / 30);
        } else {
          setEditDurationMode('custom');
          setEditDurationValue(remainingDays);
        }
      } else {
        setEditDurationMode('custom');
        setEditDurationValue(1);
      }
    } else {
      setEditDurationMode('monthly');
      setEditDurationValue(1);
    }
  };

  const handleCancelEdit = () => {
    setEditingMemberId(null);
  };

  const handleSaveEdit = async (member: MemberRecord) => {
    if (!api || !settings) return;
    setActionLoading(true);
    try {
      const expTimestamp = editDurationMode === 'monthly'
        ? Date.now() + (editDurationValue * 30 * 24 * 60 * 60 * 1000)
        : Date.now() + (editDurationValue * 24 * 60 * 60 * 1000);
      const content = `email:${editEmail}|wa:${editWa}|exp:${expTimestamp}|cooldown_h:${editCooldownHours}|cooldown_on:${editCooldownEnabled ? '1' : '0'}`;
      await api.updateZoneDnsRecord(member.id, {
        type: 'TXT',
        name: member.name,
        content: content,
        ttl: 1
      });
      setEditingMemberId(null);
      await fetchData();
    } catch (err: any) {
      alert('Gagal menyimpan edit: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleCooldown = async (member: MemberRecord, enabled: boolean) => {
    if (!api || !settings) return;
    setActionLoading(true);
    try {
      const newContent = member.name; // name is the record name like _member.domain.com
      // Read current content and replace cooldown_on value
      // We need the raw content from DNS, but we reconstructed it
      const exp = member.exp ?? (Date.now() + 30 * 24 * 60 * 60 * 1000);
      const content = `email:${member.email}|wa:${member.wa}|exp:${exp}|cooldown_h:${member.cooldownHours ?? 8}|cooldown_on:${enabled ? '1' : '0'}`;
      await api.updateZoneDnsRecord(member.id, {
        type: 'TXT',
        name: member.name,
        content: content,
        ttl: 1
      });
      // Update local state langsung
      setMembers(prev => prev.map(m => m.id === member.id ? { ...m, cooldownEnabled: enabled } : m));
    } catch (err: any) {
      alert('Gagal toggle cooldown: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const formatWaLink = (wa: string) => {
      let cleanWa = wa.replace(/\D/g, '');
      if (cleanWa.startsWith('0')) {
          cleanWa = '62' + cleanWa.substring(1);
      } else if (!cleanWa.startsWith('62')) {
          cleanWa = '62' + cleanWa; // Assume indonesian if no country code
      }
      return `https://wa.me/${cleanWa}`;
  };

  const handleSaveCredentials = async () => {
    setCredLoading(true);
    setCredMessage('');
    try {
      const newCreds = {
        email: credEmail,
        apiKey: credApiKey,
        zoneId: credZoneId,
        accountId: credAccountId
      };
      
      localStorage.setItem('cf_creds', JSON.stringify(newCreds));
      setCredentials(newCreds);
      setCredMessage('Kredensial berhasil disimpan di browser!');
      
      setTimeout(() => setCredMessage(''), 3000);
    } catch (err: any) {
      alert('Gagal menyimpan kredensial: ' + err.message);
    } finally {
      setCredLoading(false);
    }
  };

  if (!isAdminVerified) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-96 h-96 bg-blue-600 rounded-full mix-blend-multiply filter blur-[100px] opacity-40"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-96 h-96 bg-purple-600 rounded-full mix-blend-multiply filter blur-[100px] opacity-40"></div>
        
        <div className="bg-slate-800/80 backdrop-blur-xl p-8 rounded-2xl shadow-2xl w-full max-w-md border border-slate-700 relative z-10">
           <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-500/20">
               <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
               </svg>
           </div>
           <h2 className="text-2xl font-bold text-center mb-2 text-white">Portal Admin</h2>
           <p className="text-slate-400 text-sm mb-6 text-center">
             Akses terbatas. Masukkan password admin untuk mengelola member.
           </p>
           {adminLoginError && (
             <div className="p-3 bg-red-500/20 text-red-300 rounded-lg text-sm mb-4 border border-red-500/30 text-center">
               {adminLoginError}
             </div>
           )}
           <div className="space-y-4">
              <Input 
                 type="password"
                 placeholder="Password Admin" 
                 value={adminPasswordInput}
                 onChange={(e) => setAdminPasswordInput(e.target.value)}
                 className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500"
                 onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                   if (e.key === 'Enter') handleAdminLogin();
                 }}
              />
              <Button 
                 onClick={handleAdminLogin} 
                 disabled={!adminPasswordInput} 
                 className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white border-0"
              >
                 Masuk Panel Admin
              </Button>
           </div>
        </div>
      </div>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-slate-800">Admin - Manajemen Member Langganan</h1>
        <p className="text-slate-600">Member yang terdaftar di sini dapat menggunakan email mereka sebagai voucher untuk login ke aplikasi utama.</p>
        
        {loading && <div className="text-slate-500">Memuat data...</div>}
        {error && <div className="p-4 bg-red-50 text-red-600 rounded-lg">{error}</div>}
        
        {!loading && !error && (
            <div className="space-y-6">
                {/* Panel Kredensial Server */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h2 className="text-lg font-semibold mb-4 text-slate-800">Pengaturan Kredensial Server</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <Input label="Cloudflare Email" value={credEmail} onChange={e => setCredEmail(e.target.value)} />
                        <Input label="Global API Key / Token" type="password" value={credApiKey} onChange={e => setCredApiKey(e.target.value)} />
                        <Input label="Zone ID" value={credZoneId} onChange={e => setCredZoneId(e.target.value)} />
                        <Input label="Account ID" value={credAccountId} onChange={e => setCredAccountId(e.target.value)} />
                        <Input label="Mailbox Email" value={credMailbox} onChange={e => setCredMailbox(e.target.value)} />
                        <Input label="Mailbox Password" type="text" value={credPassword} onChange={e => setCredPassword(e.target.value)} />
                    </div>
                    {credMessage && <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-lg text-sm">{credMessage}</div>}
                    <Button onClick={handleSaveCredentials} disabled={credLoading} className="w-full md:w-auto bg-slate-800 hover:bg-slate-900">
                        {credLoading ? 'Menyimpan...' : 'Simpan Kredensial'}
                    </Button>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h2 className="text-lg font-semibold mb-4">Tambah Member Baru</h2>
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-col md:flex-row gap-4">
                            <Input 
                                placeholder="Email (Voucher)" 
                                value={newEmail} 
                                onChange={e => setNewEmail(e.target.value)}
                                className="flex-1"
                            />
                            <Input 
                                placeholder="No WhatsApp" 
                                value={newWa} 
                                onChange={e => setNewWa(e.target.value)}
                                className="flex-1"
                            />
                        </div>
                        <div className="flex flex-col md:flex-row gap-4">
                            <select 
                                value={durationMode} 
                                onChange={e => setDurationMode(e.target.value as any)}
                                className="px-3 py-2 bg-white border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="monthly">Bulanan</option>
                                <option value="custom">Hari (Custom)</option>
                            </select>
                            <Input 
                                type="number"
                                min={1}
                                placeholder={durationMode === 'monthly' ? "Jumlah Bulan" : "Jumlah Hari"} 
                                value={durationValue.toString()} 
                                onChange={e => setDurationValue(parseInt(e.target.value) || 1)}
                                className="flex-1"
                            />
                            <Input 
                                type="number"
                                min={1}
                                max={72}
                                label="Cooldown (Jam)"
                                placeholder="Default 8 jam" 
                                value={cooldownHours.toString()} 
                                onChange={e => setCooldownHours(parseInt(e.target.value) || 8)}
                                className="w-32"
                            />
                            <Button 
                                onClick={handleAddMember} 
                                disabled={actionLoading || !newEmail || !newWa || durationValue < 1}
                            >
                                {actionLoading ? 'Menyimpan...' : 'Tambah Member'}
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Email (Voucher)</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">WhatsApp</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Cooldown</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status Expired</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                            {members.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-4 text-center text-sm text-slate-500">Belum ada member terdaftar</td>
                                </tr>
                            ) : members.map((member) => (
                                editingMemberId === member.id ? (
                                /* === INLINE EDIT MODE === */
                                <tr key={member.id} className="bg-blue-50/50">
                                    <td className="px-4 py-3">
                                        <Input 
                                            placeholder="Email" 
                                            value={editEmail} 
                                            onChange={e => setEditEmail(e.target.value)}
                                            className="text-sm"
                                        />
                                    </td>
                                    <td className="px-4 py-3">
                                        <Input 
                                            placeholder="WhatsApp" 
                                            value={editWa} 
                                            onChange={e => setEditWa(e.target.value)}
                                            className="text-sm"
                                        />
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <Input 
                                                type="number"
                                                min={1}
                                                max={72}
                                                value={editCooldownHours.toString()} 
                                                onChange={e => setEditCooldownHours(parseInt(e.target.value) || 1)}
                                                className="w-20 text-sm"
                                            />
                                            <span className="text-xs text-slate-500">jam</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <select 
                                                value={editDurationMode} 
                                                onChange={e => setEditDurationMode(e.target.value as any)}
                                                className="px-2 py-1 border border-slate-300 rounded text-xs"
                                            >
                                                <option value="monthly">Bulan</option>
                                                <option value="custom">Hari</option>
                                            </select>
                                            <Input 
                                                type="number"
                                                min={1}
                                                value={editDurationValue.toString()} 
                                                onChange={e => setEditDurationValue(parseInt(e.target.value) || 1)}
                                                className="w-16 text-sm"
                                            />
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <Button size="sm" onClick={() => handleSaveEdit(member)} disabled={actionLoading}>
                                                Simpan
                                            </Button>
                                            <Button size="sm" variant="ghost" onClick={handleCancelEdit} disabled={actionLoading}>
                                                Batal
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                                ) : (
                                /* === VIEW MODE === */
                                <tr key={member.id}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{member.email}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                        <a 
                                            href={formatWaLink(member.wa)} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1"
                                        >
                                            {member.wa}
                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                            </svg>
                                        </a>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleToggleCooldown(member, !(member.cooldownEnabled ?? true))}
                                                disabled={actionLoading}
                                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                                                    (member.cooldownEnabled ?? true) ? 'bg-blue-600' : 'bg-slate-300'
                                                }`}
                                            >
                                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                                    (member.cooldownEnabled ?? true) ? 'translate-x-4' : 'translate-x-0.5'
                                                }`} />
                                            </button>
                                            <span className={`text-xs font-medium ${(member.cooldownEnabled ?? true) ? 'text-blue-600' : 'text-slate-400'}`}>
                                                {member.cooldownHours ?? 8}j {(member.cooldownEnabled ?? true) ? 'ON' : 'OFF'}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                        {member.exp ? (
                                            member.exp > Date.now() ? (
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                    Aktif s/d {new Date(member.exp).toLocaleDateString('id-ID')}
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                                    Kedaluwarsa
                                                </span>
                                            )
                                        ) : (
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                                                Selamanya
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <div className="flex items-center justify-end gap-2">
                                            <button 
                                                onClick={() => handleStartEdit(member)}
                                                className="text-blue-600 hover:text-blue-900"
                                                disabled={actionLoading}
                                            >
                                                Edit
                                            </button>
                                            <button 
                                                onClick={() => handleDeleteMember(member.id)}
                                                className="text-red-600 hover:text-red-900"
                                                disabled={actionLoading}
                                            >
                                                Hapus
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )))}
                        </tbody>
                    </table>
                </div>
            </div>
        )}
      </div>
    </Layout>
  );
};

export default AdminApp;
