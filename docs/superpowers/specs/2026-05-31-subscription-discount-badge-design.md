# Active Subscription Discount — Design

Date: 2026-05-31
File touched: `components/settings/SubscriptionView.tsx` only

## Goal

Surface an active subscription discount on the Subscription & Billing page:

1. Active discount **badge** visible on the page.
2. A line under the current plan name: `Current discount: 30% off until July 2026`.
3. A **next-charge preview** that shows the discounted amount.

## Data (mock)

This is a static mock app (no backend). Add near the other mock constants:

```ts
const ACTIVE_DISCOUNT = { percentOff: 0.30, label: '30% off', until: 'July 2026' };
const NEXT_CHARGE_DATE = 'Jul 1, 2026';
```

Helper to compute the discounted price from a tier price string (`'$29'`):

```ts
const discountedPrice = (price: string) => {
  const n = parseFloat(price.replace(/[^0-9.]/g, ''));
  return `$${(n * (1 - ACTIVE_DISCOUNT.percentOff)).toFixed(2)}`;
};
```

`$29 × 0.70 = $20.30`.

## Placement (both header + current plan card)

### Header strip
Sibling card next to the existing "Current Method" card:
- Amber `Badge` reading `30% OFF`.
- Caption `Current discount applied`.
- Line `Next charge: $20.30 on Jul 1, 2026`.

### Current plan card (`isCurrent` only)
- Amber `Badge` (`30% OFF`) pinned top-right, mirroring the existing "Most Popular" pill style.
- Under the plan-name `<h3>`: `Current discount: 30% off until July 2026` in small amber text.
- In the footer below the "Current Plan" button: `Next charge: $20.30 · Jul 1` with original `$29` struck-through.

## Styling

Reuse existing `Badge` (`color="amber"`) and the `text-amber-600 dark:text-amber-400` palette already present in the file. No new primitives.

## Assumptions / scope

- Discount is hardcoded; not derived from the Founders Club "20% off" perk (separate concept).
- `Jul 1, 2026` date is presentational, consistent with "until July 2026".
- No real billing logic beyond the 30% helper.
- Folder is not a git repo — no commit step.
