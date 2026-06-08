import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// ── Types ─────────────────────────────────────────────────────────────────────

export type CartItem = {
  product_id: string
  variant_id: string
  name: string
  variant_name: string
  sku: string
  unit_price: number
  quantity: number
  image_url: string
  stock: number
  is_preorder?: boolean
  preorder_note?: string
}

type CartSettings = {
  freeShippingAmount: number
  shippingFee: number
  giftNfcAmount: number
  giftNfcEnabled: boolean
}

type Derived = {
  subtotal: number
  shippingFee: number
  total: number
  itemCount: number
  isFreeShipping: boolean
  isGiftEligible: boolean
  amountToFreeShipping: number
  amountToGift: number
  freeShippingProgress: number
  freeShippingThreshold: number
  giftThreshold: number
}

export type AddProductArg = {
  id: string
  name: string
  base_price: number
  images: string[]
}

export type AddVariantArg = {
  id: string
  name: string
  sku: string
  price: number | null
  stock: number
  is_preorder?: boolean
  preorder_note?: string
}

export type CartStore = {
  items: CartItem[]
  isLoading: boolean
  _settings: CartSettings
  // Computed (refreshed on every mutation)
  subtotal: number
  shippingFee: number
  total: number
  itemCount: number
  isFreeShipping: boolean
  isGiftEligible: boolean
  amountToFreeShipping: number
  amountToGift: number
  freeShippingProgress: number
  freeShippingThreshold: number
  giftThreshold: number
  // Actions
  addItem(
    product: AddProductArg,
    variant: AddVariantArg,
    qty: number,
  ): Promise<void>
  removeItem(variant_id: string): void
  updateQty(variant_id: string, qty: number): Promise<void>
  clearCart(): void
  syncToDb(): Promise<void>
  loadFromDb(): Promise<void>
  mergeWithDb(): Promise<void>
  validateStock(): Promise<{ valid: boolean; warnings: string[] }>
  _loadSettings(): Promise<void>
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: CartSettings = {
  freeShippingAmount: 1000,
  shippingFee: 60,
  giftNfcAmount: 1500,
  giftNfcEnabled: false,
}

function computeDerived(items: CartItem[], s: CartSettings): Derived {
  const subtotal = items.reduce((acc, i) => acc + i.unit_price * i.quantity, 0)
  const isFreeShipping = subtotal >= s.freeShippingAmount
  const shippingFee = isFreeShipping ? 0 : s.shippingFee
  return {
    subtotal,
    shippingFee,
    total: subtotal + shippingFee,
    itemCount: items.reduce((acc, i) => acc + i.quantity, 0),
    isFreeShipping,
    isGiftEligible: s.giftNfcEnabled && subtotal >= s.giftNfcAmount,
    amountToFreeShipping: Math.max(0, s.freeShippingAmount - subtotal),
    amountToGift: Math.max(0, s.giftNfcAmount - subtotal),
    freeShippingProgress: isFreeShipping
      ? 100
      : Math.min(100, Math.round((subtotal / s.freeShippingAmount) * 100)),
    freeShippingThreshold: s.freeShippingAmount,
    giftThreshold: s.giftNfcAmount,
  }
}

// ── Settings cache (60-second TTL, avoids redundant fetches) ─────────────────

type SettingsCache = { data: CartSettings; fetchedAt: number } | null
let _settingsCache: SettingsCache = null
const SETTINGS_TTL_MS = 60_000

// ── Store ─────────────────────────────────────────────────────────────────────

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      isLoading: false,
      _settings: DEFAULT_SETTINGS,
      ...computeDerived([], DEFAULT_SETTINGS),

      addItem: async (product, variant, qty) => {
        const { items, _settings } = get()
        const existing = items.find((i) => i.variant_id === variant.id)
        let newItems: CartItem[]

        if (existing) {
          const newQty = variant.is_preorder
            ? existing.quantity + qty
            : Math.min(existing.quantity + qty, variant.stock)
          newItems = items.map((i) =>
            i.variant_id === variant.id
              ? { ...i, quantity: newQty, stock: variant.stock }
              : i,
          )
        } else {
          newItems = [
            ...items,
            {
              product_id: product.id,
              variant_id: variant.id,
              name: product.name,
              variant_name: variant.name,
              sku: variant.sku,
              unit_price: variant.price ?? product.base_price,
              quantity: variant.is_preorder
                ? qty
                : Math.min(qty, variant.stock),
              image_url: product.images[0] ?? '',
              stock: variant.stock,
              is_preorder: variant.is_preorder,
              preorder_note: variant.preorder_note,
            },
          ]
        }

        set({ items: newItems, ...computeDerived(newItems, _settings) })
        // Fire-and-forget: guests get 401 which is silently ignored
        get()
          .syncToDb()
          .catch(() => {})
      },

      removeItem: (variant_id) => {
        const { items, _settings } = get()
        const newItems = items.filter((i) => i.variant_id !== variant_id)
        set({ items: newItems, ...computeDerived(newItems, _settings) })
        fetch(`/api/cart/items/${variant_id}`, { method: 'DELETE' }).catch(
          () => {},
        )
      },

      updateQty: async (variant_id, qty) => {
        const { items, _settings } = get()
        if (qty < 1) {
          get().removeItem(variant_id)
          return
        }
        const newItems = items.map((i) =>
          i.variant_id === variant_id
            ? { ...i, quantity: Math.min(qty, i.stock) }
            : i,
        )
        set({ items: newItems, ...computeDerived(newItems, _settings) })
        // Caller is responsible for debounced syncToDb
      },

      clearCart: () => {
        const { _settings } = get()
        set({ items: [], ...computeDerived([], _settings) })
      },

      syncToDb: async () => {
        const { items } = get()
        await fetch('/api/cart', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items }),
        })
      },

      loadFromDb: async () => {
        set({ isLoading: true })
        try {
          const res = await fetch('/api/cart')
          if (!res.ok) return
          const json = await res.json()
          const freshItems: CartItem[] = json.data.items ?? []
          const { _settings } = get()
          set({ items: freshItems, ...computeDerived(freshItems, _settings) })
        } finally {
          set({ isLoading: false })
        }
      },

      mergeWithDb: async () => {
        set({ isLoading: true })
        try {
          const res = await fetch('/api/cart')
          if (!res.ok) return
          const json = await res.json()
          const dbItems: CartItem[] = json.data.items ?? []
          const { items: localItems, _settings } = get()

          // Merge: same variant → take max qty (clamped to DB stock)
          const merged = new Map<string, CartItem>()
          for (const item of localItems) merged.set(item.variant_id, item)

          for (const dbItem of dbItems) {
            const local = merged.get(dbItem.variant_id)
            merged.set(dbItem.variant_id, {
              ...dbItem,
              quantity: Math.min(
                local
                  ? Math.max(local.quantity, dbItem.quantity)
                  : dbItem.quantity,
                dbItem.stock,
              ),
            })
          }

          const mergedItems = Array.from(merged.values()).filter(
            (i) => i.quantity > 0,
          )
          set({ items: mergedItems, ...computeDerived(mergedItems, _settings) })

          await fetch('/api/cart', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: mergedItems }),
          })
        } finally {
          set({ isLoading: false })
        }
      },

      validateStock: async () => {
        const { items, _settings } = get()
        if (items.length === 0) return { valid: true, warnings: [] }

        try {
          const res = await fetch('/api/cart')
          if (!res.ok) return { valid: true, warnings: [] }
          const json = await res.json()
          const freshItems: CartItem[] = json.data.items ?? []
          const warnings: string[] = json.data.warnings ?? []

          const updatedItems = items.map((item) => {
            const fresh = freshItems.find(
              (f) => f.variant_id === item.variant_id,
            )
            if (!fresh) return item
            return {
              ...item,
              stock: fresh.stock,
              quantity: Math.min(item.quantity, fresh.stock),
            }
          })

          set({
            items: updatedItems,
            ...computeDerived(updatedItems, _settings),
          })
          return { valid: warnings.length === 0, warnings }
        } catch {
          return { valid: true, warnings: [] }
        }
      },

      _loadSettings: async () => {
        const now = Date.now()

        // Serve from module-level cache if still fresh (60-second TTL)
        if (
          _settingsCache &&
          now - _settingsCache.fetchedAt < SETTINGS_TTL_MS
        ) {
          const s = _settingsCache.data
          const { items } = get()
          set({ _settings: s, ...computeDerived(items, s) })
          return
        }

        try {
          // Fetch from the public settings endpoint (uses actual DB key names)
          const res = await fetch('/api/settings/public')
          if (!res.ok) return
          const json = await res.json()
          const d = json.data as Record<string, unknown>

          const s: CartSettings = {
            freeShippingAmount:
              (d.free_shipping_amount as number) ??
              DEFAULT_SETTINGS.freeShippingAmount,
            shippingFee: DEFAULT_SETTINGS.shippingFee, // logistics-driven; kept as default
            giftNfcAmount:
              (d.gift_nfc_amount as number) ?? DEFAULT_SETTINGS.giftNfcAmount,
            giftNfcEnabled:
              (d.gift_nfc_enabled as boolean) ??
              DEFAULT_SETTINGS.giftNfcEnabled,
          }

          _settingsCache = { data: s, fetchedAt: now }
          const { items } = get()
          set({ _settings: s, ...computeDerived(items, s) })
        } catch {
          // Keep defaults on network failure
        }
      },
    }),
    {
      name: 'furchic-cart',
      skipHydration: true,
      partialize: (state) => ({ items: state.items }),
      onRehydrateStorage: () => (state) => {
        if (!state) return
        const d = computeDerived(
          state.items,
          state._settings ?? DEFAULT_SETTINGS,
        )
        Object.assign(state, d)
      },
    },
  ),
)
