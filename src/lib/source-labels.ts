const SOURCE_AR: Record<string, string> = {
  WEBSITE:      'الموقع اللإليكتروني',
  WALK_IN:      'زيارة مباشرة',
  PHONE:        'هاتف',
  FACEBOOK:     'فيسبوك',
  REFERRAL:     'إحالة',
  MARKETPLACE:  'منصة إعلانات',
  CALL_CENTER:  'مركز الاتصالات',
  SOCIAL_MEDIA: 'وسائل التواصل',
  OTHER:        'أخرى',
};

const SOURCE_EN: Record<string, string> = {
  WEBSITE:      'Website',
  WALK_IN:      'Walk-In',
  PHONE:        'Phone',
  FACEBOOK:     'Facebook',
  REFERRAL:     'Referral',
  MARKETPLACE:  'Marketplace',
  CALL_CENTER:  'Call Center',
  SOCIAL_MEDIA: 'Social Media',
  OTHER:        'Other',
};

export function translateSource(src: string | null | undefined, isAr: boolean): string {
  if (!src) return isAr ? 'غير معروف' : 'Unknown';
  const map = isAr ? SOURCE_AR : SOURCE_EN;
  return map[src] ?? src.replace(/_/g, ' ');
}
