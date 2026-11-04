// Abonnement aux notifications de sortie (Web Push, clé VAPID publique fournie par /api/session).
import { T } from './textes.js';
import { api } from './commun.js';

const versOctets = (b64) => Uint8Array.from(atob(b64.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (b64.length % 4)) % 4)), (c) => c.charCodeAt(0));

export async function activerNotifications(clePublique) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !clePublique) return 'Notifications indisponibles sur cet appareil.';
  if ((await Notification.requestPermission()) !== 'granted') return T.notifsRefusees;
  const sw = await navigator.serviceWorker.ready;
  const abo = (await sw.pushManager.getSubscription())
    || await sw.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: versOctets(clePublique) });
  await api('push', { method: 'POST', corps: { endpoint: abo.endpoint } });
  return T.notifsActives;
}
