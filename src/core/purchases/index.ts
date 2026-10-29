import { Capacitor } from "@capacitor/core";
import { create } from "zustand";
import appConfig from "../../../app.config.json";

/**
 * Purchases: thin wrapper around RevenueCat. On web (dev) a mock lets you test the paywall and gating
 * without a store account. Products are configured in RevenueCat as an Offering with two packages:
 *   - "annual"   : auto-renewing yearly subscription with a 7-day free trial
 *   - "lifetime" : non-consumable one-time purchase
 * Both grant the entitlement named in app.config.json (default "pro").
 */
export type Package = { id: "annual" | "lifetime"; priceString: string; introPriceString?: string | null; raw?: unknown };

export type Subscription = {
  /** "annual" | "lifetime" | null when free */
  plan: "annual" | "lifetime" | null;
  productId: string | null;
  expiresAt: string | null;      // ISO date, null for lifetime
  willRenew: boolean;
  inTrial: boolean;
  managementUrl: string | null;  // App Store / Play subscription settings deep link
  store: string | null;
};

type Store = {
  ready: boolean;
  isPro: boolean;
  packages: Package[];
  sub: Subscription;
  init: () => Promise<void>;
  purchase: (pkg: Package) => Promise<boolean>;
  restore: () => Promise<boolean>;
  manage: () => Promise<void>;
};

const freeSub: Subscription = { plan: null, productId: null, expiresAt: null, willRenew: false, inTrial: false, managementUrl: null, store: null };

const isNative = Capacitor.getPlatform() !== "web";

export const usePurchases = create<Store>((set, get) => ({
  ready: false,
  isPro: false,
  packages: [],
  sub: freeSub,

  async init() {
    if (!isNative) {
      // Web/dev mock: remember a fake purchase in localStorage.
      let pro = false;
      try { pro = localStorage.getItem("mock_pro") === "1"; } catch { /* ignore */ }
      let plan: Subscription["plan"] = null;
      try { plan = (localStorage.getItem("mock_plan") as Subscription["plan"]) || (pro ? "annual" : null); } catch { /* ignore */ }
      set({ ready: true, isPro: pro, packages: [
        { id: "annual", priceString: "149 kr./år", introPriceString: "7 dage gratis" },
        { id: "lifetime", priceString: "349 kr." },
      ], sub: pro ? { plan, productId: plan === "lifetime" ? "pro_lifetime" : "pro_yearly", expiresAt: plan === "lifetime" ? null : new Date(Date.now() + 300 * 86400000).toISOString().slice(0, 10), willRenew: plan === "annual", inTrial: false, managementUrl: null, store: "web" } : freeSub });
      return;
    }
    const { Purchases, LOG_LEVEL } = await import("@revenuecat/purchases-capacitor");
    const apiKey = Capacitor.getPlatform() === "ios" ? appConfig.revenueCat.ios : appConfig.revenueCat.android;
    // A new app's first TestFlight builds can ship before RevenueCat exists: no key → free tier, empty paywall, no SDK call.
    if (!apiKey || /TODO/.test(apiKey)) { set({ ready: true, isPro: false, packages: [] }); return; }
    await Purchases.setLogLevel({ level: __RELEASE__ ? LOG_LEVEL.ERROR : LOG_LEVEL.DEBUG });
    await Purchases.configure({ apiKey });
    const refresh = async () => {
      const { customerInfo } = await Purchases.getCustomerInfo();
      const ent = customerInfo.entitlements.active[appConfig.revenueCat.entitlement];
      const productId = ent?.productIdentifier ?? null;
      const lifetime = Boolean(productId && /lifetime/i.test(productId));
      set({ isPro: Boolean(ent), sub: ent ? {
        plan: lifetime ? "lifetime" : "annual", productId,
        expiresAt: lifetime ? null : (ent.expirationDate ?? null)?.slice(0, 10) ?? null,
        willRenew: Boolean(ent.willRenew), inTrial: ent.periodType === "TRIAL",
        managementUrl: customerInfo.managementURL ?? null, store: ent.store ?? null,
      } : freeSub });
    };
    await Purchases.addCustomerInfoUpdateListener(() => { void refresh(); });
    const { current } = await Purchases.getOfferings();
    const pk: Package[] = [];
    for (const p of current?.availablePackages ?? []) {
      const id = p.packageType === "LIFETIME" ? "lifetime" : p.packageType === "ANNUAL" ? "annual" : null;
      if (!id) continue;
      pk.push({ id, priceString: p.product.priceString, introPriceString: p.product.introPrice?.priceString ?? null, raw: p });
    }
    await refresh();
    set({ ready: true, packages: pk });
  },

  async purchase(pkg) {
    if (!isNative) { try { localStorage.setItem("mock_pro", "1"); } catch { /* ignore */ } set({ isPro: true }); return true; }
    const { Purchases } = await import("@revenuecat/purchases-capacitor");
    try {
      const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg.raw as never });
      const pro = Boolean(customerInfo.entitlements.active[appConfig.revenueCat.entitlement]);
      set({ isPro: pro });
      return pro;
    } catch (e) {
      const err = e as { userCancelled?: boolean };
      if (!err.userCancelled) console.warn("[purchases] failed", e);
      return get().isPro;
    }
  },

  async manage() {
    const url = get().sub.managementUrl
      ?? (Capacitor.getPlatform() === "ios" ? "https://apps.apple.com/account/subscriptions" : "https://play.google.com/store/account/subscriptions");
    window.open(url, "_blank");
  },

  async restore() {
    if (!isNative) return get().isPro;
    const { Purchases } = await import("@revenuecat/purchases-capacitor");
    const { customerInfo } = await Purchases.restorePurchases();
    const pro = Boolean(customerInfo.entitlements.active[appConfig.revenueCat.entitlement]);
    set({ isPro: pro });
    return pro;
  },
}));

/** Use in any screen: `const gate = useProGate(); if (!gate.allow("secondPet")) return;` opens the paywall otherwise. */
export const usePaywall = create<{ open: boolean; reason: string | null; show: (reason: string) => void; hide: () => void }>((set) => ({
  open: false, reason: null,
  show: (reason) => set({ open: true, reason }),
  hide: () => set({ open: false, reason: null }),
}));

export function useProGate() {
  const isPro = usePurchases((s) => s.isPro);
  const show = usePaywall((s) => s.show);
  return { isPro, allow(reason: string) { if (isPro) return true; show(reason); return false; } };
}
