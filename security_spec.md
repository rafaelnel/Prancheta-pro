# Firestore Security Specification (Phase 0 — Payload-First Security TDD)

## 1. Data Invariants
1. **Strict Ownership & PII Isolation (`/users/{userId}`)**:
   - A user profile document at `/users/{userId}` can only be read, created, or updated by the authenticated user where `request.auth.uid == userId` and `incoming().ownerId == request.auth.uid`.
   - No PII fields (`email`, `phone`, `address`) are stored in `/users/{userId}`, and no cross-user reads or blanket `isSignedIn()` reads are permitted.
2. **Master Gate Relational Sync (`/users/{userId}/careerSlots/{slotId}`)**:
   - A career slot document at `/users/{userId}/careerSlots/{slotId}` can only exist if the parent `/users/{userId}` document exists and its `ownerId == request.auth.uid`.
   - `slotId` must match `^slot_[1-4]$` and `slotIndex` must be an integer between `1` and `4`.
3. **Validation Blueprints & Temporal Integrity**:
   - Every create and update operation is wrapped by `isValidUserProfile(incoming())` or `isValidCareerCloudSlot(incoming())`.
   - All string fields enforce explicit `minLength` and `maxLength` bounds from `firebase-blueprint.json`.
   - `createdAt` must equal `request.time` on `create` and remain immutable (`incoming().createdAt == existing().createdAt`) on `update`.
   - `updatedAt` must equal `request.time` on both `create` and `update`.
4. **Secure List Queries**:
   - `allow list` on `/users/{userId}/careerSlots` explicitly checks `request.auth.uid == userId && resource.data.ownerId == request.auth.uid` without any `get()` or `exists()` calls inside `list`.

## 2. The "Dirty Dozen" Payloads (Adversarial Rejections)
1. **Unauthenticated Write**: `auth = null` attempting `create` on `/users/u1` -> `PERMISSION_DENIED`.
2. **Identity Spoofing on Profile**: Authenticated as `u1`, creating `/users/u1` with `ownerId: "u2"` -> `PERMISSION_DENIED`.
3. **Cross-User Profile Read**: Authenticated as `u2`, reading `/users/u1` -> `PERMISSION_DENIED`.
4. **Shadow Field Injection on Profile**: Creating `/users/u1` with extra key `isAdmin: true` -> `PERMISSION_DENIED`.
5. **String Boundary Overflow on Profile**: `displayName` with 250 chars (> 80 max) -> `PERMISSION_DENIED`.
6. **Invalid Currency Enum**: `preferredCurrency: "USD"` (not in `['BRL', 'EUR']`) -> `PERMISSION_DENIED`.
7. **Forged Client Timestamp on Create**: `createdAt` not matching `request.time` -> `PERMISSION_DENIED`.
8. **Mutating Immutable `createdAt` or `ownerId` on Update**: Updating `/users/u1` with modified `createdAt` or `ownerId` -> `PERMISSION_DENIED`.
9. **Orphaned Career Slot Without Parent User Profile**: Creating `/users/u1/careerSlots/slot_1` when `/users/u1` does not exist -> `PERMISSION_DENIED`.
10. **Path Variable Poisoning on Slot ID**: Creating `/users/u1/careerSlots/malicious_id_999` (fails `^slot_[1-4]$`) -> `PERMISSION_DENIED`.
11. **Value Poisoning on Career Slot Update**: Updating `division` to `"Z"` or `slotIndex` to `99` -> `PERMISSION_DENIED`.
12. **Cross-User Career Slot List Scraping**: Authenticated as `u2`, listing `/users/u1/careerSlots` -> `PERMISSION_DENIED`.
