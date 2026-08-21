import { api } from './api';

export type AuditAction = 'CREATE' | 'UPDATE' | 'DEACTIVATE' | 'ACTIVATE';
export type AuditEntityType = 'PRICING' | 'SERVICE' | 'DOCTOR';

export interface AuditLogRecord {
  id: string;
  admin_id: string;
  admin_username: string;
  action: AuditAction;
  entity_type: AuditEntityType;
  entity_id: string;
  record_context: Record<string, unknown> | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  created_at: string;
}

export interface AuditLogFilters {
  entityType?: AuditEntityType;
  action?: string;
}

export type AuditLogResponse = {
  data: AuditLogRecord[];
};

export const getAuditLogs = async (filters?: AuditLogFilters): Promise<AuditLogRecord[]> => {
  const response = await api.get<AuditLogResponse>('/admin/audit-logs', {
    params: filters,
  });

  return response.data.data;
};
