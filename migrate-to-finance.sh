#!/bin/bash
# Migration script: move finance app routes under /finance/* and update internal links.
# Run from project root. Idempotent-ish but always work on a clean git state.

set -e  # Exit on first error

echo "→ Creating app/finance directory..."
mkdir -p app/finance

echo "→ Moving finance routes into app/finance/..."
git mv app/page.tsx app/finance/page.tsx
git mv app/ExpenseTracker.tsx app/finance/ExpenseTracker.tsx
git mv app/setup app/finance/setup
git mv app/income app/finance/income
git mv app/loans app/finance/loans
git mv app/payments app/finance/payments

echo "→ Updating internal links in .tsx files..."

# Find all .tsx files (excluding node_modules) and update routes
# IMPORTANT: order matters — replace longer strings first to avoid partial matches.
find app -name "*.tsx" -type f | while read -r file; do
  # Skip node_modules just in case
  if [[ "$file" == *node_modules* ]]; then continue; fi

  # Replace href="/loans" → href="/finance/loans"  (and other routes)
  sed -i '' \
    -e 's|href="/setup"|href="/finance/setup"|g' \
    -e 's|href="/income"|href="/finance/income"|g' \
    -e 's|href="/loans"|href="/finance/loans"|g' \
    -e 's|href="/payments"|href="/finance/payments"|g' \
    -e 's|redirect("/setup")|redirect("/finance/setup")|g' \
    -e 's|redirect("/income")|redirect("/finance/income")|g' \
    -e 's|redirect("/loans")|redirect("/finance/loans")|g' \
    -e 's|redirect("/payments")|redirect("/finance/payments")|g' \
    -e 's|redirect("/")|redirect("/finance")|g' \
    -e 's|router\.push("/")|router.push("/finance")|g' \
    -e 's|href="/"|href="/finance"|g' \
    "$file"
done

echo "→ Done!"
echo ""
echo "Next steps:"
echo "1. git status  (verify the moves)"
echo "2. git diff    (review the link updates)"
echo "3. Refresh localhost:3000/finance to confirm the app still works"