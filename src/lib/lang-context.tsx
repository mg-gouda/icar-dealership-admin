'use client';

import { createContext, useContext, useEffect, useState } from 'react';

export type Lang = 'ar' | 'en';

/* ─── Translation dictionaries ──────────────────────────────────────────── */
export const ar: Record<string, string> = {
  // Navigation
  'nav.dashboard': 'لوحة التحكم',
  'nav.inventory': 'المخزن',
  'nav.imports': 'الاستيراد',
  'nav.crm': 'العملاء المحتملون',
  'nav.reports': 'التقارير',
  'nav.whatsapp': 'واتساب',
  'nav.deals': 'الصفقات',
  'nav.appointments': 'المواعيد',
  'nav.service': 'مركز الصيانة',
  'nav.parts': 'قطع الغيار',
  'nav.transfers': 'التحويلات',
  'nav.floorplan': 'قروض المعرض',
  'nav.pettycash': 'المصروفات النثرية',
  'nav.finance': 'المالية',
  'nav.commissions': 'عمولاتي',
  'nav.executive': 'عرض المديرين',
  'nav.users': 'المستخدمون والفروع',
  'nav.auditlog': 'سجل المراجعة',
  'nav.settings': 'الإعدادات',
  'nav.purchaseorders': 'أوامر الشراء',
  'app.name': 'ديلر إم إس',
  'app.subtitle': 'منصة الإدارة',

  // Common actions
  'btn.save': 'حفظ',
  'btn.cancel': 'إلغاء',
  'btn.delete': 'حذف',
  'btn.edit': 'تعديل',
  'btn.add': 'إضافة',
  'btn.search': 'بحث',
  'btn.filter': 'تصفية',
  'btn.export': 'تصدير',
  'btn.apply': 'تطبيق',
  'btn.reset': 'إعادة تعيين',
  'btn.submit': 'إرسال',
  'btn.close': 'إغلاق',
  'btn.back': 'رجوع',
  'btn.next': 'التالي',
  'btn.previous': 'السابق',
  'btn.view': 'عرض',
  'btn.download': 'تحميل',
  'btn.upload': 'رفع',
  'btn.print': 'طباعة',
  'btn.confirm': 'تأكيد',
  'btn.new': 'جديد',
  'btn.create': 'إنشاء',
  'btn.publish': 'نشر',
  'btn.post': 'ترحيل',
  'btn.reverse': 'عكس',
  'btn.approve': 'موافقة',
  'btn.reject': 'رفض',
  'btn.signout': 'تسجيل الخروج',

  // Common labels
  'lbl.name': 'الاسم',
  'lbl.email': 'البريد الإلكتروني',
  'lbl.phone': 'الهاتف',
  'lbl.address': 'العنوان',
  'lbl.city': 'المدينة',
  'lbl.date': 'التاريخ',
  'lbl.amount': 'المبلغ',
  'lbl.notes': 'ملاحظات',
  'lbl.description': 'الوصف',
  'lbl.status': 'الحالة',
  'lbl.actions': 'الإجراءات',
  'lbl.total': 'الإجمالي',
  'lbl.from': 'من',
  'lbl.to': 'إلى',
  'lbl.type': 'النوع',
  'lbl.all': 'الكل',
  'lbl.none': 'لا يوجد',
  'lbl.required': 'مطلوب',
  'lbl.optional': 'اختياري',
  'lbl.active': 'نشط',
  'lbl.inactive': 'غير نشط',
  'lbl.yes': 'نعم',
  'lbl.no': 'لا',
  'lbl.reference': 'المرجع',
  'lbl.createdAt': 'تاريخ الإنشاء',
  'lbl.updatedAt': 'آخر تحديث',
  'lbl.location': 'الفرع',
  'lbl.allLocations': 'كل الفروع',
  'lbl.currency': 'العملة',
  'lbl.egp': 'جنيه',

  // States
  'state.loading': 'جاري التحميل…',
  'state.noData': 'لا توجد بيانات',
  'state.noResults': 'لا توجد نتائج',
  'state.error': 'حدث خطأ',
  'state.saved': 'تم الحفظ بنجاح',
  'state.deleted': 'تم الحذف بنجاح',
  'state.saving': 'جاري الحفظ…',

  // Vehicle
  'vehicle.vehicle': 'مركبة',
  'vehicle.new': 'مركبة جديدة',
  'vehicle.used': 'مركبة مستعملة',
  'vehicle.add': 'إضافة مركبة',
  'vehicle.make': 'الشركة المصنعة',
  'vehicle.model': 'الطراز',
  'vehicle.year': 'سنة الصنع',
  'vehicle.vin': 'رقم الشاسيه',
  'vehicle.color': 'اللون',
  'vehicle.condition': 'الحالة',
  'vehicle.price': 'السعر',
  'vehicle.mileage': 'عداد الكيلومترات',
  'vehicle.bodyType': 'نوع الشاسيه',
  'vehicle.fuelType': 'نوع الوقود',
  'vehicle.transmission': 'ناقل الحركة',
  'vehicle.engineSize': 'سعة المحرك',
  'vehicle.hp': 'حصان',
  'vehicle.torque': 'عزم الدوران (ن.م)',
  'vehicle.driveType': 'نوع الدفع',
  'vehicle.gearType': 'نوع ناقل الحركة',
  'vehicle.doors': 'عدد الأبواب',
  'vehicle.seats': 'عدد المقاعد',
  'vehicle.features': 'المميزات',
  'vehicle.photos': 'الصور',
  'vehicle.documents': 'المستندات',
  'vehicle.trim': 'الفئة',
  'vehicle.cost': 'تكلفة الشراء',
  'vehicle.salePrice': 'سعر البيع',
  'vehicle.acquisitionCost': 'تكلفة الاستحواذ',
  'vehicle.condition.new': 'جديد',
  'vehicle.condition.used': 'مستعمل',
  'vehicle.status.inTransit': 'في الطريق',
  'vehicle.status.inStock': 'في المخزن',
  'vehicle.status.reserved': 'محجوز',
  'vehicle.status.sold': 'مباع',
  'vehicle.status.service': 'في الصيانة',

  // Deal
  'deal.deal': 'صفقة',
  'deal.new': 'صفقة جديدة',
  'deal.saleType': 'نوع البيع',
  'deal.cash': 'كاش',
  'deal.installment': 'تقسيط',
  'deal.bankFinancing': 'تمويل بنكي',
  'deal.downPayment': 'دفعة أولى',
  'deal.financeAmount': 'مبلغ التمويل',
  'deal.bank': 'البنك',
  'deal.adminFee': 'الرسوم الإدارية',
  'deal.insuranceFee': 'رسوم التأمين',
  'deal.commission': 'العمولة',
  'deal.customer': 'العميل',
  'deal.vehicle': 'السيارة',
  'deal.finalize': 'إتمام الصفقة',
  'deal.status.draft': 'مسودة',
  'deal.status.finalized': 'مكتملة',
  'deal.status.cancelled': 'ملغاة',

  // Finance
  'fin.invoice': 'فاتورة',
  'fin.payment': 'دفعة',
  'fin.journalEntry': 'قيد محاسبي',
  'fin.account': 'حساب',
  'fin.debit': 'مدين',
  'fin.credit': 'دائن',
  'fin.balance': 'الرصيد',
  'fin.posted': 'مرحل',
  'fin.draft': 'مسودة',
  'fin.cancelled': 'ملغي',
  'fin.reversed': 'معكوس',
  'fin.bankStatement': 'كشف بنكي',
  'fin.reconciliation': 'التسوية',
  'fin.fiscalYear': 'السنة المالية',
  'fin.assets': 'الأصول الثابتة',
  'fin.depreciation': 'الاستهلاك',
  'fin.gl': 'القيود المحاسبية',
  'fin.accounts': 'شجرة الحسابات',
  'fin.tax': 'الضريبة',
  'fin.vendorBill': 'فاتورة مورد',
  'fin.vendors': 'الموردون',
  'fin.journals': 'الدفاتر',
  'fin.currencies': 'العملات',
  'fin.commissions': 'العمولات',
  'fin.payments': 'المدفوعات',
  'fin.invoices': 'الفواتير',
  'fin.bankStatements': 'كشوف البنك',
  'fin.taxes': 'الضرائب',

  // CRM
  'crm.lead': 'عميل محتمل',
  'crm.customer': 'عميل',
  'crm.source': 'المصدر',
  'crm.followUp': 'متابعة',
  'crm.testDrive': 'اختبار قيادة',
  'crm.budget': 'الميزانية',
  'crm.inquiry': 'استفسار',
  'crm.status.new': 'جديد',
  'crm.status.contacted': 'تم التواصل',
  'crm.status.qualified': 'مؤهل',
  'crm.status.lost': 'خسرنا',
  'crm.status.won': 'فوز',

  // Appointment
  'appt.appointment': 'موعد',
  'appt.new': 'موعد جديد',
  'appt.scheduled': 'مجدول',
  'appt.confirmed': 'مؤكد',
  'appt.completed': 'مكتمل',
  'appt.cancelled': 'ملغي',
  'appt.duration': 'المدة',

  // Service
  'svc.serviceOrder': 'أمر صيانة',
  'svc.mechanic': 'ميكانيكي',
  'svc.diagnosis': 'تشخيص',
  'svc.repair': 'إصلاح',
  'svc.labor': 'أجر العمالة',
  'svc.open': 'مفتوح',
  'svc.inProgress': 'جاري',
  'svc.closed': 'مغلق',

  // Settings
  'settings.company': 'إعدادات الشركة',
  'settings.companyName': 'اسم الشركة',
  'settings.currency': 'العملة الافتراضية',
  'settings.language': 'اللغة الافتراضية',
  'settings.fiscalYear': 'بداية السنة المالية',
  'settings.arabic': 'العربية',
  'settings.english': 'الإنجليزية',
  'settings.locations': 'الفروع',
  'settings.addBranch': 'إضافة فرع',
  'settings.editBranch': 'تعديل الفرع',
  'settings.parameters': 'المعاملات',
  'settings.users': 'المستخدمون',
  'settings.dealers': 'الوكلاء المعتمدون',
  'settings.tabs.company': 'الشركة',
  'settings.tabs.locations': 'الفروع',
  'settings.tabs.parameters': 'المعاملات',
  'settings.tabs.dealers': 'الوكلاء',

  // Users
  'user.user': 'مستخدم',
  'user.role': 'الدور',
  'user.salesRep': 'مندوب مبيعات',
  'user.manager': 'مدير',
  'user.finance': 'مالية',
  'user.admin': 'مسؤول',
  'user.superAdmin': 'المسؤول الأعلى',
  'user.customer': 'عميل',

  // Auth
  'auth.signIn': 'تسجيل الدخول',
  'auth.email': 'البريد الإلكتروني',
  'auth.password': 'كلمة المرور',
  'auth.signOut': 'تسجيل الخروج',
  'auth.invalidCredentials': 'بيانات الدخول غير صحيحة',

  // Date picker
  'date.from': 'من',
  'date.to': 'إلى',
  'date.apply': 'تطبيق',

  // Purchase Orders
  'po.purchaseOrder': 'أمر شراء',
  'po.new': 'أمر شراء جديد',
  'po.supplier': 'المورد',
  'po.quantity': 'الكمية',
  'po.unitPrice': 'سعر الوحدة',
  'po.subtotal': 'المجموع الجزئي',

  // Partners
  'partner.partner': 'شريك',
  'partner.type': 'نوع الشريك',
  'partner.supplier': 'مورد',
  'partner.customer': 'عميل',
  'partner.taxNumber': 'الرقم الضريبي',

  // Reports
  'report.reports': 'التقارير',
  'report.salesFunnel': 'مسار المبيعات',
  'report.commissions': 'تقرير العمولات',
  'report.targets': 'الأهداف',

  // Audit log
  'audit.auditLog': 'سجل المراجعة',
  'audit.entity': 'الكيان',
  'audit.action': 'الإجراء',
  'audit.user': 'المستخدم',
  'audit.before': 'قبل',
  'audit.after': 'بعد',
  'audit.create': 'إنشاء',
  'audit.update': 'تعديل',
  'audit.delete': 'حذف',
  'audit.post': 'ترحيل',
  'audit.reverse': 'عكس',

  // Transfers
  'transfer.transfer': 'تحويل',
  'transfer.from': 'من فرع',
  'transfer.to': 'إلى فرع',
  'transfer.pending': 'في الانتظار',
  'transfer.completed': 'مكتمل',

  // Floor plan
  'floorplan.floorplan': 'قروض المعرض',
  'floorplan.lender': 'جهة الإقراض',
  'floorplan.principal': 'المبلغ الأصلي',
  'floorplan.interest': 'الفائدة',
  'floorplan.dueDate': 'تاريخ الاستحقاق',

  // Petty cash
  'petty.pettyCash': 'المصروفات النثرية',
  'petty.expense': 'مصروف',
  'petty.category': 'التصنيف',
  'petty.receipt': 'الإيصال',

  // Import/shipment
  'import.import': 'شحنة استيراد',
  'import.new': 'شحنة جديدة',
  'import.origin': 'بلد المنشأ',
  'import.eta': 'تاريخ الوصول المتوقع',
  'import.pending': 'في الانتظار',
  'import.inTransit': 'في الطريق',
  'import.arrived': 'وصلت',
  'import.cleared': 'تم التخليص',
};

export const en: Record<string, string> = {
  'nav.dashboard': 'Dashboard',
  'nav.inventory': 'Inventory',
  'nav.imports': 'Imports',
  'nav.crm': 'Leads & CRM',
  'nav.reports': 'Reports',
  'nav.whatsapp': 'WhatsApp',
  'nav.deals': 'Deals',
  'nav.appointments': 'Appointments',
  'nav.service': 'Service Center',
  'nav.parts': 'Parts',
  'nav.transfers': 'Transfers',
  'nav.floorplan': 'Floor Plan',
  'nav.pettycash': 'Petty Cash',
  'nav.finance': 'Finance',
  'nav.commissions': 'My Commissions',
  'nav.executive': 'Executive View',
  'nav.users': 'Users & Locations',
  'nav.auditlog': 'Audit Log',
  'nav.settings': 'Settings',
  'nav.purchaseorders': 'Purchase Orders',
  'app.name': 'DealerMS',
  'app.subtitle': 'Management Platform',
  'btn.save': 'Save', 'btn.cancel': 'Cancel', 'btn.delete': 'Delete',
  'btn.edit': 'Edit', 'btn.add': 'Add', 'btn.search': 'Search',
  'btn.filter': 'Filter', 'btn.export': 'Export', 'btn.apply': 'Apply',
  'btn.reset': 'Reset', 'btn.submit': 'Submit', 'btn.close': 'Close',
  'btn.back': 'Back', 'btn.next': 'Next', 'btn.previous': 'Previous',
  'btn.view': 'View', 'btn.download': 'Download', 'btn.upload': 'Upload',
  'btn.print': 'Print', 'btn.confirm': 'Confirm', 'btn.new': 'New',
  'btn.create': 'Create', 'btn.publish': 'Publish', 'btn.post': 'Post',
  'btn.reverse': 'Reverse', 'btn.approve': 'Approve', 'btn.reject': 'Reject',
  'btn.signout': 'Sign Out',
  'lbl.name': 'Name', 'lbl.email': 'Email', 'lbl.phone': 'Phone',
  'lbl.address': 'Address', 'lbl.city': 'City', 'lbl.date': 'Date',
  'lbl.amount': 'Amount', 'lbl.notes': 'Notes', 'lbl.description': 'Description',
  'lbl.status': 'Status', 'lbl.actions': 'Actions', 'lbl.total': 'Total',
  'lbl.from': 'From', 'lbl.to': 'To', 'lbl.type': 'Type', 'lbl.all': 'All',
  'lbl.none': 'None', 'lbl.required': 'Required', 'lbl.optional': 'Optional',
  'lbl.active': 'Active', 'lbl.inactive': 'Inactive', 'lbl.yes': 'Yes', 'lbl.no': 'No',
  'lbl.reference': 'Reference', 'lbl.createdAt': 'Created At', 'lbl.updatedAt': 'Updated At',
  'lbl.location': 'Location', 'lbl.allLocations': 'All Locations', 'lbl.currency': 'Currency',
  'lbl.egp': 'EGP',
  'state.loading': 'Loading…', 'state.noData': 'No data', 'state.noResults': 'No results',
  'state.error': 'An error occurred', 'state.saved': 'Saved successfully',
  'state.deleted': 'Deleted successfully', 'state.saving': 'Saving…',
  'vehicle.vehicle': 'Vehicle', 'vehicle.new': 'New Vehicle', 'vehicle.used': 'Used Vehicle',
  'vehicle.add': 'Add Vehicle', 'vehicle.make': 'Make', 'vehicle.model': 'Model',
  'vehicle.year': 'Year', 'vehicle.vin': 'VIN', 'vehicle.color': 'Color',
  'vehicle.condition': 'Condition', 'vehicle.price': 'Price', 'vehicle.mileage': 'Mileage',
  'vehicle.bodyType': 'Body Type', 'vehicle.fuelType': 'Fuel Type',
  'vehicle.transmission': 'Transmission', 'vehicle.engineSize': 'Engine Size',
  'vehicle.hp': 'HP', 'vehicle.torque': 'Torque (N·m)', 'vehicle.driveType': 'Drive Type',
  'vehicle.gearType': 'Gear Type', 'vehicle.doors': 'Doors', 'vehicle.seats': 'Seats',
  'vehicle.features': 'Features', 'vehicle.photos': 'Photos', 'vehicle.documents': 'Documents',
  'vehicle.trim': 'Trim', 'vehicle.cost': 'Cost', 'vehicle.salePrice': 'Sale Price',
  'vehicle.acquisitionCost': 'Acquisition Cost',
  'vehicle.condition.new': 'New', 'vehicle.condition.used': 'Used',
  'vehicle.status.inTransit': 'In Transit', 'vehicle.status.inStock': 'In Stock',
  'vehicle.status.reserved': 'Reserved', 'vehicle.status.sold': 'Sold',
  'vehicle.status.service': 'In Service',
  'deal.deal': 'Deal', 'deal.new': 'New Deal', 'deal.saleType': 'Sale Type',
  'deal.cash': 'Cash', 'deal.installment': 'Installment', 'deal.bankFinancing': 'Bank Financing',
  'deal.downPayment': 'Down Payment', 'deal.financeAmount': 'Finance Amount',
  'deal.bank': 'Bank', 'deal.adminFee': 'Admin Fee', 'deal.insuranceFee': 'Insurance Fee',
  'deal.commission': 'Commission', 'deal.customer': 'Customer', 'deal.vehicle': 'Vehicle',
  'deal.finalize': 'Finalize Deal', 'deal.status.draft': 'Draft',
  'deal.status.finalized': 'Finalized', 'deal.status.cancelled': 'Cancelled',
  'fin.invoice': 'Invoice', 'fin.payment': 'Payment', 'fin.journalEntry': 'Journal Entry',
  'fin.account': 'Account', 'fin.debit': 'Debit', 'fin.credit': 'Credit',
  'fin.balance': 'Balance', 'fin.posted': 'Posted', 'fin.draft': 'Draft',
  'fin.cancelled': 'Cancelled', 'fin.reversed': 'Reversed',
  'fin.bankStatement': 'Bank Statement', 'fin.reconciliation': 'Reconciliation',
  'fin.fiscalYear': 'Fiscal Year', 'fin.assets': 'Fixed Assets', 'fin.depreciation': 'Depreciation',
  'fin.gl': 'Journal Entries', 'fin.accounts': 'Chart of Accounts', 'fin.tax': 'Tax',
  'fin.vendorBill': 'Vendor Bill', 'fin.vendors': 'Vendors', 'fin.journals': 'Journals',
  'fin.currencies': 'Currencies', 'fin.commissions': 'Commissions', 'fin.payments': 'Payments', 'fin.invoices': 'Invoices',
  'fin.bankStatements': 'Bank Statements', 'fin.taxes': 'Taxes',
  'crm.lead': 'Lead', 'crm.customer': 'Customer', 'crm.source': 'Source',
  'crm.followUp': 'Follow Up', 'crm.testDrive': 'Test Drive', 'crm.budget': 'Budget',
  'crm.inquiry': 'Inquiry', 'crm.status.new': 'New', 'crm.status.contacted': 'Contacted',
  'crm.status.qualified': 'Qualified', 'crm.status.lost': 'Lost', 'crm.status.won': 'Won',
  'appt.appointment': 'Appointment', 'appt.new': 'New Appointment',
  'appt.scheduled': 'Scheduled', 'appt.confirmed': 'Confirmed',
  'appt.completed': 'Completed', 'appt.cancelled': 'Cancelled', 'appt.duration': 'Duration',
  'svc.serviceOrder': 'Service Order', 'svc.mechanic': 'Mechanic',
  'svc.diagnosis': 'Diagnosis', 'svc.repair': 'Repair', 'svc.labor': 'Labor',
  'svc.open': 'Open', 'svc.inProgress': 'In Progress', 'svc.closed': 'Closed',
  'settings.company': 'Company Settings', 'settings.companyName': 'Company Name',
  'settings.currency': 'Default Currency', 'settings.language': 'Default Language',
  'settings.fiscalYear': 'Fiscal Year Start', 'settings.arabic': 'Arabic',
  'settings.english': 'English', 'settings.locations': 'Locations',
  'settings.addBranch': 'Add Branch', 'settings.editBranch': 'Edit Branch',
  'settings.parameters': 'Parameters', 'settings.users': 'Users', 'settings.dealers': 'Accredited Dealers',
  'settings.tabs.company': 'Company', 'settings.tabs.locations': 'Locations',
  'settings.tabs.parameters': 'Parameters', 'settings.tabs.dealers': 'Dealers',
  'user.user': 'User', 'user.role': 'Role', 'user.salesRep': 'Sales Rep',
  'user.manager': 'Manager', 'user.finance': 'Finance', 'user.admin': 'Admin',
  'user.superAdmin': 'Super Admin', 'user.customer': 'Customer',
  'auth.signIn': 'Sign In', 'auth.email': 'Email', 'auth.password': 'Password',
  'auth.signOut': 'Sign Out', 'auth.invalidCredentials': 'Invalid credentials',
  'date.from': 'From', 'date.to': 'To', 'date.apply': 'Apply',
  'po.purchaseOrder': 'Purchase Order', 'po.new': 'New Purchase Order',
  'po.supplier': 'Supplier', 'po.quantity': 'Quantity', 'po.unitPrice': 'Unit Price',
  'po.subtotal': 'Subtotal',
  'partner.partner': 'Partner', 'partner.type': 'Type', 'partner.supplier': 'Supplier',
  'partner.customer': 'Customer', 'partner.taxNumber': 'Tax Number',
  'report.reports': 'Reports', 'report.salesFunnel': 'Sales Funnel',
  'report.commissions': 'Commissions Report', 'report.targets': 'Targets',
  'audit.auditLog': 'Audit Log', 'audit.entity': 'Entity', 'audit.action': 'Action',
  'audit.user': 'User', 'audit.before': 'Before', 'audit.after': 'After',
  'audit.create': 'Create', 'audit.update': 'Update', 'audit.delete': 'Delete',
  'audit.post': 'Post', 'audit.reverse': 'Reverse',
  'transfer.transfer': 'Transfer', 'transfer.from': 'From Branch', 'transfer.to': 'To Branch',
  'transfer.pending': 'Pending', 'transfer.completed': 'Completed',
  'floorplan.floorplan': 'Floor Plan', 'floorplan.lender': 'Lender',
  'floorplan.principal': 'Principal', 'floorplan.interest': 'Interest',
  'floorplan.dueDate': 'Due Date',
  'petty.pettyCash': 'Petty Cash', 'petty.expense': 'Expense',
  'petty.category': 'Category', 'petty.receipt': 'Receipt',
  'import.import': 'Import Shipment', 'import.new': 'New Shipment',
  'import.origin': 'Country of Origin', 'import.eta': 'ETA',
  'import.pending': 'Pending', 'import.inTransit': 'In Transit',
  'import.arrived': 'Arrived', 'import.cleared': 'Cleared',
};

/* ─── Context ────────────────────────────────────────────────────────────── */
type LangCtx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, fallback?: string) => string;
  dir: 'rtl' | 'ltr';
  isAr: boolean;
};

const LangContext = createContext<LangCtx>({
  lang: 'ar',
  setLang: () => {},
  t: (k) => k,
  dir: 'rtl',
  isAr: true,
});

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('ar');

  useEffect(() => {
    const saved = localStorage.getItem('dealerms_lang') as Lang | null;
    if (saved === 'en' || saved === 'ar') setLangState(saved);
  }, []);

  function setLang(l: Lang) {
    setLangState(l);
    localStorage.setItem('dealerms_lang', l);
    document.documentElement.lang = l;
    document.documentElement.dir = l === 'ar' ? 'rtl' : 'ltr';
  }

  const dir: 'rtl' | 'ltr' = lang === 'ar' ? 'rtl' : 'ltr';
  const isAr = lang === 'ar';

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
  }, [lang, dir]);

  function t(key: string, fallback?: string): string {
    const dict = lang === 'ar' ? ar : en;
    return dict[key] ?? fallback ?? key;
  }

  return (
    <LangContext.Provider value={{ lang, setLang, t, dir, isAr }}>
      {children}
    </LangContext.Provider>
  );
}

export const useLang = () => useContext(LangContext);
