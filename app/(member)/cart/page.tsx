'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  AlertTriangle,
  Gift,
  Loader2,
  Minus,
  Package,
  Plus,
  ShoppingCart,
  Trash2,
  Truck,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import { useCartStore, type CartItem } from '@/store/cartStore'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

// ── Item row ──────────────────────────────────────────────────────────────────

function CartItemRow({
  item,
  onInc,
  onDec,
  onDeleteRequest,
}: {
  item: CartItem
  onInc: () => void
  onDec: () => void
  onDeleteRequest: () => void
}) {
  const isLowStock = item.quantity >= item.stock && item.stock > 0
  const isOutOfStock = item.stock === 0

  return (
    <div className="flex gap-4 rounded-2xl border bg-card p-4">
      {/* Thumbnail */}
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-muted">
        {item.image_url ? (
          <Image
            src={item.image_url}
            alt={item.name}
            fill
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Package className="h-8 w-8 text-muted-foreground/30" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{item.name}</p>
        <p className="mt-0.5 truncate text-sm text-muted-foreground">
          {item.variant_name}
        </p>
        <p className="text-xs text-muted-foreground/70">SKU: {item.sku}</p>

        {/* Stock warnings */}
        {isOutOfStock && (
          <p className="mt-1 flex items-center gap-1 text-xs text-destructive">
            <AlertTriangle className="h-3 w-3" />
            已售完
          </p>
        )}
        {!isOutOfStock && isLowStock && (
          <p className="mt-1 flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400">
            <AlertTriangle className="h-3 w-3" />
            僅剩 {item.stock} 件
          </p>
        )}
      </div>

      {/* Price + qty controls */}
      <div className="flex shrink-0 flex-col items-end justify-between gap-2">
        <p className="text-base font-bold">
          NT$ {(item.unit_price * item.quantity).toLocaleString()}
        </p>

        <div className="flex items-center gap-1.5">
          {/* Qty controls */}
          <div className="flex items-center rounded-xl border bg-background">
            <button
              type="button"
              onClick={onDec}
              disabled={item.quantity <= 1}
              aria-label="減少數量"
              className="flex h-8 w-8 items-center justify-center rounded-l-xl transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Minus className="h-3 w-3" />
            </button>
            <span className="w-8 text-center text-sm font-medium tabular-nums">
              {item.quantity}
            </span>
            <button
              type="button"
              onClick={onInc}
              disabled={item.quantity >= item.stock}
              aria-label="增加數量"
              className="flex h-8 w-8 items-center justify-center rounded-r-xl transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>

          {/* Delete */}
          <button
            type="button"
            onClick={onDeleteRequest}
            aria-label="移除商品"
            className="flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>

        <p className="text-xs text-muted-foreground">
          NT$ {item.unit_price.toLocaleString()} × {item.quantity}
        </p>
      </div>
    </div>
  )
}

// ── Order summary ─────────────────────────────────────────────────────────────

function OrderSummary() {
  const {
    subtotal,
    shippingFee,
    total,
    isFreeShipping,
    isGiftEligible,
    amountToFreeShipping,
    freeShippingProgress,
    freeShippingThreshold,
    giftThreshold,
    _settings,
  } = useCartStore()

  return (
    <div className="space-y-4 rounded-2xl border bg-card p-5">
      <h2 className="text-base font-bold">訂單摘要</h2>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">商品小計</span>
          <span>NT$ {subtotal.toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">運費</span>
          {isFreeShipping ? (
            <span className="font-medium text-green-600">免運</span>
          ) : (
            <span>NT$ {shippingFee.toLocaleString()}</span>
          )}
        </div>
      </div>

      <Separator />

      <div className="flex justify-between text-lg font-bold">
        <span>總計</span>
        <span>NT$ {total.toLocaleString()}</span>
      </div>

      {/* Free shipping progress */}
      {!isFreeShipping && (
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Truck className="h-3.5 w-3.5" />
              免運進度
            </span>
            <span>NT$ {freeShippingThreshold.toLocaleString()} 免運</span>
          </div>
          {/* Custom orange progress bar */}
          <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-orange-500 transition-all duration-500 ease-out"
              style={{ width: `${freeShippingProgress}%` }}
            />
          </div>
          <p className="text-xs text-orange-600 dark:text-orange-400">
            再買 NT$ {amountToFreeShipping.toLocaleString()} 即享免運！
          </p>
        </div>
      )}

      {isFreeShipping && (
        <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-400">
          <Truck className="h-4 w-4 shrink-0" />
          <span>已達免運門檻，享免費配送！</span>
        </div>
      )}

      {/* Gift eligible badge */}
      {_settings.giftNfcEnabled &&
        (isGiftEligible ? (
          <div className="flex items-center gap-2 rounded-xl border border-green-300 bg-green-50 px-3 py-2 text-sm font-medium text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-400">
            <Gift className="h-4 w-4 shrink-0 text-green-500" />
            <span>🎉 您將獲贈 NFC 寵物卡一張！</span>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            消費滿 NT$ {giftThreshold.toLocaleString()} 贈 NFC 卡（還差 NT${' '}
            {(giftThreshold - subtotal).toLocaleString()}）
          </p>
        ))}

      <Button className="w-full" size="lg" asChild>
        <Link href="/checkout">前往結帳</Link>
      </Button>

      <div className="text-center">
        <Link
          href="/shop"
          className="text-sm text-muted-foreground hover:text-foreground hover:underline"
        >
          繼續購物
        </Link>
      </div>
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyCart() {
  return (
    <div className="flex flex-col items-center gap-4 py-24 text-center">
      <div className="flex h-24 w-24 items-center justify-center rounded-full bg-muted">
        <ShoppingCart className="h-12 w-12 text-muted-foreground/40" />
      </div>
      <div>
        <p className="text-lg font-semibold">購物車是空的</p>
        <p className="mt-1 text-sm text-muted-foreground">
          快去挑選喜歡的商品吧！
        </p>
      </div>
      <Button asChild>
        <Link href="/shop">去逛逛</Link>
      </Button>
    </div>
  )
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function CartSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex gap-4 rounded-2xl border bg-card p-4">
            <Skeleton className="h-20 w-20 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="h-3 w-1/4" />
            </div>
          </div>
        ))}
      </div>
      <div className="lg:col-span-1">
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    </div>
  )
}

// ── Delete confirm dialog ─────────────────────────────────────────────────────

function DeleteDialog({
  open,
  itemName,
  onConfirm,
  onCancel,
}: {
  open: boolean
  itemName: string
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onCancel()
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>移除商品</DialogTitle>
          <DialogDescription>
            確定要從購物車移除「{itemName}」嗎？
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel}>
            取消
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            移除
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CartPage() {
  const { toast } = useToast()
  const {
    items,
    isLoading,
    itemCount,
    updateQty,
    removeItem,
    syncToDb,
    mergeWithDb,
    _loadSettings,
  } = useCartStore()

  const [initialized, setInitialized] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<CartItem | null>(null)
  const syncTimerRef = useRef<ReturnType<typeof setTimeout>>()

  // Rehydrate + load settings + merge with DB on first mount
  useEffect(() => {
    const init = async () => {
      // Manually rehydrate localStorage (skipHydration: true)
      await useCartStore.persist.rehydrate()

      // Load fresh cart settings
      await useCartStore.getState()._loadSettings()
      setInitialized(true)

      // If user is logged in, merge local ↔ DB carts
      try {
        const supabase = createClient()
        const {
          data: { session },
        } = await supabase.auth.getSession()
        if (session) {
          await mergeWithDb()
        }
      } catch {
        // Not logged in or network error — use localStorage only
      }
    }
    void init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Debounced DB sync after quantity changes
  const scheduleSyncToDb = useCallback(() => {
    clearTimeout(syncTimerRef.current)
    syncTimerRef.current = setTimeout(() => {
      void syncToDb().catch(() => {})
    }, 800)
  }, [syncToDb])

  const handleInc = useCallback(
    (item: CartItem) => {
      if (item.quantity >= item.stock) return
      void updateQty(item.variant_id, item.quantity + 1)
      scheduleSyncToDb()
    },
    [updateQty, scheduleSyncToDb],
  )

  const handleDec = useCallback(
    (item: CartItem) => {
      if (item.quantity <= 1) return
      void updateQty(item.variant_id, item.quantity - 1)
      scheduleSyncToDb()
    },
    [updateQty, scheduleSyncToDb],
  )

  const handleDelete = useCallback(() => {
    if (!deleteTarget) return
    removeItem(deleteTarget.variant_id)
    toast({ title: `已移除「${deleteTarget.name}」` })
    setDeleteTarget(null)
  }, [deleteTarget, removeItem, toast])

  // Show loading skeleton until localStorage is rehydrated
  if (!initialized || (isLoading && items.length === 0)) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-bold">購物車</h1>
        <CartSkeleton />
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <EmptyCart />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <h1 className="text-2xl font-bold">購物車</h1>
        <Badge variant="secondary" className="text-sm">
          {itemCount} 件
        </Badge>
        {isLoading && (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* ── Left: Items ── */}
        <div className={cn('space-y-4 lg:col-span-2')}>
          {items.map((item) => (
            <CartItemRow
              key={item.variant_id}
              item={item}
              onInc={() => handleInc(item)}
              onDec={() => handleDec(item)}
              onDeleteRequest={() => setDeleteTarget(item)}
            />
          ))}
        </div>

        {/* ── Right: Summary (sticky on desktop) ── */}
        <div className="lg:col-span-1">
          <div className="lg:sticky lg:top-6">
            <OrderSummary />
          </div>
        </div>
      </div>

      {/* Delete confirm dialog */}
      <DeleteDialog
        open={!!deleteTarget}
        itemName={
          deleteTarget
            ? `${deleteTarget.name} / ${deleteTarget.variant_name}`
            : ''
        }
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
