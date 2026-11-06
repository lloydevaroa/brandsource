"use client";

import { useEffect } from "react";
import { useCart } from "@/lib/cart";

/**
 * The cart is only emptied once the customer is back from Stripe with an order
 * of their own, so cancelling at the payment screen leaves the cart intact.
 */
export function ClearCart() {
  const { clear } = useCart();
  useEffect(() => {
    clear();
  }, [clear]);
  return null;
}
