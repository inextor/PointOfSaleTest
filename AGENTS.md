# AGENTS.md

## Akou SuperRest API conventions (DO NOT re-read PHP files for these)

### Generic GET (`genericGet`)
- Default pagination: 20 records per page
- Sort with `?_sort=COLUMN_DIRECTION`, e.g. `?_sort=id_DESC`
- Set `?limit=-1` to fetch all records
- Response format:
  - With `?id=X`: returns single record object directly
  - List query: returns `{ total: N, data: [...] }` (if class has `getInfo`) or `{ total: N, data: [...] }` (default)
  - `total` is from `SQL_CALC_FOUND_ROWS` — the full count across all pages
- Query params auto-map to WHERE clauses for matching table column names (e.g. `?store_id=1` → `WHERE store_id="1"`)
- Auth required for most endpoints

### Generic POST (`genericPost`)
- If `_post_search` is set in body, delegates to `get()`
- Returns single record for associative input, array for batch
- Response wraps in `{ table_name: { id, ... } }` if `getInfo` exists, else flat `{ id, ... }`

### Generic PUT (`genericPut`)
- Requires `id` in body for WHERE clause
- All other fields in body are SET in UPDATE
- Auth required

### POST search pattern (use instead of GET for complex filters)
```javascript
apiRequest('/table.php', {
    method: 'POST',
    bearer: s.bearer,
    body: { _post_search: 1, store_id: 1 }
})
```

## Key endpoints used in tests

| Endpoint | GET | POST | PUT | Notes |
|---|---|---|---|---|
| `/bank_account.php` | List/single | Create | Update | No `getInfo`, response: `{ total, data }` |
| `/store_bank_account.php` | List/single | Create | Update | No `getInfo`, response: `{ total, data }` |
| `/bank_movement.php` | List/single | — | Update | Has `getInfo`, response wraps in `bank_movement` |
| `/order_info.php` | List/single | Create | — | Wraps items in `order` key, has `getInfo` |
| `/payment_info.php` | List (via POST) | Create payment | — | Complex nested payload |
| `/item_info.php` | List/single | Create | — | Supports batch create with array |
| `/user.php` | List/single | Create | Update | `?me=1` for current user |
| `/store.php` | List/single | — | — | Public endpoint |
| `/updates.php` | — | Multi-action | — | `method` field routes to action |

## Payment flow (create order + payment)
```
POST /payment_info.php
{
  "movements": [{
    "bank_movement": { transaction_type, total, amount_received, currency_id, exchange_rate, type, bank_account_id? },
    "bank_movement_orders": [{ order_id, amount, currency_amount, currency_id, exchange_rate }]
  }],
  "payment": { type, tag, payment_amount, received_amount, change_amount, currency_id, sync_id }
}
```
- `payment.store_id` auto-set from `$user->store_id` (line 202-205 of payment_info.php)
- `bank_movement.bank_account_id` auto-assigned from `store_bank_account` if empty (matches by `store_id` + optional `default_transaction_type`)

## QUnit test conventions
- `apiRequest(path, { method, bearer, body })` — primary HTTP helper
- `login(username?, password?)` — returns `{ bearer, user }`
- `uniqueName(prefix)` — generates test names with timestamp
- `testConfig.storeId` — default store ID (1)
- `createBackendSaleItems(bearer)` — creates 7 test items, returns ids
- `backendSaleOrderPayload(itemIds, userId)` — builds order payload
- `paymentPayload(orderId, total, userId)` — builds payment payload
- Test modules load `environment.js` (sets `end_point`) + `test_utils.js`
