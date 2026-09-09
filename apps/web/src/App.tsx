import { CheckoutPage } from "./components/CheckoutPage";
import { GiftPage } from "./components/GiftPage";
import { LandingPage } from "./components/LandingPage";

function decodePathPart(value: string | undefined) {
  return value ? decodeURIComponent(value) : "";
}

export function App() {
  const parts = window.location.pathname.split("/").filter(Boolean);
  if (parts[0] === "checkout" && parts[1]) {
    return <CheckoutPage orderId={decodePathPart(parts[1])} />;
  }
  if (parts[0] === "p" && parts[1]) {
    return <GiftPage slug={decodePathPart(parts[1])} />;
  }
  if (parts[0] === "g" && parts[1]) {
    return <GiftPage token={decodePathPart(parts[1])} />;
  }
  return <LandingPage />;
}
