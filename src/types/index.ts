export type UserRole = 'director' | 'subdirector' | 'coordinator' | 'assessor' | 'public';

export interface UserProfile {
  id: string;
  email: string;
  entryNumber: string;
  warName: string;
  role: UserRole;
  created: string;
  updated: string;
}

export interface Material {
  id: string;
  name: string;
  description: string;
  category: string;
  status: 'available' | 'cautioned' | 'maintenance';
  currentLocation: string;
  lastUpdatedBy: string;
  created: string;
  updated: string;
}

export interface Caution {
  id: string;
  materialId: string;
  materialName?: string;
  userId: string;
  userName: string;
  cautionedAt: string;
  returnedAt?: string;
  keyUsed: string;
  status: 'active' | 'completed';
}

export interface MaterialAlteration {
  id: string;
  materialId: string;
  explanation: string;
  document: string; // File name/token in PB
  type: 'update' | 'addition' | 'removal';
  status: 'pending' | 'approved' | 'rejected';
  changedBy: string;
  created: string;
}

export interface KeyControl {
  id: string;
  name: string;
  currentHolderId: string;
  notes: string;
  created: string;
  updated: string;
}

export interface AccessRequest {
  id: string;
  requesterName: string;
  materialId: string;
  materialName: string;
  status: 'pending' | 'approved' | 'rejected' | 'vetoed';
  reason?: string;
  plannedDateTime?: string;
  notes?: string;
  authorizedBy?: string;
  vetoedBy?: string;
  created: string;
  isImmutable?: boolean;
}
