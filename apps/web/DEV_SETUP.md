# Development Setup Verification

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the dev server:**
   ```bash
   npm run dev
   ```
   Or from the root:
   ```bash
   npm run dev:web
   ```

3. **Open in browser:**
   - The app should automatically open at: `http://localhost:5173`
   - Or manually navigate to: `http://localhost:5173/PM-System/`

## Fixed Issues

✅ **showFilterPanel errors fixed:**
- `AssetsPage.tsx` - Added missing `showFilterPanel` and `tempFilters` state
- `WorkOrdersListPage.tsx` - Added missing `showFilterPanel` and `tempFilters` state

## Project Structure

- **Entry Point:** `apps/web/index.html` → `apps/web/src/main.tsx`
- **Main App:** `apps/web/src/App.tsx`
- **Providers:** `apps/web/src/app/providers/AppProviders.tsx`
- **Routes:** `apps/web/src/app/routes/index.tsx`

## Troubleshooting

If you see a white screen:

1. **Check browser console** for JavaScript errors
2. **Check terminal** for build/compilation errors
3. **Hard refresh** the browser (Ctrl+Shift+R or Ctrl+F5)
4. **Clear browser cache** if issues persist

## Expected Behavior

- ✅ Dev server starts on port 5173
- ✅ App loads at `http://localhost:5173/PM-System/`
- ✅ No white screen - should show login or dashboard
- ✅ Console shows boot logs: `[APP BOOT] Starting application initialization...`

## Notes

- The app uses HashRouter, so URLs will have `#` (e.g., `/#/dashboard`)
- Development mode bypasses authentication
- Error boundaries will catch and display any render errors


