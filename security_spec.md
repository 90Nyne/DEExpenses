# Security Specification - Aura Expense

## Data Invariants
1. A transaction must belong to an authenticated user and must have a valid category ID.
2. A category must belong to an authenticated user.
3. Users can only read, create, update, or delete their own data.
4. Timestamps (`createdAt`, `updatedAt`) must be set by the server.
5. Monetary values (`amount`) must be non-negative (unless specified otherwise, but here we use `type` to distinguish).
6. Document IDs used in paths must follow strict format rules.

## The "Dirty Dozen" Payloads (Unauthorized Attempts)
1. **Malicious ID Posting**: Attempting to create a transaction with a massive document ID string (1KB+).
2. **Identity Spoofing (Owner)**: Authenticated User A attempts to create a transaction with `userId` set to User B.
3. **Identity Spoofing (Path)**: Authenticated User A attempts to write to `/users/UserB/transactions/someId`.
4. **Shadow Field Injection**: Attempting to add an `isAdmin: true` field to a transaction document.
5. **Timestamp Manipulation**: Sending a manual `createdAt` string instead of `request.time`.
6. **Negative Amount**: Sending a negative `amount` value (if business logic forbids it, though here we rely on `type`).
7. **Cross-User Read**: User A tries to list transactions for User B.
8. **Invalid Enum Value**: Creating a transaction with `type: 'stolen'`.
9. **Orphaned Transaction**: Creating a transaction with a `categoryId` that doesn't exist (verified via `exists()` check during creation).
10. **Immutable Field Update**: Attempting to change `createdAt` during an update.
11. **PII Leak**: Attempting to read another user's profile/settings document.
12. **Bulk Delete**: User A attempts to delete User B's categories.

## Test Runner (Conceptual logic)
The `firestore.rules` will verify:
- `request.auth.uid == userId` for all paths.
- `isValidTransaction(incoming())` on all writes.
- `isValidCategory(incoming())` on all category writes.
- `affectedKeys().hasOnly(...)` on updates.
- `request.auth.token.email_verified == true` (as per best practice, if applicable, but we'll stick to basic auth first as requested or standard).
