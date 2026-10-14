import { DedicationRecord, UserProfile, PastDedicationRecord, StaffInvitation, AuditLog } from '../types';

const TOKEN_KEY = 'dcu_auth_session_token_v3';
let memoryToken: string | null = null;

export function getSessionToken(): string | null {
  try {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (stored) return stored;
  } catch {
    // localStorage restricted or disabled in iframe
  }
  return memoryToken;
}

export function setSessionToken(token: string | null) {
  memoryToken = token;
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // localStorage blocked
  }
}

function getAuthHeaders(extraHeaders: Record<string, string> = {}): Record<string, string> {
  const token = getSessionToken();
  const headers: Record<string, string> = { ...extraHeaders };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export const api = {
  // ==========================================
  // AUTHENTICATION
  // ==========================================

  async login(email: string, password: string): Promise<{ user: UserProfile; token: string; requiresMfa?: boolean }> {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Login failed' }));
      throw new Error(err.error || 'Invalid credentials');
    }

    const data = await res.json();
    if (data.token) {
      setSessionToken(data.token);
    }
    return data;
  },

  async registerParent(data: {
    email: string;
    password: string;
    name: string;
    phone?: string;
  }): Promise<{ user: UserProfile; token: string }> {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...data,
        role: 'parent' // Strictly parent
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Registration failed' }));
      throw new Error(err.error || 'Registration failed');
    }

    const result = await res.json();
    if (result.token) {
      setSessionToken(result.token);
    }
    return result;
  },

  async loginGoogle(payload: {
    email: string;
    name?: string;
    avatar?: string;
    invitationToken?: string;
  }): Promise<{ user: UserProfile; token: string }> {
    const res = await fetch('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Google authentication failed' }));
      throw new Error(err.error || 'Google authentication failed');
    }

    const data = await res.json();
    if (data.token) {
      setSessionToken(data.token);
    }
    return data;
  },

  async acceptInvitation(payload: {
    token: string;
    email: string;
    password: string;
    name?: string;
    phone?: string;
  }): Promise<{ user: UserProfile; token: string }> {
    const res = await fetch('/api/auth/accept-invitation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to accept invitation' }));
      throw new Error(err.error || 'Failed to accept invitation');
    }

    const data = await res.json();
    if (data.token) {
      setSessionToken(data.token);
    }
    return data;
  },

  async verifyInvitation(token: string, email?: string): Promise<any> {
    const query = new URLSearchParams({ token });
    if (email) query.set('email', email);
    const res = await fetch(`/api/auth/verify-invitation?${query.toString()}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Invalid invitation' }));
      throw new Error(err.error || 'Invalid invitation');
    }
    return res.json();
  },

  async getMe(): Promise<UserProfile> {
    const res = await fetch('/api/auth/me', {
      headers: getAuthHeaders()
    });
    if (!res.ok) {
      throw new Error('Not authenticated');
    }
    return res.json();
  },

  async logout(): Promise<void> {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: getAuthHeaders()
      });
    } finally {
      setSessionToken(null);
    }
  },

  // Emergency / Initial Admin Setup
  async bootstrapAdmin(payload: {
    bootstrapSecret: string;
    email: string;
    password: string;
    name?: string;
  }): Promise<{ user: UserProfile; token: string }> {
    const res = await fetch('/api/security/bootstrap-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Bootstrap failed' }));
      throw new Error(err.error || 'Bootstrap failed');
    }
    const data = await res.json();
    if (data.token) {
      setSessionToken(data.token);
    }
    return data;
  },

  // ==========================================
  // DEDICATIONS DATA
  // ==========================================

  async getDedications(): Promise<DedicationRecord[]> {
    const res = await fetch('/api/dedications', {
      headers: getAuthHeaders()
    });
    if (!res.ok) {
      if (res.status === 401) {
        return []; // Visitors or unauthenticated users cannot view records
      }
      throw new Error(`Failed to fetch dedications (${res.status})`);
    }
    return res.json();
  },

  async createDedication(record: Partial<DedicationRecord>): Promise<DedicationRecord> {
    const res = await fetch('/api/dedications', {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(record)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to create record' }));
      throw new Error(err.error || 'Submission failed');
    }
    return res.json();
  },

  async trackDedication(id: string, phone?: string): Promise<any> {
    const query = new URLSearchParams({ id });
    if (phone) query.set('phone', phone);
    const res = await fetch(`/api/dedications/track?${query.toString()}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Tracking failed' }));
      throw new Error(err.error || 'Record not found');
    }
    return res.json();
  },

  async updateDedication(id: string, updates: Partial<DedicationRecord>): Promise<DedicationRecord> {
    const res = await fetch(`/api/dedications/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(updates)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Update failed' }));
      throw new Error(err.error || 'Failed to update record');
    }
    return res.json();
  },

  async deleteDedication(id: string): Promise<boolean> {
    const res = await fetch(`/api/dedications/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Delete failed' }));
      throw new Error(err.error || 'Failed to delete record');
    }
    return true;
  },

  async bulkImport(records: any[]): Promise<{ count: number; total: number }> {
    const res = await fetch('/api/dedications/bulk-import', {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(records)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Bulk import failed' }));
      throw new Error(err.error || 'Bulk import failed');
    }
    return res.json();
  },

  // ==========================================
  // PAST / HISTORICAL DEDICATIONS (2009+)
  // ==========================================

  async getPastDedications(): Promise<PastDedicationRecord[]> {
    const res = await fetch('/api/past-dedications', {
      headers: getAuthHeaders()
    });
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) return [];
      throw new Error('Failed to load past dedications');
    }
    return res.json();
  },

  async createPastDedication(record: Partial<PastDedicationRecord>): Promise<PastDedicationRecord> {
    const res = await fetch('/api/past-dedications', {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(record)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to create past record' }));
      throw new Error(err.error || 'Failed to create past record');
    }
    return res.json();
  },

  async bulkImportPastDedications(records: any[]): Promise<{ success: boolean; count: number }> {
    const res = await fetch('/api/past-dedications/bulk-import', {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(records)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Bulk import failed' }));
      throw new Error(err.error || 'Bulk import failed');
    }
    return res.json();
  },

  async updatePastDedication(id: string, updates: Partial<PastDedicationRecord>): Promise<PastDedicationRecord> {
    const res = await fetch(`/api/past-dedications/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(updates)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to update record' }));
      throw new Error(err.error || 'Failed to update record');
    }
    return res.json();
  },

  async deletePastDedication(id: string): Promise<boolean> {
    const res = await fetch(`/api/past-dedications/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Delete failed' }));
      throw new Error(err.error || 'Delete failed');
    }
    return true;
  },

  // ==========================================
  // STAFF & ROLE MANAGEMENT (Super Admin)
  // ==========================================

  async getUsers(): Promise<UserProfile[]> {
    const res = await fetch('/api/users', {
      headers: getAuthHeaders()
    });
    if (!res.ok) {
      return [];
    }
    return res.json();
  },

  async inviteStaff(payload: {
    email: string;
    name?: string;
    role: 'super_admin' | 'office_admin' | 'pastor' | 'fellowship_leader';
    assignedZone?: 'Zone A' | 'Zone B' | 'Zone C' | 'Zone D' | 'Zone E';
  }): Promise<{ invitation: StaffInvitation; rawToken: string; inviteUrl: string }> {
    const res = await fetch('/api/users/invite', {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to issue invitation' }));
      throw new Error(err.error || 'Failed to issue invitation');
    }
    return res.json();
  },

  async getInvitations(): Promise<StaffInvitation[]> {
    const res = await fetch('/api/invitations', {
      headers: getAuthHeaders()
    });
    if (!res.ok) return [];
    return res.json();
  },

  async revokeInvitation(id: string): Promise<boolean> {
    const res = await fetch(`/api/invitations/${id}/revoke`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to revoke' }));
      throw new Error(err.error || 'Failed to revoke');
    }
    return true;
  },

  async updateUserRole(id: string, role: string, assignedZone?: string): Promise<UserProfile> {
    const res = await fetch(`/api/users/${id}/role`, {
      method: 'PUT',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ role, assignedZone })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to update user role' }));
      throw new Error(err.error || 'Failed to update user role');
    }
    return res.json();
  },

  async updateUserStatus(id: string, isSuspended: boolean): Promise<UserProfile> {
    const res = await fetch(`/api/users/${id}/status`, {
      method: 'PUT',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ isSuspended })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to update user status' }));
      throw new Error(err.error || 'Failed to update user status');
    }
    return res.json();
  },

  async deleteUser(id: string): Promise<boolean> {
    const res = await fetch(`/api/users/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to delete user' }));
      throw new Error(err.error || 'Failed to delete user');
    }
    return true;
  },

  // ==========================================
  // AUDIT LOGS & EXPORT TRACKING
  // ==========================================

  async getAuditLogs(): Promise<AuditLog[]> {
    const res = await fetch('/api/audit-logs', {
      headers: getAuthHeaders()
    });
    if (!res.ok) return [];
    return res.json();
  },

  async logExport(exportType: string, recordCount: number): Promise<void> {
    try {
      await fetch('/api/audit/log-export', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ exportType, recordCount })
      });
    } catch {
      // non-blocking
    }
  }
};
