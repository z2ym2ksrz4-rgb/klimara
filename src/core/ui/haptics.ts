import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { Capacitor } from "@capacitor/core";
const native = () => Capacitor.getPlatform() !== "web";
export const tap = () => { if (native()) void Haptics.impact({ style: ImpactStyle.Light }); };
export const thud = () => { if (native()) void Haptics.impact({ style: ImpactStyle.Medium }); };
export const success = () => { if (native()) void Haptics.notification({ type: NotificationType.Success }); };
export const warn = () => { if (native()) void Haptics.notification({ type: NotificationType.Warning }); };
