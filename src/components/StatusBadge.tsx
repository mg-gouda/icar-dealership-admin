'use client';

import { useLang } from '@/lib/lang-context';

const STATUS_AR: Record<string, string> = {
  DRAFT: 'مسودة',
  PENDING_FINANCE: 'في انتظار التمويل',
  APPROVED: 'موافق عليه',
  FINALIZED: 'مكتمل',
  CANCELLED: 'ملغي',
  REVERSED: 'معكوس',
  AVAILABLE: 'متوفر',
  RESERVED: 'محجوز',
  SOLD: 'مباع',
  IN_TRANSIT: 'في الطريق',
  IN_STOCK: 'في المخزن',
  SERVICE: 'في الصيانة',
  PENDING_INSPECTION: 'في انتظار المعاينة',
  NEW: 'جديد',
  CONTACTED: 'تم التواصل',
  QUALIFIED: 'مؤهل',
  NEGOTIATING: 'قيد التفاوض',
  CLOSED_WON: 'مغلق - فوز',
  CLOSED_LOST: 'مغلق - خسارة',
  CONVERTED: 'محول',
  POSTED: 'مرحل',
  PAID: 'مدفوع',
  PARTIAL: 'جزئي',
  OVERDUE: 'متأخر',
  ACCRUED: 'مستحق',
  PAYABLE: 'واجب الدفع',
};

const colors: Record<string, string> = {
  // Deal
  DRAFT: 'bg-gray-800 text-gray-300',
  PENDING_FINANCE: 'bg-yellow-900/40 text-yellow-300',
  APPROVED: 'bg-blue-900/40 text-blue-300',
  FINALIZED: 'bg-green-900/40 text-green-300',
  CANCELLED: 'bg-red-900/40 text-red-300',
  // Vehicle
  AVAILABLE: 'bg-green-900/40 text-green-300',
  RESERVED: 'bg-yellow-900/40 text-yellow-300',
  SOLD: 'bg-gray-800 text-gray-400',
  IN_TRANSIT: 'bg-blue-900/40 text-blue-300',
  PENDING_INSPECTION: 'bg-orange-900/40 text-orange-300',
  // Lead
  NEW: 'bg-blue-900/40 text-blue-300',
  CONTACTED: 'bg-purple-900/40 text-purple-300',
  QUALIFIED: 'bg-teal-900/40 text-teal-300',
  NEGOTIATING: 'bg-orange-900/40 text-orange-300',
  CLOSED_WON: 'bg-green-900/40 text-green-300',
  CLOSED_LOST: 'bg-red-900/40 text-red-300',
  CONVERTED: 'bg-green-900/40 text-green-300',
  // Finance
  POSTED: 'bg-green-900/40 text-green-300',
  PAID: 'bg-green-900/40 text-green-300',
  PARTIAL: 'bg-yellow-900/40 text-yellow-300',
  OVERDUE: 'bg-red-900/40 text-red-300',
  // Commission
  ACCRUED: 'bg-blue-900/40 text-blue-300',
  PAYABLE: 'bg-yellow-900/40 text-yellow-300',
};

export default function StatusBadge({ status }: { status: string }) {
  const { isAr } = useLang();
  const cls = colors[status] ?? 'bg-gray-800 text-gray-300';
  const label = isAr ? (STATUS_AR[status] ?? status.replace(/_/g, ' ')) : status.replace(/_/g, ' ');
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}
