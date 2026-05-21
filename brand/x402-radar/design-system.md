# x402 Radar Design System

## Brand Sentence

Trust402 is the radar layer for x402 buyers: it sees available resources, scores trust signals, enforces spend policy, and leaves receipts behind every paid action.

## Visual Language

Use a dark operational interface with bright but restrained signal colors. The UI should look like a live command center for endpoint discovery, not a decorative crypto landing page.

Avoid:

- cartoon characters
- generic blockchain cubes
- noisy gradients
- glowing decorative orbs
- marketing fluff cards with no operational meaning
- one-color green-only styling

Prefer:

- radar sweep lines
- endpoint nodes
- status chips
- compact resource cards
- uptime and price signals
- policy gates
- receipt/proof rows
- small charts and heat indicators

## Color Roles

Primary surface is near-black, with off-white text and signal accents.

- `radar-black`: main background
- `panel-graphite`: dashboard panels and card surfaces
- `mist`: primary readable text
- `muted-steel`: secondary labels
- `signal-green`: healthy/live/allowed state
- `cyan-trace`: links, active scan, selected resource
- `magenta-ping`: external or newly discovered signal
- `amber-risk`: warning, spend threshold, policy review
- `red-deny`: blocked, failed, denied

Use accents sparingly. The dominant feeling should be controlled visibility, not arcade neon.

## Typography

Use a clean sans-serif for marketing and UI copy. Use a monospace face only for endpoint URLs, hashes, receipts, and code-like details.

Recommended stack:

- Display/UI: `Inter`, `Geist`, `Segoe UI`, `Arial`, sans-serif
- Mono: `JetBrains Mono`, `Geist Mono`, `Consolas`, monospace

Headlines should be direct and compact. Avoid oversized text inside operational panels.

## Layout

Hero layout:

- Full viewport-width dark band
- Left side: short headline, support text, primary CTA, secondary API link
- Right side: live radar/resource visual
- A hint of the next section should remain visible below the hero

Main body:

- Full-width sections with constrained inner content
- No nested cards
- Cards only for repeated resource items or specific tool panels
- 8px radius maximum unless the existing product style requires otherwise

## Hero Visual

The hero visual should show a radar map of x402 resources:

- 8-14 endpoint nodes
- resource cards connected to radar pings
- visible labels: `price`, `uptime`, `proof`, `policy`
- one highlighted path: `discover -> quote -> approve -> pay -> receipt`
- small live status strip

The visual must communicate that Trust402 observes and controls spend before payment.

## Component Motifs

### Radar Node

Small endpoint marker with health and price status.

States:

- `allowed`
- `review`
- `blocked`
- `paid`
- `proofed`

### Resource Card

Compact card for one x402 endpoint.

Fields:

- endpoint name
- URL host
- price
- uptime
- trust score
- policy result
- proof availability

### Policy Gate

A small control panel showing whether a paid call can proceed.

Fields:

- per-call cap
- job cap
- daily cap
- allowlist match
- receipt required
- proof required

### Receipt Row

Ledger-like row after payment.

Fields:

- timestamp
- endpoint
- amount
- receipt hash
- proof status
- policy id

## Motion

Use subtle motion only:

- slow radar sweep
- soft node pulse for active resources
- small status updates
- scan-line movement inside panels

Do not animate every element. Trust is the product, so motion should feel measured.

## Icon Direction

Use simple line icons:

- radar
- shield/check
- receipt
- route/split
- lock
- activity/heartbeat
- database
- code

Use `lucide` icons if the frontend stack already includes it.

## Landing Priority

First viewport must answer:

1. What is Trust402?
2. What does it watch?
3. How does it prevent bad spend?
4. What evidence does it return?

Best first-screen phrase:

> A live radar for x402 resources.

Support phrase:

> Track endpoints, compare prices, detect risk, and route safe payments through policy.
