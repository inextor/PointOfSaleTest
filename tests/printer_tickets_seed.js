// Printer Tickets seed: prepares ready-to-print orders for the manual
// ticket test guide. Idempotent: tables, items, client, address and stock
// are reused by exact name; CLOSED seed orders are reused by client_name
// (PENDING leftovers are closed in place), so re-running never piles up
// duplicates. Every seed order is left CLOSED: sale tickets print from
// closed orders.
//
// Covers:
//  1. Sale ticket RECOGER / A DOMICILIO double size (PICK_UP, TOGO, IN_PLACE)
//  2. Sale ticket Entrega date/time line (with / without delivery_schedule)
//  3-5. Kitchen comanda mesa name (TERRAZA 1), bare double-size table line,
//       no-table pickup/togo comandas. Printers are intentionally untouched.
//
// Open tests/printer_tickets_seed.html in the browser and run it.

QUnit.module('Printer tickets seed');

var ticketSeed = null;

function ticketLine(itemId, qty, group, exc) {
	var unitPrice = 50;
	var subtotal = Number((qty * unitPrice).toFixed(2));
	var tax = Number((subtotal * 0.08).toFixed(2));

	return {
		order_item: {
			commanda_status: 'NOT_DISPLAYED',
			delivery_status: 'PENDING',
			discount: 0,
			discount_percent: 0,
			has_separator: 'NO',
			is_free_of_charge: 'NO',
			is_item_extra: 'NO',
			item_group: group,
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
			total: Number((subtotal + tax).toFixed(2)),
			type: 'NORMAL',
			unitary_price: unitPrice,
			unitary_price_meta: unitPrice
		},
		// Creation-time exceptions need description + stock_item_id, not
		// just item_exception_id (backend rejects the short form with 500).
		order_item_exceptions: exc ? [{
			item_exception_id: exc.id,
			stock_item_id: exc.stock_item_id,
			description: exc.description
		}] : []
	};
}

function ticketOrderPayload(clientName, serviceType, storeId, userId, items, opts) {
	opts = opts || {};
	var subtotal = items.reduce(function(acc, i) { return acc + i.order_item.subtotal; }, 0);
	var tax = items.reduce(function(acc, i) { return acc + i.order_item.tax; }, 0);

	var order = {
		amount_paid: 0,
		cashier_user_id: userId,
		client_name: clientName,
		currency_id: 'MXN',
		delivery_status: 'PENDING',
		discount: 0,
		paid_status: 'PENDING',
		price_type_id: 1,
		service_type: serviceType,
		status: 'PENDING',
		store_id: storeId,
		subtotal: Number(subtotal.toFixed(2)),
		sync_id: userId + '-ticket-' + Date.now() + '-' + Math.floor(Math.random() * 1000000),
		tax: Number(tax.toFixed(2)),
		tax_percent: 8,
		total: Number((subtotal + tax).toFixed(2))
	};

	// TOGO orders are rejected (422) without a delivery address.
	if (opts.togo) {
		order.client_user_id = ticketSeed.client.id;
		order.shipping_address_id = ticketSeed.addressId;
		order.address = 'Av Juarez 849';
	}

	if (opts.deliverySchedule) {
		order.delivery_schedule = opts.deliverySchedule;
	}

	if (opts.tableId) {
		order.table_id = opts.tableId;
	}

	return { order: order, items: items };
}

async function findSeedOrderRow(bearer, clientName) {
	var found = await apiRequest(
		'/order_info.php?client_name,=' + encodeURIComponent(clientName) + '&limit=-1',
		{ bearer: bearer }
	);

	var rows = found.data || [];
	for (var i = 0; i < rows.length; i++) {
		var o = rows[i].order || {};
		if (o.client_name === clientName && (o.status === 'PENDING' || o.status === 'CLOSED')) {
			return rows[i];
		}
	}

	return null;
}

// Self-healing: the first version of this seed shared one item_group across
// independent lines, which crashes the comanda print at
// view-commanda.component.ts:917. If the reused order still has that shape,
// cancel it so it is recreated below with distinct groups.
function seedRowNeedsRegroup(row) {
	var items = row.items || [];
	if (!items.length) {
		return true;
	}

	var seen = {};
	for (var i = 0; i < items.length; i++) {
		var g = items[i].order_item && items[i].order_item.item_group;
		if (seen[g]) {
			return true;
		}
		seen[g] = true;
	}

	return false;
}

async function ensureSeedOrder(bearer, clientName, serviceType, storeId, userId, mainItemId, stockItemId, opts) {
	var existing = await findSeedOrderRow(bearer, clientName);

	if (existing && seedRowNeedsRegroup(existing)) {
		console.log('seed order ' + clientName + ' id=' + existing.order.id + ' shares item_group, cancelling to recreate');
		await apiRequest('/updates.php', {
			method: 'POST',
			bearer: bearer,
			body: { method: 'cancelOrder', order_id: existing.order.id, cancellation_reason: 'Printer tickets seed regroup fix' }
		});
		existing = null;
	}

	if (existing) {
		console.log('reuse seed order ' + clientName + ' id=' + existing.order.id + ' status=' + existing.order.status);
		existing = existing.order;
	} else {
		// Independent sale lines need distinct item_group values. Sharing one
		// group makes createStructuredItems treat the second line as an
		// option-child of the first, and the comanda print then crashes looking
		// up its (null) item_option_id (view-commanda.component.ts).
		var group = Date.now();
		var created = await apiRequest('/order_info.php', {
			method: 'POST',
			bearer: bearer,
			body: ticketOrderPayload(clientName, serviceType, storeId, userId, [
				ticketLine(mainItemId, 2, group, opts.exc || null),
				ticketLine(stockItemId, 1, group + 1, null)
			], opts)
		});

		existing = created.order;
		console.log('created seed order ' + clientName + ' id=' + existing.id);
	}

	// Sale tickets print from closed orders, so every seed is left CLOSED.
	if (existing.status === 'PENDING') {
		await apiRequest('/updates.php', {
			method: 'POST',
			bearer: bearer,
			body: { method: 'closeOrder', order_id: existing.id }
		});
		existing = (await apiRequest('/order_info.php?id=' + existing.id, { bearer: bearer })).order;
		console.log('closed seed order ' + clientName + ' id=' + existing.id);
	}

	return existing;
}

async function ensureTicketSeed() {
	if (ticketSeed) {
		return ticketSeed;
	}

	var session = await login();
	var storeId = Number(session.user.store_id || testConfig.storeId);

	// 1-2 tables only, reused by exact name (none existed before TERRAZA 1/2).
	var tables = [];
	for (var t = 1; t <= 2; t++) {
		var tableName = 'TERRAZA ' + t;
		var found = await apiRequest(
			'/table.php?name=' + encodeURIComponent(tableName) + '&store_id=' + storeId + '&limit=-1',
			{ bearer: session.bearer }
		);
		var match = (found.data || []).find(function(r) { return r.name === tableName; });

		tables.push(match || await apiRequest('/table.php', {
			method: 'POST',
			bearer: session.bearer,
			body: { name: tableName, store_id: storeId, status: 'ACTIVE', capacity: 4 }
		}));
	}

	// Items reused by exact name; kitchen items point at commanda_type 1 (Cocina).
	var mainItem = await getOrCreateItem(session.bearer, {
		availability_type: 'ALWAYS',
		clave_sat: '53111603',
		name: 'Printer Ticket Item',
		note_required: 'NO',
		on_sale: 'YES',
		reference_price: 50,
		status: 'ACTIVE',
		unidad_medida_sat_id: 'H87',
		commanda_type_id: 1
	});
	var stockItem = await getOrCreateItem(session.bearer, {
		availability_type: 'ON_STOCK',
		clave_sat: '53111603',
		name: 'Printer Ticket Stock Item',
		note_required: 'NO',
		on_sale: 'YES',
		reference_price: 50,
		status: 'ACTIVE',
		unidad_medida_sat_id: 'H87',
		commanda_type_id: 1
	});
	var ingredient = await getOrCreateItem(session.bearer, {
		availability_type: 'ON_STOCK',
		clave_sat: '53111603',
		name: 'Printer Ticket Cebolla',
		note_required: 'NO',
		on_sale: 'NO',
		reference_price: 50,
		status: 'ACTIVE',
		unidad_medida_sat_id: 'H87',
		commanda_type_id: 1
	});

	for (var s = 0; s < [stockItem, ingredient].length; s++) {
		await apiRequest('/updates.php', {
			method: 'POST',
			bearer: session.bearer,
			body: {
				method: 'adjustStock',
				stock_records: [{ store_id: storeId, qty: 200, item_id: [stockItem, ingredient][s].id }]
			}
		});
	}

	// "Sin cebolla" exception on the main item (removal_timing SALE,
	// order_type ALL so it applies to PICK_UP, TOGO and IN_PLACE).
	var withExc = await apiRequest('/item_info.php?id=' + mainItem.id, { bearer: session.bearer });
	var exc = (withExc.exceptions || []).find(function(e) { return e.description === 'Sin cebolla'; });
	if (!exc) {
		await apiRequest('/item_info.php', {
			method: 'PUT',
			bearer: session.bearer,
			body: {
				item: { id: mainItem.id, has_serial_number: 'NO', reference_price: 50, currency_id: 'MXN' },
				exceptions: [{
					description: 'Sin cebolla',
					stock_item_id: ingredient.id,
					stock_qty: 1,
					order_type: 'ALL',
					removal_timing: 'SALE',
					list_as_exception: 'YES'
				}]
			}
		});
		withExc = (await apiRequest('/item_info.php?id=' + mainItem.id, { bearer: session.bearer }))
			.exceptions.find(function(e) { return e.description === 'Sin cebolla'; });
	}

	// Client + shipping address (TOGO orders require an address).
	var clientSearch = await apiRequest('/user.php?name,=Ticket%20Test%20Client&limit=-1', { bearer: session.bearer });
	var client = (clientSearch.data || []).find(function(r) { return r.name === 'Ticket Test Client'; });
	if (!client) {
		client = await apiRequest('/user.php', {
			method: 'POST',
			bearer: session.bearer,
			body: {
				creation_store_id: String(storeId),
				credit_days: 0,
				credit_limit: 100000,
				name: 'Ticket Test Client',
				payment_option: 'STORE',
				status: 'ACTIVE',
				type: 'CLIENT'
			}
		});
	}
	// closeOrder charges the order total against the client's credit,
	// so the seed client needs room for the TOGO order (also fixes
	// clients created before the 100000 default above).
	if (Number(client.credit_limit || 0) < 100000) {
		var updatedClient = await apiRequest('/user.php', {
			method: 'PUT',
			bearer: session.bearer,
			body: { id: client.id, credit_limit: 100000 }
		});
		if (updatedClient && updatedClient.id) {
			client = updatedClient;
		}
	}
	var addrSearch = await apiRequest('/address.php?user_id=' + client.id + '&limit=-1', { bearer: session.bearer });
	var addr = (addrSearch.data || []).find(function(r) { return r.type === 'SHIPPING'; });
	if (!addr) {
		addr = await apiRequest('/address.php', {
			method: 'POST',
			bearer: session.bearer,
			body: {
				name: 'Ticket Test Address',
				type: 'SHIPPING',
				address: 'Av Juarez 849',
				zipcode: '22800',
				email: '',
				rfc: '',
				user_id: client.id,
				lat: 31.86,
				lng: -116.6
			}
		});
	}

	var delivery = new Date();
	delivery.setDate(delivery.getDate() + 1);
	var schedule = mysqlDate(delivery).slice(0, 10) + ' 18:30:00';

	ticketSeed = {
		session: session,
		storeId: storeId,
		tables: tables,
		mainItem: mainItem,
		stockItem: stockItem,
		exc: exc,
		client: client,
		addressId: addr.id,
		schedule: schedule
	};

	return ticketSeed;
}

QUnit.test('Prepare tables, items, exception, qty and stock (reuse, no printers)', async function(assert) {
	assert.timeout(120000);

	var fx = await ensureTicketSeed();

	assert.ok(fx.tables[0].id, 'table TERRAZA 1 ready, id=' + fx.tables[0].id);
	assert.ok(fx.tables[1].id, 'table TERRAZA 2 ready, id=' + fx.tables[1].id);
	assert.ok(fx.mainItem.id, 'Printer Ticket Item ready, id=' + fx.mainItem.id);
	assert.ok(fx.stockItem.id, 'Printer Ticket Stock Item ready, id=' + fx.stockItem.id);
	assert.ok(fx.exc.id, 'Sin cebolla exception ready, id=' + fx.exc.id);

	console.log(
		'Ticket seed ready: tables TERRAZA 1/2 ids=' + fx.tables[0].id + '/' + fx.tables[1].id +
		', items ' + fx.mainItem.id + '/' + fx.stockItem.id +
		', exception ' + fx.exc.id + ', client ' + fx.client.id
	);
});

QUnit.test('Ready sale orders: PICK_UP/TOGO with schedule, PICK_UP without, IN_PLACE at TERRAZA 1', async function(assert) {
	assert.timeout(120000);

	var fx = await ensureTicketSeed();
	var bearer = fx.session.bearer;

	var pickupScheduled = await ensureSeedOrder(bearer, 'Ticket PICK_UP con entrega', 'PICK_UP', fx.storeId, fx.session.user.id, fx.mainItem.id, fx.stockItem.id, { deliverySchedule: fx.schedule, exc: fx.exc });
	var togoScheduled = await ensureSeedOrder(bearer, 'Ticket TOGO con entrega', 'TOGO', fx.storeId, fx.session.user.id, fx.mainItem.id, fx.stockItem.id, { deliverySchedule: fx.schedule, togo: true });
	var pickupPlain = await ensureSeedOrder(bearer, 'Ticket PICK_UP sin entrega', 'PICK_UP', fx.storeId, fx.session.user.id, fx.mainItem.id, fx.stockItem.id, {});
	var dineIn = await ensureSeedOrder(bearer, 'Ticket IN_PLACE TERRAZA 1', 'IN_PLACE', fx.storeId, fx.session.user.id, fx.mainItem.id, fx.stockItem.id, { deliverySchedule: fx.schedule, tableId: fx.tables[0].id, exc: fx.exc });

	assert.equal(pickupScheduled.service_type, 'PICK_UP', 'PICK_UP order ready, id=' + pickupScheduled.id);
	assert.ok(pickupScheduled.delivery_schedule, 'PICK_UP order has Entrega schedule');
	assert.equal(togoScheduled.service_type, 'TOGO', 'TOGO order ready, id=' + togoScheduled.id);
	assert.ok(togoScheduled.delivery_schedule, 'TOGO order has Entrega schedule');
	assert.equal(pickupPlain.service_type, 'PICK_UP', 'plain PICK_UP order ready, id=' + pickupPlain.id);
	assert.notOk(pickupPlain.delivery_schedule, 'plain PICK_UP order has no schedule');
	assert.equal(Number(dineIn.table_id), Number(fx.tables[0].id), 'dine-in order seated at TERRAZA 1, id=' + dineIn.id);

	var seedOrders = [pickupScheduled, togoScheduled, pickupPlain, dineIn];
	for (var c = 0; c < seedOrders.length; c++) {
		assert.equal(seedOrders[c].status, 'CLOSED', 'seed order closed, id=' + seedOrders[c].id);
	}

	console.log(
		'Ticket orders ready: PICK_UP+sched=' + pickupScheduled.id +
		', TOGO+sched=' + togoScheduled.id +
		', PICK_UP plain=' + pickupPlain.id +
		', IN_PLACE TERRAZA 1=' + dineIn.id +
		'. All four left CLOSED for sale-ticket printing; dine-in prints bare TERRAZA 1 double-size.'
	);
});
