// Stock deduction timing: ON_SALE (normal sale) vs ON_DELIVERY (special/scheduled order).
//
// Requirement:
// - A normal sale discounts stock at the moment of the sale (closeOrder).
// - A special order (TOGO/PICK_UP with a delivery date, stock_deduction_timing = ON_DELIVERY)
//   must NOT discount stock when the order is created, closed or paid, nor when it moves
//   through READY_TO_PICKUP / SENT. Stock is removed only when the order is marked DELIVERED.
//
// Observe-only policy: a single preparation step creates one item per scenario and sets
// its stock to 200 via adjustStock (exactly one adjustment per item, nothing more).
// The sale tests then only run the sale/delivery flows and READ stock afterwards.
// Orders are left as-is on purpose (no cancel, no return, no devolution),
// so the resulting stock_records can be inspected in the database afterwards.
// Scenarios: (1) normal sale paid at once -> stock out at sale;
// (2) special order with delivery date -> stock out only at delivery;
// (3) special order paid with future delivery date but not delivered ->
// no delivered flag and no stock movement logged at all.

QUnit.module('Stock deduction timing (ON_SALE vs ON_DELIVERY)');

QUnit.test('Environment: backend login resolves a tenant database', async function(assert) {
	assert.timeout(15000);

	try {
		var session = await login();
		assert.ok(session.bearer, 'logged in; tenant database resolved');
	} catch (error) {
		assert.ok(
			false,
			'Login failed: ' + (error.message || error)
			+ ' — open this page via http://localhost/POSTest/... instead of http://127.0.0.1/POSTest/...'
			+ ' so the backend can resolve the tenant database from the Host header.'
		);
	}
});

async function createStockedTimingItem(bearer, storeId, name, qty) {
	var item = await getOrCreateItem(bearer, {
		availability_type: 'ON_STOCK',
		clave_sat: '53111603',
		name: name,
		note_required: 'NO',
		on_sale: 'NO',
		reference_price: 0,
		status: 'ACTIVE',
		unidad_medida_sat_id: 'H87'
	});

	await apiRequest('/updates.php', {
		method: 'POST',
		bearer: bearer,
		body: {
			method: 'adjustStock',
			stock_records: [{ store_id: storeId, qty: qty, item_id: item.id }]
		}
	});

	return item;
}

async function getTimingStockQty(itemId, storeId, bearer) {
	var response = await apiRequest(
		'/stock_record_info.php?item_id=' + encodeURIComponent(itemId)
		+ '&store_id=' + encodeURIComponent(storeId)
		+ '&is_current=1',
		{ bearer: bearer }
	);

	if (!response.data || !response.data[0] || !response.data[0].stock_record) {
		return 0;
	}

	return Number(response.data[0].stock_record.qty);
}

function timingOrderPayload(itemId, storeId, userId, options) {
	options = options || {};
	var qty = options.qty || 2;
	var unitPrice = 15.5;
	var subtotal = Number((qty * unitPrice).toFixed(2));
	var tax = Number((subtotal * 0.08).toFixed(2));
	var total = Number((subtotal + tax).toFixed(2));

	var order = {
		amount_paid: 0,
		cashier_user_id: userId,
		client_name: options.clientName || uniqueName('Stock Timing'),
		currency_id: 'MXN',
		delivery_status: 'PENDING',
		discount: 0,
		paid_status: 'PENDING',
		price_type_id: 1,
		service_type: options.serviceType || 'QUICK_SALE',
		status: 'PENDING',
		store_id: storeId,
		subtotal: 0,
		sync_id: userId + '-' + Date.now() + '-' + Math.floor(Math.random() * 1000000),
		tax: 0,
		tax_percent: 8,
		total: 0
	};

	if (options.deliverySchedule) {
		order.delivery_schedule = options.deliverySchedule;
	}

	if (options.stockDeductionTiming) {
		order.stock_deduction_timing = options.stockDeductionTiming;
	}

	return {
		order: order,
		items: [
			{
				order_item: {
					commanda_status: 'NOT_DISPLAYED',
					delivery_status: 'PENDING',
					discount: 0,
					discount_percent: 0,
					has_separator: 'NO',
					is_free_of_charge: 'NO',
					is_item_extra: 'NO',
					item_group: Date.now(),
					item_id: itemId,
					item_option_qty: 1,
					note: '',
					original_unitary_price: unitPrice,
					paid_qty: 0,
					preparation_status: 'PENDING',
					qty: qty,
					return_required: 'NO',
					status: 'ACTIVE',
					stock_status: 'IN_STOCK',
					subtotal: subtotal,
					tax: tax,
					tax_included: 'NO',
					total: total,
					type: 'NORMAL',
					unitary_price: unitPrice,
					unitary_price_meta: unitPrice
				},
				order_item_exceptions: []
			}
		]
	};
}

async function closeTimingSale(orderId, bearer) {
	return apiRequest('/updates.php', {
		method: 'POST',
		bearer: bearer,
		body: { method: 'closeOrder', order_id: orderId }
	});
}

function timingPaymentPayload(orderId, total) {
	return {
		movements: [
			{
				bank_movement: {
					transaction_type: 'CASH',
					client_user_id: null,
					total: total,
					amount_received: total,
					currency_id: 'MXN',
					exchange_rate: 1,
					type: 'income'
				},
				bank_movement_orders: [
					{
						currency_amount: total,
						amount: total,
						currency_id: 'MXN',
						exchange_rate: 1,
						order_id: orderId
					}
				]
			}
		],
		payment: {
			type: 'income',
			tag: 'SALE',
			payment_amount: total,
			received_amount: total,
			change_amount: 0,
			currency_id: 'MXN',
			sync_id: '1-' + Date.now()
		}
	};
}

async function payTimingOrder(orderId, total, bearer) {
	return apiRequest('/payment_info.php', {
		method: 'POST',
		bearer: bearer,
		body: timingPaymentPayload(orderId, total)
	});
}

async function setTimingDeliveryStatus(orderId, deliveryStatus, bearer) {
	return apiRequest('/updates.php', {
		method: 'POST',
		bearer: bearer,
		body: { method: 'updateOrderDeliveryStatus', order_id: orderId, delivery_status: deliveryStatus }
	});
}

async function reloadTimingOrder(orderId, bearer) {
	return apiRequest('/order_info.php?id=' + encodeURIComponent(orderId), { bearer: bearer });
}

var timingFixtures = null;

async function ensureTimingFixtures() {
	if (timingFixtures) {
		return timingFixtures;
	}

	var session = await login();
	var storeId = Number(session.user.store_id || testConfig.storeId);

	// Single preparation: one fixed item per scenario (like the other suites:
	// getOrCreateItem reuses them by exact name, so items are created only once
	// and never again on later runs). One stock adjustment per item resets them to 200.
	var normalItem = await createStockedTimingItem(session.bearer, storeId, 'Stock Timing Normal Item', 200);
	var specialItem = await createStockedTimingItem(session.bearer, storeId, 'Stock Timing Special Item', 200);
	var paidSpecialItem = await createStockedTimingItem(session.bearer, storeId, 'Stock Timing Paid Special Item', 200);

	timingFixtures = { session: session, storeId: storeId, normalItem: normalItem, specialItem: specialItem, paidSpecialItem: paidSpecialItem };
	return timingFixtures;
}

QUnit.test('Prepare stock once for both scenarios (single adjustment per item)', async function(assert) {
	assert.timeout(60000);

	var fx = await ensureTimingFixtures();
	assert.ok(fx.normalItem.id, 'normal sale item ready, id=' + fx.normalItem.id);
	assert.ok(fx.specialItem.id, 'special order item ready, id=' + fx.specialItem.id);
	assert.ok(fx.paidSpecialItem.id, 'paid special item ready, id=' + fx.paidSpecialItem.id);
	assert.equal(await getTimingStockQty(fx.normalItem.id, fx.storeId, fx.session.bearer), 200, 'normal item stock prepared at 200');
	assert.equal(await getTimingStockQty(fx.specialItem.id, fx.storeId, fx.session.bearer), 200, 'special item stock prepared at 200');
	assert.equal(await getTimingStockQty(fx.paidSpecialItem.id, fx.storeId, fx.session.bearer), 200, 'paid special item stock prepared at 200');

	console.log('Stock prepared once, no further adjustments: normal item_id=' + fx.normalItem.id + ', special item_id=' + fx.specialItem.id + ', paid-special item_id=' + fx.paidSpecialItem.id);
});

QUnit.test('Normal sale (QUICK_SALE / ON_SALE) discounts stock at the moment of the sale', async function(assert) {
	assert.timeout(60000);

	var fx = await ensureTimingFixtures();
	var session = fx.session;
	var storeId = fx.storeId;
	var item = fx.normalItem;
	assert.ok(session.bearer, 'logged in (shared fixture, no new adjustment)');

	var stockBefore = await getTimingStockQty(item.id, storeId, session.bearer);
	assert.ok(stockBefore >= 2, 'normal item has prepared stock to sell (stock=' + stockBefore + ')');

	var payload = timingOrderPayload(item.id, storeId, session.user.id, {
		qty: 2,
		serviceType: 'QUICK_SALE',
		stockDeductionTiming: 'ON_SALE'
	});

	var created = await apiRequest('/order_info.php', {
		method: 'POST',
		bearer: session.bearer,
		body: payload
	});
	assert.ok(created.order && created.order.id, 'created normal sale order id=' + (created.order && created.order.id));
	assert.equal(created.order.stock_deduction_timing, 'ON_SALE', 'order persists stock_deduction_timing=ON_SALE');

	var orderId = created.order.id;

	// Observe-only: the order is intentionally left PAID/CLOSED (no cancel, no return),
	// so the resulting stock movement can be inspected afterwards.
	// The normal sale is paid through the regular payment flow (payment_info),
	// which closes the order internally — that payment is the moment of the sale.
	var prepay = await reloadTimingOrder(orderId, session.bearer);
	var paymentTotal = prepay.order.total - (prepay.order.discount || 0);
	await payTimingOrder(orderId, paymentTotal, session.bearer);

	var reloaded = await reloadTimingOrder(orderId, session.bearer);
	assert.equal(reloaded.order.paid_status, 'PAID', 'order is paid through the normal payment flow');
	assert.equal(reloaded.order.status, 'CLOSED', 'order is closed (sale completed)');
	assert.equal(
		reloaded.items[0].order_item.stock_status,
		'STOCK_REMOVED',
		'order item stock_status is STOCK_REMOVED right after the sale'
	);

	var stockAfterSale = await getTimingStockQty(item.id, storeId, session.bearer);
	assert.equal(
		stockAfterSale,
		stockBefore - 2,
		'stock discounted at the moment of the sale: ' + stockBefore + ' -> ' + stockAfterSale
	);

	console.log('Normal sale left as-is for inspection: order_id=' + orderId + ', item_id=' + item.id + ', stock ' + stockBefore + ' -> ' + stockAfterSale);
});

QUnit.test('Special order (PICK_UP + delivery date / ON_DELIVERY) discounts stock only at delivery', async function(assert) {
	assert.timeout(60000);

	var fx = await ensureTimingFixtures();
	var session = fx.session;
	var storeId = fx.storeId;
	var item = fx.specialItem;
	assert.ok(session.bearer, 'logged in (shared fixture, no new adjustment)');

	var stockBefore = await getTimingStockQty(item.id, storeId, session.bearer);
	assert.ok(stockBefore >= 3, 'special item has prepared stock to sell (stock=' + stockBefore + ')');

	var deliveryDate = new Date();
	deliveryDate.setDate(deliveryDate.getDate() + 2);

	var payload = timingOrderPayload(item.id, storeId, session.user.id, {
		qty: 3,
		serviceType: 'PICK_UP',
		deliverySchedule: mysqlDate(deliveryDate),
		stockDeductionTiming: 'ON_DELIVERY'
	});

	var created = await apiRequest('/order_info.php', {
		method: 'POST',
		bearer: session.bearer,
		body: payload
	});
	assert.ok(created.order && created.order.id, 'created special order id=' + (created.order && created.order.id));
	assert.equal(created.order.stock_deduction_timing, 'ON_DELIVERY', 'order persists stock_deduction_timing=ON_DELIVERY');
	assert.ok(created.order.delivery_schedule, 'order keeps its delivery date');

	var orderId = created.order.id;

	// Observe-only: the order is intentionally left DELIVERED (no cancel, no return),
	// so the resulting stock movements can be inspected afterwards.
	// Moment of the sale: closing (charging) the special order must NOT touch stock.
	await closeTimingSale(orderId, session.bearer);

	var afterSale = await reloadTimingOrder(orderId, session.bearer);
	assert.equal(afterSale.order.status, 'CLOSED', 'special order is closed (sale completed)');
	assert.notEqual(afterSale.order.delivery_status, 'DELIVERED', 'special order is not auto-delivered on close');
	assert.equal(
		afterSale.items[0].order_item.stock_status,
		'IN_STOCK',
		'order item stock_status stays IN_STOCK after the sale'
	);

	var stockAfterSale = await getTimingStockQty(item.id, storeId, session.bearer);
	assert.equal(
		stockAfterSale,
		stockBefore,
		'stock NOT discounted at the moment of the sale: still ' + stockAfterSale
	);

	// Intermediate delivery state must NOT touch stock either.
	await setTimingDeliveryStatus(orderId, 'READY_TO_PICKUP', session.bearer);

	var afterReady = await reloadTimingOrder(orderId, session.bearer);
	assert.equal(afterReady.order.delivery_status, 'READY_TO_PICKUP', 'order moved to READY_TO_PICKUP');
	assert.equal(
		afterReady.items[0].order_item.stock_status,
		'IN_STOCK',
		'order item stock_status stays IN_STOCK at READY_TO_PICKUP'
	);

	var stockAfterReady = await getTimingStockQty(item.id, storeId, session.bearer);
	assert.equal(
		stockAfterReady,
		stockBefore,
		'stock NOT discounted at READY_TO_PICKUP: still ' + stockAfterReady
	);

	// Moment of the delivery: stock is finally removed.
	await setTimingDeliveryStatus(orderId, 'DELIVERED', session.bearer);

	var afterDelivery = await reloadTimingOrder(orderId, session.bearer);
	assert.equal(afterDelivery.order.delivery_status, 'DELIVERED', 'order is DELIVERED');
	assert.equal(
		afterDelivery.items[0].order_item.delivery_status,
		'DELIVERED',
		'order item delivery_status is DELIVERED'
	);
	assert.equal(
		afterDelivery.items[0].order_item.stock_status,
		'STOCK_REMOVED',
		'order item stock_status is STOCK_REMOVED after delivery'
	);

	var stockAfterDelivery = await getTimingStockQty(item.id, storeId, session.bearer);
	assert.equal(
		stockAfterDelivery,
		stockBefore - 3,
		'stock discounted at the moment of the delivery: ' + stockBefore + ' -> ' + stockAfterDelivery
	);

	console.log('Special order left as-is for inspection: order_id=' + orderId + ', item_id=' + item.id + ', stock ' + stockBefore + ' -> sale:' + stockAfterSale + ' -> ready:' + stockAfterReady + ' -> delivered:' + stockAfterDelivery);
});

QUnit.test('Paid special order with delivery date (not delivered) shows no delivery and no stock discount', async function(assert) {
	assert.timeout(60000);

	var fx = await ensureTimingFixtures();
	var session = fx.session;
	var storeId = fx.storeId;
	var item = fx.paidSpecialItem;
	assert.ok(session.bearer, 'logged in (shared fixture, no new adjustment)');

	var stockBefore = await getTimingStockQty(item.id, storeId, session.bearer);
	assert.ok(stockBefore >= 4, 'paid special item has prepared stock to sell (stock=' + stockBefore + ')');

	var deliveryDate = new Date();
	deliveryDate.setDate(deliveryDate.getDate() + 2);

	var payload = timingOrderPayload(item.id, storeId, session.user.id, {
		qty: 4,
		serviceType: 'PICK_UP',
		deliverySchedule: mysqlDate(deliveryDate),
		stockDeductionTiming: 'ON_DELIVERY'
	});

	var created = await apiRequest('/order_info.php', {
		method: 'POST',
		bearer: session.bearer,
		body: payload
	});
	assert.ok(created.order && created.order.id, 'created paid special order id=' + (created.order && created.order.id));
	assert.equal(created.order.stock_deduction_timing, 'ON_DELIVERY', 'order persists stock_deduction_timing=ON_DELIVERY');

	var orderId = created.order.id;

	// Pay through the normal payment flow, but do NOT deliver: nothing may be
	// flagged as delivered and no inventory movement may be logged.
	var prepay = await reloadTimingOrder(orderId, session.bearer);
	var paymentTotal = prepay.order.total - (prepay.order.discount || 0);
	await payTimingOrder(orderId, paymentTotal, session.bearer);

	var reloaded = await reloadTimingOrder(orderId, session.bearer);
	assert.equal(reloaded.order.paid_status, 'PAID', 'order is paid');
	assert.equal(reloaded.order.status, 'CLOSED', 'order is closed');
	assert.notEqual(reloaded.order.delivery_status, 'DELIVERED', 'paid special order is not marked delivered');
	assert.equal(reloaded.items[0].order_item.delivery_status, 'PENDING', 'item is NOT shown as delivered');
	assert.equal(reloaded.items[0].order_item.stock_status, 'IN_STOCK', 'item stock_status stays IN_STOCK');

	var stockAfterPay = await getTimingStockQty(item.id, storeId, session.bearer);
	assert.equal(stockAfterPay, stockBefore, 'no stock discounted on payment with a future delivery date: still ' + stockAfterPay);

	var orderItemId = reloaded.items[0].order_item.id;
	var movements = await apiRequest('/stock_record_info.php?order_item_id=' + encodeURIComponent(orderItemId), { bearer: session.bearer });
	assert.ok(
		(movements.total || 0) === 0 && (!movements.data || movements.data.length === 0),
		'no stock_record logged for the item (no inventory discount in the log)'
	);

	console.log('Paid-but-undelivered order left as-is for inspection: order_id=' + orderId + ', order_item_id=' + orderItemId + ', item_id=' + item.id + ', stock ' + stockBefore + ' -> ' + stockAfterPay);
});
