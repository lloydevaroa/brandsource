"use client";

import { useEffect } from "react";
import { useCart } from "@/lib/cart";

/**
 * The cart is only emptied once the customer is back from Stripe with an order
 * of their own, so cancelling at the payment screen leaves the cart intact.
 */
export function ClearCart() {
  const { clear, hydrated } = useCart();
  // Wait for the saved cart to load first: clearing earlier gets overwritten by that load,
  // which put the old items straight back.
  useEffect(() => {
    if (hydrated) clear();
  }, [hydrated, clear]);
  return null;
}
