export const GUEST_CREATED_MESSAGE_TYPE = 'veredillas:guest-created';

export interface GuestQuickCreateMessage {
  type: typeof GUEST_CREATED_MESSAGE_TYPE;
  guest: { _id: string; name: string; slug: string; role?: string; image?: string };
}

export function openGuestQuickCreatePopup(prefillName?: string) {
  const params = prefillName ? `?name=${encodeURIComponent(prefillName)}` : '';
  window.open(
    `/guest-quick-create${params}`,
    'guestQuickCreate',
    'width=640,height=820,scrollbars=yes,resizable=yes'
  );
}
