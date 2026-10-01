import { getCatalog } from "@/lib/catalog";
import { CartView } from "./CartView";

export const dynamic = "force-dynamic";

export default async function CartPage() {
  return <CartView catalog={await getCatalog()} />;
}
