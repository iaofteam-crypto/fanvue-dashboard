# UX-1: Responsive Mobile Completo (375px viewport)

## Task
Verify and fix ALL sections for 375px viewport width.

## Changes Made

### 1. `src/app/page.tsx` — Mobile "More" menu added to bottom nav
- Imported `MoreHorizontal` icon from lucide-react
- Added `moreMenuOpen` state variable
- Added 6th item to bottom nav: "More" button with `MoreHorizontal` icon
- Tapping "More" opens a dropdown panel above the bottom nav showing all NAV_ITEMS not in MOBILE_NAV_IDS
- Dropdown has: `absolute bottom-full right-0`, `w-64`, `max-h-[50vh] overflow-y-auto`, `bg-card border border-border rounded-lg shadow-lg z-50`
- Fixed backdrop overlay (`fixed inset-0 z-40`) closes dropdown on tap outside
- Each item shows icon + label, highlighted if active section
- Closes on item click

### 2. `src/components/dashboard/discoveries-section.tsx` — Table overflow wrapper
- Wrapped `<Table>` in `<div className="overflow-x-auto -mx-4 px-4">`
- Tags column already had `className="hidden md:table-cell"` — no change needed

### 3. `src/components/dashboard/advanced-analytics-section.tsx` — Multiple fixes
- **Date inputs**: Changed `w-[160px]` → `w-full sm:w-[140px]` on both start/end date inputs (lines 847, 861)
- **Comparison select**: Changed `w-[130px]` → `w-full sm:w-[130px]` on comparison SelectTrigger (line 903)
- **Content performance table**: Wrapped `<Table>` in `<div className="overflow-x-auto -mx-4 px-4">`
- **Comments column**: Added `hidden md:table-cell` to both header and cells
- **Date column**: Added `hidden sm:table-cell` to both header and cells

### 4. `src/components/dashboard/analytics-section.tsx` — Period select responsive
- Changed period SelectTrigger from `w-[140px]` → `w-full sm:w-[140px]`

### 5. `src/components/dashboard/bulk-fan-insights-section.tsx` — Expanded preview grid
- Changed inline expanded preview grid from `grid-cols-4 gap-4 text-xs` → `grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 text-[10px] sm:text-xs`

### 6. `src/components/dashboard/mass-messaging-section.tsx` — Already responsive
- Grid lists already use `grid-cols-1 sm:grid-cols-2` — no changes needed

### 7. `src/components/dashboard/dashboard-overview.tsx` — Already responsive
- Cards already use `grid-cols-2 md:grid-cols-4 gap-4` — no changes needed

## Build Result
- `npm run build` — **SUCCESS** ✓
- `npm run lint` — 12 pre-existing errors (all in files NOT modified by this task)
- Dev server running and ready

## Design Decisions
- Used `w-full sm:w-[Xpx]` pattern for inputs/selects so they stretch to container width on mobile
- Used responsive column hiding (`hidden sm:table-cell`, `hidden md:table-cell`) instead of horizontal scroll for less important columns
- "More" menu positioned at `right-0` so it doesn't overflow left on small screens
- Used `fixed inset-0` backdrop for tap-outside-to-close behavior (reliable on mobile)
