export type EnrollmentStatus = "pending" | "active" | "suspended" | "graduated";

export type Student = {
  id: string;
  email: string;
  full_name: string;
  student_number: string;
  program: string;
  enrollment_status: EnrollmentStatus;
  photo_url: string | null;
  created_at: string;
  has_active_credential?: boolean;
};

export type AdminUser = { id: string; email: string; full_name: string };

export type User = (Student & { role: "student" }) | (AdminUser & { role: "admin" });

export type Credential = {
  id: string;
  student_id: string;
  credential_uid: string;
  status: "active" | "revoked";
  device_label: string;
  issued_at: string;
  revoked_at: string | null;
  revoke_reason: string | null;
};

export type Building = { id: string; name: string; code: string; description: string; permitted?: boolean; permitted_students?: number };

export type MeResponse = { student: Student; credential: Credential | null; buildings: Building[]; token_ttl_seconds: number };

export type TapToken = { token: string; nonce: string; expires_at: number; ttl_seconds: number };

export type VerificationResult = {
  granted: boolean;
  result: "granted" | "denied";
  reason: string;
  message: string;
  building: Building | null;
  student: { id: string; full_name: string; student_number: string } | null;
  reader_id: string;
  method: "nfc" | "qr";
  verified_at: string;
  log_id: string;
  presented_token?: string;
};

export type LogEntry = {
  id: string;
  student_id: string | null;
  student_name: string | null;
  student_number: string | null;
  building_id: string | null;
  building_name: string | null;
  reader_id: string;
  method: "nfc" | "qr";
  result: "granted" | "denied";
  reason: string;
  message: string;
  created_at: string;
};

export type ActiveCredential = Credential & { student_name: string; student_number: string; enrollment_status: EnrollmentStatus };

export type Analytics = {
  totals: {
    students: number;
    students_by_status: Record<EnrollmentStatus, number>;
    active_credentials: number;
    revoked_credentials: number;
    buildings: number;
    granted_today: number;
    denied_today: number;
    attempts_7d: number;
  };
  daily: { date: string; granted: number; denied: number }[];
  by_building: { building: string; granted: number; denied: number }[];
  denial_reasons: { reason: string; message: string; count: number }[];
  recent_denied: LogEntry[];
};

export type StudentDetail = { student: Student; credentials: Credential[]; permitted_building_ids: string[]; recent_logs: LogEntry[] };
