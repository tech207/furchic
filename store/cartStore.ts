import { create } from 'zustand'

export type CartItem = {
  variantId: string
  quantity: number
}

type CartState = {
  items: CartItem[]
  setItems: (items: CartItem[]) => void
  clear: () => void
}

export const useCartStore = create<CartState>((set) => ({
  items: [],
  setItems: (items) => set({ items }),
  clear: () => set({ items: [] }),
}))
